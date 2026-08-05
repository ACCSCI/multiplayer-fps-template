import { expect, test } from "bun:test";
import { ConsoleLogger } from "../../assets/js/server/console_logger.js";
import {
    Color,
    EventList,
    GameOverReason,
    InventorySlot,
    ItemId,
    RoundEndReason,
} from "../../assets/js/server/enums.js";
import { Floor } from "../../assets/js/server/floor.js";
import { GameException } from "../../assets/js/server/game_exception.js";
import { GameProperty } from "../../assets/js/server/game_property.js";
import { GameState } from "../../assets/js/server/game_state.js";
import { PlayerCamera } from "../../assets/js/server/player_camera.js";
import { PlayerControl } from "../../assets/js/server/player_control.js";
import { PlayerStat } from "../../assets/js/server/player_stat.js";
import { Point } from "../../assets/js/server/point.js";
import { Protocol } from "../../assets/js/server/protocol.js";
import { Score } from "../../assets/js/server/score.js";
import { Sequence } from "../../assets/js/server/sequence.js";
import { ServerSetting } from "../../assets/js/server/server_setting.js";
import { millisecondsToFrames, setTickRate } from "../../assets/js/server/util.js";

// Contract modules produced by parallel slices; they may not all exist yet.
// Integration tests are skipped until their module graph is complete.
async function loadModule(path) {
    try {
        return await import(path);
    } catch {
        return null;
    }
}

const gameModule = await loadModule("../../assets/js/server/game.js");
const factoryModule = await loadModule("../../assets/js/server/game_factory.js");
const playerModule = await loadModule("../../assets/js/server/player.js");
const { Game } = gameModule ?? {};
const { GameFactory } = factoryModule ?? {};
const { Player } = playerModule ?? {};

// PHP TestMap: attacker spawns (0,0,0) + (999,0,999), defender (0,0,50) + extras.
function createTestMap() {
    return {
        name: "test",
        getBombMaxBlastDistance: () => 1000,
        getSpawnPositionAttacker: () => [new Point(0, 0, 0), new Point(999, 0, 999)],
        getSpawnPositionDefender: () => [
            new Point(0, 0, 50),
            new Point(9991, 0, 9991),
            new Point(9992, 0, 9992),
            new Point(9993, 0, 9993),
            new Point(9994, 0, 9994),
        ],
        getSpawnRotationAttacker: () => 0,
        getSpawnRotationDefender: () => 0,
        getStartingPointsForNavigationMesh: () => [new Point(100, 0, 100)],
        getBuyArea: () => ({ contains: () => true }),
        getPlantArea: () => ({ contains: () => true }),
        getWalls: () => [],
        getFloors: () => [new Floor(new Point(0, 0, 0), 99999, 99999)],
        toArray: () => ({}),
    };
}

// PHP BaseTestCase::createNoPauseGameProperty()
function createNoPauseProperties() {
    const props = new GameProperty();
    props.max_rounds = 1;
    props.freeze_time_sec = 0;
    props.half_time_freeze_sec = 0;
    props.round_end_cool_down_sec = 0;
    props.randomize_spawn_position = false;
    props.round_time_ms = 30000;
    return props;
}

function createPlayer(id, isAttacker) {
    if (Player) {
        const player = new Player(id, Color.BLUE, isAttacker);
        if (typeof player.isPlayingOnAttackerSide === "function") {
            return player;
        }
    }
    return { getId: () => id, isPlayingOnAttackerSide: () => isAttacker };
}

test("Sequence: increments", () => {
    const first = Sequence.next();
    expect(first).toMatch(/^id-\d+$/);
    expect(Sequence.next()).toBe(`id-${Number(first.slice(3)) + 1}`);
});

test("GameState: delegates to the game", () => {
    const player = { getId: () => 5 };
    const game = {
        getPlayer: (id) => (id === 5 ? player : null),
        getTickId: () => 42,
        isPaused: () => false,
    };
    const state = new GameState(game);
    expect(state.getPlayer(5)).toBe(player);
    expect(state.getPlayer(4)).toBe(null);
    expect(state.getTickId()).toBe(42);
    expect(state.isPaused()).toBe(false);
});

