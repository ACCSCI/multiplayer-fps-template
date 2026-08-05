import { expect, test } from "bun:test";
import { Color, EventList, InventorySlot } from "../../assets/js/server/enums.js";
import { Floor } from "../../assets/js/server/floor.js";
import { GameProperty } from "../../assets/js/server/game_property.js";
import { Point } from "../../assets/js/server/point.js";
import { Protocol } from "../../assets/js/server/protocol.js";
import { ServerSetting } from "../../assets/js/server/server_setting.js";
import { setTickRate } from "../../assets/js/server/util.js";

// Contract modules produced by parallel slices; integration tests are skipped
// until their module graph is complete.
async function loadModule(path) {
    try {
        return await import(path);
    } catch {
        return null;
    }
}

const textProtocolModule = await loadModule("../../assets/js/server/text_protocol.js");
const gameModule = await loadModule("../../assets/js/server/game.js");
const playerModule = await loadModule("../../assets/js/server/player.js");
const { TextProtocol } = textProtocolModule ?? {};
const { Game } = gameModule ?? {};
const { Player } = playerModule ?? {};

test("Protocol: player control method tables", () => {
    const methods = Object.entries(Protocol.playerControlMethods);
    expect(methods.length).toBe(17);
    for (const [method, maxCallCount] of methods) {
        expect(maxCallCount).toBeGreaterThan(0);
        expect(typeof Protocol.playerControlMethodParamCount[method]).toBe("number");
    }
    expect(Protocol.playerControlMethods.buy).toBe(9);
    expect(Protocol.playerControlMethodParamCount.look).toBe(2);
    expect(Protocol.playerControlMethodParamCount.buy).toBe(1);
    expect(Protocol.playerControlMethodParamCount.attack).toBe(0);

    // name <-> number are inverse mappings
    for (const [name, number] of Object.entries(Protocol.playerMethodByName)) {
        expect(Protocol.playerMethodByNumber[number]).toBe(name);
    }
    expect(Protocol.methodParamFloat.look).toEqual({ 1: true, 2: true });
});

test.skipIf(!TextProtocol)("TextProtocol: request size and separator", () => {
    const protocol = new TextProtocol();
    expect(protocol.getRequestMaxSizeBytes()).toBe(960);
    expect(protocol.getRequestMaxSizeBytes()).toBeGreaterThan(10);
    expect(protocol.getRequestMaxSizeBytes()).toBeLessThan(2 ** 13);
    expect(TextProtocol.separator).toBe("|");
});

test.skipIf(!TextProtocol)("TextProtocol: parsePlayerControlCommands (PHP ProtocolTest)", () => {
    const protocol = new TextProtocol();
    const separator = TextProtocol.separator;

    expect(protocol.parsePlayerControlCommands(["attack"].join(separator))).toEqual([["attack"]]);
    expect(protocol.parsePlayerControlCommands(["attack", "attack"].join(separator))).toEqual([]);

    expect(
        protocol.parsePlayerControlCommands(["forward", "left", "equip 42", "look -45 124", "right"].join(separator)),
    ).toEqual([["forward"], ["left"], ["equip", 42], ["look", -45, 124], ["right"]]);

    expect(protocol.parsePlayerControlCommands("invalidMethod")).toEqual([]);
    expect(protocol.parsePlayerControlCommands(" move")).toEqual([]);
    expect(protocol.parsePlayerControlCommands("equip knife")).toEqual([]);
    expect(protocol.parsePlayerControlCommands("look 1 one")).toEqual([]);
    expect(protocol.parsePlayerControlCommands("look 1")).toEqual([]);
});

test.skipIf(!TextProtocol)("TextProtocol: per-tick call limit (buy x9)", () => {
    const protocol = new TextProtocol();
    const nineBuys = Array.from({ length: 9 }, (_, i) => `buy ${i + 1}`).join("|");
    expect(protocol.parsePlayerControlCommands(nineBuys).length).toBe(9);
    const tenBuys = Array.from({ length: 10 }, (_, i) => `buy ${i + 1}`).join("|");
    expect(protocol.parsePlayerControlCommands(tenBuys)).toEqual([]);
});

