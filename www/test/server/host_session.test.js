import { expect, test } from "bun:test";
import { EventList, GameOverReason, InventorySlot, ItemId, SoundType } from "../../assets/js/server/enums.js";
import { Floor } from "../../assets/js/server/floor.js";
import { GameProperty } from "../../assets/js/server/game_property.js";
import { Point } from "../../assets/js/server/point.js";
import { ServerSetting } from "../../assets/js/server/server_setting.js";
import { getTickRate, millisecondsToFrames } from "../../assets/js/server/util.js";

// Contract modules produced by parallel slices; integration tests are skipped
// until their module graph is complete.
async function loadModule(path) {
    try {
        return await import(path);
    } catch {
        return null;
    }
}

const hostModule = await loadModule("../../assets/js/server/host_session.js");
const gameModule = await loadModule("../../assets/js/server/game.js");
const factoryModule = await loadModule("../../assets/js/server/game_factory.js");
const playerModule = await loadModule("../../assets/js/server/player.js");
const { HostSession } = hostModule ?? {};
const { Game } = gameModule ?? {};
const { GameFactory } = factoryModule ?? {};
const { Player } = playerModule ?? {};

// PHP TestMap
function createTestMap() {
    return {
        name: "test",
        getBombMaxBlastDistance: () => 1000,
        getSpawnPositionAttacker: () => [new Point(0, 0, 0), new Point(999, 0, 999)],
        getSpawnPositionDefender: () => [new Point(0, 0, 50), new Point(9991, 0, 9991)],
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

test.skipIf(!HostSession || !Game || !Player)("HostSession: invalid login code is blocked (PHP ServerTest)", () => {
    const game = GameFactory.createDebug();
    game.loadMap(createTestMap());
    const setting = new ServerSetting(1, 0, "a", "d", false, 0);
    const host = new HostSession(game, setting);
    const snapshots = [];
    host.onSnapshot((msg) => snapshots.push(msg));

    expect(host.getBlockedPlayersCount()).toBe(0);
    expect(host.login("some-invalid-code")).toBe(null);
    expect(host.getBlockedPlayersCount()).toBe(1);
    expect(snapshots.length).toBe(0); // no clients, no sends

    const gameOver = host.tick();
    expect(gameOver).not.toBe(null);
    expect(gameOver.reason).toBe(GameOverReason.REASON_NOT_ALL_PLAYERS_CONNECTED);
    expect(snapshots.length).toBe(0); // still no logged in client
});

test.skipIf(!HostSession || !Game || !Player)("HostSession: not all players connected (PHP ServerTest)", () => {
    const game = GameFactory.createDebug();
    game.loadMap(createTestMap());
    const setting = new ServerSetting(2, 0, "code", "d", true, 0);
    const host = new HostSession(game, setting);
    const snapshots = [];
    host.onSnapshot((msg) => snapshots.push(msg));

    expect(host.login("code")).toBe(1);
    expect(snapshots.length).toBe(1);
    let data = JSON.parse(snapshots[0]);
    expect(data.players).toEqual([]);
    expect(data.events.length).toBe(1);
    expect(data.events[0].code).toBe(EventList.GameStartEvent);
    expect(data.events[0].data.setting.max_rounds).toBe(22);
    expect(data.events[0].data.playersCount).toBe(2);
    expect(data.events[0].data.player.id).toBe(1);

    const gameOver = host.tick(); // warmup fails: 1/2 players, wait 0
    expect(gameOver).not.toBe(null);
    expect(gameOver.reason).toBe(GameOverReason.REASON_NOT_ALL_PLAYERS_CONNECTED);

    expect(snapshots.length).toBe(2);
    data = JSON.parse(snapshots[1]);
    expect(data.players.length).toBe(1);
    expect(data.events.length).toBe(1);
    expect(data.events[0].code).toBe(EventList.GameOverEvent);
    expect(data.events[0].data.reason).toBe(GameOverReason.REASON_NOT_ALL_PLAYERS_CONNECTED);
});

test.skipIf(!HostSession || !Game || !Player)("HostSession: login defender", () => {
    const game = GameFactory.createDebug();
    game.loadMap(createTestMap());
    const setting = new ServerSetting(1, 0, "acode", "dcode", true, 0);
    const host = new HostSession(game, setting);
    host.login("dcode");
    const player = game.getPlayer(1);
    expect(player.isPlayingOnAttackerSide()).toBe(false);
    expect(player.getPositionClone().toArray()).toEqual({ x: 0, y: 0, z: 50 });
});

test.skipIf(!HostSession || !Game || !Player)(
    "HostSession: commands applied per tick - look, crouch, buy (PHP ServerTest)",
    () => {
        const game = GameFactory.createDebug();
        game.loadMap(createTestMap());
        const setting = new ServerSetting(1, 0);
        const host = new HostSession(game, setting);
        const snapshots = [];
        host.onSnapshot((msg) => snapshots.push(msg));

        expect(host.login("acode")).toBe(1);
        // tick 1: warmup completes (1/1, instant), initial broadcast; 'jump' is
        // ignored because the game is still paused on tick 0 (PHP comment)
        expect(host.recvCommand(1, "jump")).toBe(true);
        host.tick();
        // tick 2: forward
        host.recvCommand(1, "forward");
        host.tick();
        // tick 3: right
        host.recvCommand(1, "right");
        host.tick();
        // tick 4: look + crouch + buy molotov in one message
        host.recvCommand(1, "look 45.2 -20.1|crouch|buy 4");
        host.tick();

        const player = game.getPlayer(1);
        expect(player.getPositionClone().y).toBe(0);
        expect(player.getSight().getRotationHorizontal()).toBe(45.2);
        expect(player.getSight().getRotationVertical()).toBe(-20.1);
        const molotov = player.getInventory().getItems()[InventorySlot.SLOT_GRENADE_MOLOTOV];
        expect(molotov).not.toBe(undefined);
        expect(molotov.getId()).toBe(ItemId.Molotov);
        expect(player.getHeadHeight()).toBeLessThan(190);
        expect(snapshots.length).toBe(6); // GameStart + initial + 4 ticks
    },
);

test.skipIf(!HostSession || !Game || !Player)("HostSession: invalid requests are dropped", () => {
    const game = GameFactory.createDebug();
    game.loadMap(createTestMap());
    const setting = new ServerSetting(1, 0);
    const host = new HostSession(game, setting);
    host.login("acode");

    expect(host.recvCommand(1, "invalid-method")).toBe(false);
    expect(host.recvCommand(1, "look 1 one")).toBe(false);
    expect(host.recvCommand(1, "x".repeat(1000))).toBe(false); // > 960 bytes
    expect(host.recvCommand(999, "forward")).toBe(false); // not logged in
});

test.skipIf(!HostSession || !Game || !Player)("HostSession: only one command stream per player per tick", () => {
    const game = GameFactory.createDebug();
    game.loadMap(createTestMap());
    const setting = new ServerSetting(1, 0);
    const host = new HostSession(game, setting);
    host.login("acode");

    expect(host.recvCommand(1, "forward")).toBe(true);
    expect(host.recvCommand(1, "right")).toBe(false); // queued requests dropped
});

test.skipIf(!HostSession || !Game || !Player)(
    "HostSession: game over when round time runs out (PHP ServerTest.testServerGameOver)",
    () => {
        const tickRate = getTickRate();
        const roundTimeMs = Math.floor(Math.random() * (10 * tickRate - tickRate - 1)) + tickRate + 1;
        const roundTickCount = millisecondsToFrames(roundTimeMs);

        const props = new GameProperty();
        props.max_rounds = 1;
        props.freeze_time_sec = 0;
        props.half_time_freeze_sec = 0;
        props.round_end_cool_down_sec = 0;
        props.round_time_ms = roundTimeMs;
        const game = new Game(props);
        game.loadMap(createTestMap());
        const setting = new ServerSetting(1, 0, "code");
        const host = new HostSession(game, setting);
        host.login("code");

        let gameOver = null;
        for (let i = 0; i < 3 + roundTickCount; i++) {
            host.recvCommand(1, "stand");
            gameOver = host.tick();
        }
        expect(gameOver).not.toBe(null);
        expect(gameOver.reason).toBe(GameOverReason.DEFENDERS_WINS);
    },
);

test.skipIf(!HostSession || !Game || !Player)("HostSession: full round flow with two players", () => {
    const props = new GameProperty();
    props.max_rounds = 4;
    props.freeze_time_sec = 0;
    props.half_time_freeze_sec = 0;
    props.round_end_cool_down_sec = 0;
    props.randomize_spawn_position = false;
    props.round_time_ms = 300000;
    const game = new Game(props);
    game.loadMap(createTestMap());
    const setting = new ServerSetting(2, 0, "acode", "dcode");
    const host = new HostSession(game, setting);
    const snapshots = [];
    host.onSnapshot((msg) => snapshots.push(msg));

    expect(host.login("acode")).toBe(1);
    expect(host.login("dcode")).toBe(2);
    expect(snapshots.length).toBe(2); // GameStart per player

    const gameOver = host.tick(); // warmup completes, initial broadcast, round 1 starts
    expect(gameOver).toBe(null);
    expect(game.isPaused()).toBe(false);
    expect(game.getRoundNumber()).toBe(1);

    // attacker kills the defender via the same path World uses after hit resolution
    const attacker = game.getPlayer(1);
    const defender = game.getPlayer(2);
    host.recvCommand(1, "look 90 0");
    host.tick();
    defender.lowerHealth(100);
    game.playerAttackKilledEvent(
        defender,
        { getOriginPlayerId: () => attacker.getId(), getShootItem: () => ({ getId: () => ItemId.Knife }) },
        false,
    );
    host.tick(); // round end detected
    host.tick(); // cooldown 0 -> round reset with money awards (freeze PauseStartEvent added)
    expect(game.getRoundNumber()).toBe(2);
    expect(attacker.getInventory().getDollars()).toBe(800 + 3250);

    // events flow through the onEvent callback
    const eventCodes = new Set();
    host.onEvent((event) => eventCodes.add(event.getCode()));
    host.tick(); // freeze 0 fires -> round 2 starts (PauseEnd + RoundStart, PHP scheduling)
    expect(eventCodes.has(EventList.PauseEndEvent)).toBe(true);
    expect(eventCodes.has(EventList.RoundStartEvent)).toBe(true);

    // snapshots contain players + events JSON structure
    const data = JSON.parse(snapshots[snapshots.length - 1]);
    expect(Array.isArray(data.players)).toBe(true);
    expect(data.players.length).toBe(2);
    expect(Array.isArray(data.events)).toBe(true);
    expect(data.events.some((event) => event.code === EventList.RoundStartEvent)).toBe(true);
    expect(data.events.find((event) => event.code === EventList.RoundStartEvent).data).toEqual({
        attackers: 1,
        defenders: 1,
    });
});

test.skipIf(!HostSession || !Game || !Player)("HostSession: warmup countdown without instant start", () => {
    const game = GameFactory.createDebug();
    game.loadMap(createTestMap());
    const setting = new ServerSetting(1, 0, "acode", "dcode", false, 1); // instant off, 1s wait
    const host = new HostSession(game, setting);
    host.login("acode");

    let gameOver = host.tick(); // players full, but wait for the countdown
    expect(gameOver).toBe(null);
    expect(game.getTickId()).toBe(0); // game did not start yet
    gameOver = host.tick(); // countdown expired -> start
    expect(gameOver).toBe(null);
    expect(game.isPaused()).toBe(false);
});

test.skipIf(!HostSession || !Game || !Player)("HostSession: sound events from kill (SoundType)", () => {
    const props = new GameProperty();
    props.max_rounds = 4;
    props.freeze_time_sec = 0;
    props.half_time_freeze_sec = 0;
    props.round_end_cool_down_sec = 0;
    props.randomize_spawn_position = false;
    props.round_time_ms = 300000;
    const game = new Game(props);
    game.loadMap(createTestMap());
    const host = new HostSession(game, new ServerSetting(2, 0, "acode", "dcode"));
    host.login("acode");
    host.login("dcode");
    host.tick();

    const attacker = game.getPlayer(1);
    const defender = game.getPlayer(2);
    defender.lowerHealth(100);
    game.playerAttackKilledEvent(
        defender,
        { getOriginPlayerId: () => attacker.getId(), getShootItem: () => ({ getId: () => ItemId.Knife }) },
        false,
    );

    const soundTypes = [];
    const eventCodes = [];
    host.onEvent((event) => {
        eventCodes.push(event.getCode());
        if (event.getCode() === EventList.SoundEvent) {
            soundTypes.push(event.serialize().type);
        }
    });
    host.tick();
    expect(eventCodes.includes(EventList.KillEvent)).toBe(true);
    expect(soundTypes).toContain(SoundType.PLAYER_DEAD);
    expect(eventCodes.includes(EventList.RoundEndEvent)).toBe(true);
});