test("PlayerCamera: look clamps and normalizes (PHP PlayerCamera)", () => {
    const camera = new PlayerCamera();
    camera.look(12.45, 1.09);
    expect(camera.getRotationHorizontal()).toBe(12.45);
    expect(camera.getRotationVertical()).toBe(1.09);

    camera.lookHorizontal(360 + 45);
    expect(camera.getRotationHorizontal()).toBe(45);
    camera.lookHorizontalOffset(10);
    expect(camera.getRotationHorizontal()).toBe(55);
    camera.lookHorizontal(-12.2);
    expect(camera.getRotationHorizontal()).toBe(347.8);

    camera.lookVertical(95);
    expect(camera.getRotationVertical()).toBe(90);
    camera.lookVertical(-95);
    expect(camera.getRotationVertical()).toBe(-90);

    expect(camera.toArray()).toEqual({ horizontal: 347.8, vertical: -90 });
});

test("PlayerStat: counters and cap (PHP PlayerStat)", () => {
    const stat = new PlayerStat(createPlayer(7, true));
    stat.addKill(true);
    stat.addKill(false);
    stat.addDeath();
    stat.addDamage(150); // capped at 100
    stat.removeKill();
    expect(stat.getKills()).toBe(1);
    expect(stat.getHeadshotKills()).toBe(1);
    expect(stat.getDeaths()).toBe(1);
    expect(stat.getDamage()).toBe(100);
    expect(stat.isAttacker()).toBe(true);
    expect(stat.toArray()).toEqual({ id: 7, kills: 1, deaths: 1, damage: 100 });
});

test("Score: scoreboard sort (PHP ScoreTest)", () => {
    const score = new Score([10]);
    score.addPlayer(createPlayer(1, false));
    score.addPlayer(createPlayer(2, false));
    score.addPlayer(createPlayer(3, true));
    score.addPlayer(createPlayer(4, true));

    score.getPlayerStat(1).addDeath();
    score.getPlayerStat(2).addDamage(987);
    score.getPlayerStat(2).addKill(false);
    score.getPlayerStat(3).addDeath();
    score.getPlayerStat(4).addDamage(21);
    score.getPlayerStat(4).addKill(true);
    const scoreBoard = score.toArray();
    expect(Array.isArray(scoreBoard.score)).toBe(true);
    expect(Array.isArray(scoreBoard.lossBonus)).toBe(true);
    expect(typeof scoreBoard.history).toBe("object");
    expect(Array.isArray(scoreBoard.firstHalfScore)).toBe(true);
    expect(Array.isArray(scoreBoard.secondHalfScore)).toBe(true);
    expect(Array.isArray(scoreBoard.scoreboard)).toBe(true);
    expect(scoreBoard.scoreboard).toEqual([
        [
            { id: 2, kills: 1, deaths: 0, damage: 100 },
            { id: 1, kills: 0, deaths: 1, damage: 0 },
        ],
        [
            { id: 4, kills: 1, deaths: 0, damage: 21 },
            { id: 3, kills: 0, deaths: 1, damage: 0 },
        ],
    ]);
});

test("Score: roundEnd loss bonuses and history", () => {
    const score = new Score([1400, 1900, 2400]);
    score.roundEnd({ roundNumberEnded: 1, attackersWins: false, reason: RoundEndReason.ALL_ENEMIES_ELIMINATED });
    expect(score.getScoreDefenders()).toBe(1);
    expect(score.getScoreAttackers()).toBe(0);
    expect(score.getNumberOfLossRoundsInRow(true)).toBe(1);
    expect(score.getMoneyLossBonus(true)).toBe(1400);
    expect(score.attackersIsWinning()).toBe(false);
    expect(score.defendersIsWinning()).toBe(true);

    score.roundEnd({ roundNumberEnded: 2, attackersWins: false, reason: RoundEndReason.ALL_ENEMIES_ELIMINATED });
    expect(score.getNumberOfLossRoundsInRow(true)).toBe(2);
    expect(score.getMoneyLossBonus(true)).toBe(1900);

    // PHP quirk (verified against RoundTest 'lossBonus' => [1400, 1900]): the
    // winning-after-losing round keeps incrementing the attacker loss counter.
    score.roundEnd({ roundNumberEnded: 3, attackersWins: true, reason: RoundEndReason.BOMB_EXPLODED });
    expect(score.getNumberOfLossRoundsInRow(true)).toBe(3);
    expect(score.getNumberOfLossRoundsInRow(false)).toBe(0);
    expect(score.getMoneyLossBonus(true)).toBe(2400);
    expect(score.getScoreAttackers()).toBe(1);
    expect(score.isTie()).toBe(false);

    const history = score.toArray().history;
    expect(history[1].attackersWins).toBe(false);
    expect(history[2].attackersWins).toBe(false);
    expect(history[3]).toEqual({
        attackersWins: true,
        reason: RoundEndReason.BOMB_EXPLODED,
        scoreAttackers: 1,
        scoreDefenders: 2,
    });
});