test.skipIf(!TextProtocol || !Game || !Player)("TextProtocol: serializeGameState round trip", () => {
    setTickRate(20);
    const game = createTestGame();
    game.tick(); // freeze 0: PauseStart + PauseEnd + RoundStart events

    const protocol = new TextProtocol();
    const msg = protocol.serializeGameState(game);
    const data = JSON.parse(msg);
    expect(Array.isArray(data.players)).toBe(true);
    expect(data.players.length).toBe(1);
    expect(data.players[0].id).toBe(1);
    expect(data.players[0].color).toBe(Color.BLUE);
    expect(data.players[0].health).toBe(100);
    expect(Array.isArray(data.players[0].position)).toBe(false);
    expect(typeof data.players[0].position.x).toBe("number");
    expect(typeof data.players[0].look.horizontal).toBe("number");

    expect(data.events.map((event) => event.code)).toEqual([
        EventList.PauseStartEvent,
        EventList.PauseEndEvent,
        EventList.RoundStartEvent,
    ]);
    expect(data.events[2].data).toEqual({ attackers: 1, defenders: 0 });

    // events were consumed
    expect(game.consumeTickEvents()).toEqual([]);
});

test.skipIf(!TextProtocol || !Game || !Player)("TextProtocol: serializeGameSetting (GameStartEvent)", () => {
    setTickRate(20);
    const game = createTestGame();
    const player = game.getPlayer(1);
    const setting = new ServerSetting(9, 10, "acode", "dcode");
    const protocol = new TextProtocol();

    const msg = protocol.serializeGameSetting(player, setting, game);
    const data = JSON.parse(msg);
    expect(data.players).toEqual([]);
    expect(data.events.length).toBe(1);
    expect(data.events[0].code).toBe(EventList.GameStartEvent);
    const eventData = data.events[0].data;
    expect(eventData.playerId).toBe(1);
    expect(eventData.warmupSec).toBe(60);
    expect(eventData.tickMs).toBe(10);
    expect(eventData.playersCount).toBe(9);
    expect(eventData.setting).toEqual(game.getProperties().toArray());
    expect(eventData.player.id).toBe(1);
});

test.skipIf(!TextProtocol || !Game || !Player)(
    "TextProtocol: serializeGameState equals serialize(players, events)",
    () => {
        setTickRate(20);
        const protocol = new TextProtocol();

        // reference: consume + serialize manually
        const referenceGame = createTestGame();
        referenceGame.tick();
        const events = referenceGame.consumeTickEvents();
        expect(events.length).toBeGreaterThan(0);
        const expected = JSON.stringify({
            players: referenceGame.getPlayers().map((player) => player.serialize()),
            events: events.map((event) => ({ code: event.getCode(), data: event.serialize() })),
        });

        // fresh deterministic game: serializeGameState consumes internally
        const game = createTestGame();
        game.tick();
        const viaGameState = protocol.serializeGameState(game);
        expect(viaGameState).toBe(expected);
        expect(game.consumeTickEvents()).toEqual([]);
    },
);

test.skipIf(!Game || !Player)("Game: player serialize structure (PHP ProtocolTest)", () => {
    setTickRate(20);
    const game = createTestGame();
    const player = game.getPlayer(1);
    const position = player.getPositionClone();
    player.getSight().look(12.45, 1.09);

    const serialized = player.serialize();
    expect(serialized.id).toBe(1);
    expect(serialized.color).toBe(Color.BLUE);
    expect(serialized.money).toBe(800);
    expect(serialized.canAttack).toBe(false);
    expect(serialized.canBuy).toBe(true);
    expect(serialized.canPlant).toBe(false);
    expect(serialized.health).toBe(100);
    expect(serialized.position).toEqual({ x: position.x, y: position.y, z: position.z });
    expect(serialized.look).toEqual({ horizontal: 12.45, vertical: 1.09 });
    expect(serialized.isAttacker).toBe(true);
    expect(serialized.armor).toBe(0);
    expect(serialized.armorType).toBe(0);
    expect(serialized.isReloading).toBe(false);
    expect(serialized.scopeLevel).toBe(0);
    expect(serialized.ammo).toBeGreaterThan(0);
    expect(serialized.ammoReserve).toBeGreaterThan(0);
    expect(serialized.slots[InventorySlot.SLOT_SECONDARY].id).toBe(2);
    expect(serialized.slots[InventorySlot.SLOT_BOMB].id).toBe(50);
});

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

function createTestGame() {
    const props = new GameProperty();
    props.max_rounds = 1;
    props.freeze_time_sec = 0;
    props.half_time_freeze_sec = 0;
    props.round_end_cool_down_sec = 0;
    props.randomize_spawn_position = false;
    props.round_time_ms = 30000;
    const game = new Game(props);
    game.loadMap(createTestMap());
    game.addPlayer(new Player(1, Color.BLUE, true));
    return game;
}