test("Score: swapTeams resets loss bonuses and records halves", () => {
    const score = new Score([1400, 1900, 2400]);
    score.roundEnd({ roundNumberEnded: 1, attackersWins: false, reason: 0 });
    score.roundEnd({ roundNumberEnded: 2, attackersWins: false, reason: 0 });
    score.swapTeams();
    expect(score.getScoreDefenders()).toBe(0);
    expect(score.getScoreAttackers()).toBe(2);
    expect(score.getNumberOfLossRoundsInRow(true)).toBe(0);
    expect(score.getNumberOfLossRoundsInRow(false)).toBe(0);
    const data = score.toArray();
    expect(data.firstHalfScore).toEqual([2, 0]);
    expect(data.secondHalfScore).toEqual([0, 0]);
    expect(data.halfTimeRoundNumber).toBe(2);
});

test("ConsoleLogger: prints with level", () => {
    const logs = [];
    const original = console.log;
    console.log = (msg) => logs.push(msg);
    try {
        new ConsoleLogger().log("info", "hello world");
        new ConsoleLogger().log(42, "weird level");
    } finally {
        console.log = original;
    }
    expect(logs.length).toBe(2);
    expect(logs[0]).toMatch(/^\[\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}\] hello world \[info\]$/);
    expect(logs[1]).toMatch(/weird level \[unknown\]$/);
});

test("ServerSetting: tick rate side effect and defaults", () => {
    setTickRate(20);
    const setting = new ServerSetting(9, 10, "a", "d");
    expect(setting.playersMax).toBe(9);
    expect(setting.tickMs).toBe(10);
    expect(setting.attackerCode).toBe("a");
    expect(setting.defenderCode).toBe("d");
    expect(setting.warmupInstantStart).toBe(true);
    expect(setting.warmupWaitSec).toBe(60);
    expect(setting.warmupWaitSecRemains).toBe(60);
    expect(millisecondsToFrames(100)).toBe(10); // tick rate changed to 10

    new ServerSetting(1, 0); // tickMs <= 0 keeps the current rate
    expect(millisecondsToFrames(100)).toBe(10);
    setTickRate(20);
});

function createStubPlayer() {
    const sight = {
        rotationHorizontal: 0,
        rotationVertical: 0,
        look(h, v) {
            this.rotationHorizontal = h;
            this.rotationVertical = v;
        },
    };
    const calls = [];
    return {
        calls,
        sight,
        getSight: () => sight,
        isPlantingOrDefusing: () => false,
        stand: () => calls.push("stand"),
        crouch: () => calls.push("crouch"),
        speedWalk: () => calls.push("walk"),
        speedRun: () => calls.push("run"),
        jump: () => calls.push("jump"),
        dropEquippedItem: () => calls.push("drop"),
        reload: () => calls.push("reload"),
        buyItem: (id) => calls.push(`buy:${id}`),
        attack: () => calls.push("attack"),
        attackSecondary: () => calls.push("attack2"),
        use: () => calls.push("use"),
        equip: (slot) => calls.push(`equip:${slot}`),
        getEquippedItem: () => ({ getSlot: () => InventorySlot.SLOT_KNIFE }),
        moveForward: () => calls.push("forward"),
        moveBackward: () => calls.push("backward"),
        moveLeft: () => calls.push("left"),
        moveRight: () => calls.push("right"),
    };
}

function createStubGameState(paused = false) {
    return new GameState({ isPaused: () => paused });
}

test("PlayerControl: all protocol methods are callable", () => {
    const player = createStubPlayer();
    const control = new PlayerControl(player, createStubGameState());
    for (const method of Object.keys(Protocol.playerControlMethods)) {
        expect(typeof control[method]).toBe("function");
    }
});

test("PlayerControl: look rounds to 2 decimals (PHP round)", () => {
    const player = createStubPlayer();
    const control = new PlayerControl(player, createStubGameState());
    control.look(45.2, -20.1);
    expect(player.sight.rotationHorizontal).toBe(45.2);
    expect(player.sight.rotationVertical).toBe(-20.1);
    control.look(12.345, -20.125);
    expect(player.sight.rotationHorizontal).toBe(12.35); // PHP round(12.345, 2), half away from zero
    expect(player.sight.rotationVertical).toBe(-20.13);
});

test("PlayerControl: paused game blocks movement/attack/reload", () => {
    const player = createStubPlayer();
    const control = new PlayerControl(player, createStubGameState(true));
    control.forward();
    control.jump();
    control.attack();
    control.run();
    control.reload();
    expect(player.calls).toEqual([]);
    // not blocked: stand/crouch/drop/use/buy/equip/look
    control.stand();
    control.crouch();
    control.drop();
    control.use();
    expect(player.calls).toEqual(["stand", "crouch", "drop", "use"]);
});

test("PlayerControl: buy/equip validate enum values", () => {
    const player = createStubPlayer();
    const control = new PlayerControl(player, createStubGameState());
    control.buy(9999);
    control.buy(4); // GRENADE_MOLOTOV
    control.equip(9999);
    control.equip(0); // SLOT_KNIFE - equals equipped slot, skipped
    control.equip(3); // SLOT_BOMB
    expect(player.calls).toEqual(["buy:4", "equip:3"]);
});

// ---------------------------------------------------------------------------
// Integration: Game (skipped until backtrack/navigation_mesh/path_finder land)
// ---------------------------------------------------------------------------

function createFlowGame() {
    const props = createNoPauseProperties();
    props.max_rounds = 4;
    props.round_time_ms = 300000;
    const game = new Game(props);
    game.loadMap(createTestMap());
    const attacker = new Player(1, Color.BLUE, true);
    const defender = new Player(2, Color.GREEN, false);
    game.addPlayer(attacker);
    game.addPlayer(defender);
    return { game, attacker, defender };
}

test.skipIf(!Game || !Player)("Game: construction, loadMap and spawn (PHP TestMap)", () => {
    const { game, attacker, defender } = createFlowGame();
    expect(game.isPaused()).toBe(true);
    expect(game.getRoundNumber()).toBe(1);
    expect(game.getTickId()).toBe(0);

    // deterministic spawns (randomize_spawn_position = false)
    expect(attacker.getPositionClone().toArray()).toEqual({ x: 0, y: 0, z: 0 });
    expect(defender.getPositionClone().toArray()).toEqual({ x: 0, y: 0, z: 50 });
    // start money
    expect(attacker.getInventory().getDollars()).toBe(800);
    expect(defender.getInventory().getDollars()).toBe(800);
    // first attacker carries the bomb
    expect(attacker.getInventory().has(InventorySlot.SLOT_BOMB)).toBe(true);
    expect(defender.getInventory().has(InventorySlot.SLOT_BOMB)).toBe(false);
});

test.skipIf(!Game || !Player)("Game: loadMap with default-map.json via World", async () => {
    const mapFile = Bun.file(new URL("../../resources/map/default-map.json", import.meta.url));
    expect(await mapFile.exists()).toBe(true);
    const mapData = await mapFile.json();

    const map = {
        name: "default",
        getBombMaxBlastDistance: () => 1000,
        getSpawnPositionAttacker: () => mapData.spawnAttackers.map(([x, y, z]) => new Point(x, y, z)),
        getSpawnPositionDefender: () => mapData.spawnDefenders.map(([x, y, z]) => new Point(x, y, z)),
        getSpawnRotationAttacker: () => 0,
        getSpawnRotationDefender: () => 0,
        getStartingPointsForNavigationMesh: () =>
            mapData.spawnAttackers.slice(0, 1).map(([x, y, z]) => new Point(x, y, z)),
        getBuyArea: () => ({ contains: () => true }),
        getPlantArea: () => ({ contains: () => true }),
        getWalls: () => [],
        getFloors: () => [new Floor(new Point(0, 0, 0), 99999, 99999)],
        toArray: () => ({}),
    };

    const props = new GameProperty();
    const game = new Game(props);
    const planeCount = game.loadMap(map);
    expect(planeCount).toBe(1); // one floor
    expect(game.getWorld().getMap()).toBe(map);
    expect(game.getWorld().getMap().getBombMaxBlastDistance()).toBe(1000);
});

test.skipIf(!Game || !Player)("Game: freeze time 0 unpauses on first tick (PHP RoundTest)", () => {
    const { game } = createFlowGame();
    expect(game.isPaused()).toBe(true);
    game.tick();
    expect(game.isPaused()).toBe(false);
    const events = game.consumeTickEvents();
    expect(events.map((event) => event.getCode())).toEqual([
        EventList.PauseStartEvent,
        EventList.PauseEndEvent,
        EventList.RoundStartEvent,
    ]);
    expect(events[2].serialize()).toEqual({ attackers: 1, defenders: 1 });
});

test.skipIf(!Game || !Player)("Game: duplicate player id throws (PHP RoundTest)", () => {
    const { game, attacker } = createFlowGame();
    expect(() => game.addPlayer(attacker)).toThrow(GameException);
    expect(() => game.addPlayer(attacker)).toThrow(/already in game/);
});

test.skipIf(!Game || !Player)("Game: minimal round flow - kill, round end, economy", () => {
    const { game, attacker, defender } = createFlowGame();
    game.tick(); // unpause, round 1
    expect(game.getRoundNumber()).toBe(1);

    // commands applied via PlayerControl
    const control = new PlayerControl(attacker, game.getState());
    control.look(45.2, -20.1);
    expect(attacker.getSight().getRotationHorizontal()).toBe(45.2);
    expect(attacker.getSight().getRotationVertical()).toBe(-20.1);

    // kill the defender (health + kill event, as World does after hit resolution)
    defender.lowerHealth(100);
    game.playerAttackKilledEvent(
        defender,
        { getOriginPlayerId: () => attacker.getId(), getShootItem: () => ({ getId: () => ItemId.Knife }) },
        false,
    );
    expect(defender.isAlive()).toBe(false);
    expect(game.getScore().getPlayerStat(attacker.getId()).getKills()).toBe(1);
    expect(game.getScore().getPlayerStat(defender.getId()).getDeaths()).toBe(1);

    // kill events are consumed with the tick events
    const killEvents = game.consumeTickEvents().filter((event) => event.getCode() === EventList.KillEvent);
    expect(killEvents.length).toBe(1);
    expect(killEvents[0].serialize()).toEqual({ playerDead: 2, playerCulprit: 1, itemId: 1, headshot: false });

    // next tick detects the round end (ALL_ENEMIES_ELIMINATED)
    game.tick();
    expect(game.getRoundNumber()).toBe(2);
    expect(game.getScore().getScoreAttackers()).toBe(1);

    // cooldown 0 -> round reset: money award + respawn
    game.tick();
    expect(attacker.isAlive()).toBe(true);
    expect(defender.isAlive()).toBe(true);
    expect(attacker.getInventory().getDollars()).toBe(800 + 3250);
    expect(defender.getInventory().getDollars()).toBe(800 + 1400);
});

test.skipIf(!Game || !Player)("Game: round ends when time runs out", () => {
    const props = createNoPauseProperties();
    props.round_time_ms = 1;
    const game = new Game(props);
    game.loadMap(createTestMap());
    const attacker = new Player(1, Color.BLUE, true);
    game.addPlayer(attacker);

    game.tick(); // tick 0: unpause
    game.tick(); // tick 1: RoundStart fires, roundStartTickId = 1
    const gameOver = game.tick(); // tick 2: 1 + roundTickCount(1) === 2 -> TIME_RUNS_OUT
    expect(game.getRoundNumber()).toBe(2);
    expect(game.getScore().getScoreDefenders()).toBe(1);
    expect(gameOver).not.toBe(null);
    expect(gameOver.reason).toBe(GameOverReason.DEFENDERS_WINS);
});

test.skipIf(!Game || !Player)("Game: round end events fire once per round (PHP RoundTest)", () => {
    const props = createNoPauseProperties();
    props.max_rounds = 3;
    props.round_time_ms = 1000;
    const game = new Game(props);
    game.loadMap(createTestMap());
    const attacker = new Player(1, Color.BLUE, true);
    game.addPlayer(attacker);

    let roundEndCount = 0;
    let cooldownCount = 0;
    let tickCount = 0;
    while (!game.gameOver && tickCount < 5000) {
        game.tick();
        tickCount++;
        for (const event of game.consumeTickEvents()) {
            if (event.getCode() === EventList.RoundEndEvent) {
                roundEndCount++;
            }
            if (event.getCode() === EventList.RoundEndCoolDownEvent) {
                cooldownCount++;
            }
        }
    }
    expect(roundEndCount).toBe(3);
    expect(cooldownCount).toBe(1); // (firstRound + halfTime)
    expect(game.getRoundNumber()).toBe(4);
    expect(game.gameOver).not.toBe(null);
});

test.skipIf(!GameFactory)("GameFactory: createDefaultCompetitive / createDebug", () => {
    const game = GameFactory.createDefaultCompetitive();
    expect(game.getProperties().backtrack_history_tick_count).toBe(1);
    expect(game.getProperties().max_rounds).toBe(24);

    const debug = GameFactory.createDebug();
    expect(debug.getProperties().start_money).toBe(16000);
    expect(debug.getProperties().max_rounds).toBe(22);
    expect(debug.getProperties().freeze_time_sec).toBe(0);
    expect(debug.getProperties().half_time_freeze_sec).toBe(0);
    expect(debug.getProperties().round_time_ms).toBe(982123);
    expect(debug.getProperties().round_end_cool_down_sec).toBe(0);
    expect(debug.getProperties().randomize_spawn_position).toBe(false);
});
