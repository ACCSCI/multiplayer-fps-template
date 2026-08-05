import { expect, test } from "bun:test";
import { Box } from "../../assets/js/server/box.js";
import { Floor } from "../../assets/js/server/floor.js";
import { GameException } from "../../assets/js/server/game_exception.js";
import { PlaneBuilder } from "../../assets/js/server/plane_builder.js";
import { Point } from "../../assets/js/server/point.js";
import { Wall } from "../../assets/js/server/wall.js";
import { World } from "../../assets/js/server/world/index.js";

const MAP_JSON = JSON.parse(await Bun.file("www/resources/map/default-map.json").text());

// A duck-typed Game stub: World only calls these methods on the game object.
function createGameStub() {
    return {
        bomb: {},
        getTickId: () => 0,
        isPaused: () => false,
        isBombActive: () => false,
        playersCanBuy: () => false,
        getAlivePlayers: () => [],
        getPlayers: () => ({}),
        getPlayer: () => null,
        getBacktrack: () => ({ getAllPlayerPositions: () => [] }),
        getScore: () => ({ getPlayerStat: () => ({ addDamage: () => {} }) }),
        addSoundEvent: () => {},
        addDropEvent: () => {},
        addThrowEvent: () => {},
        addSmokeEvent: () => {},
        addGrillEvent: () => {},
        bombDefused: () => {},
        bombPlanted: () => {},
        playerAttackKilledEvent: () => {},
        playerGrenadeKilledEvent: () => {},
        playerFallDamageKilledEvent: () => {},
    };
}

// Convert the quads of default-map.json into a Map-like object (walls, floors
// and spawn points) consumable by World.loadMap(). The conversion of the full
// map takes a few seconds, so the result is cached and shared by all tests.
function buildMapFromJson(json) {
    const builder = new PlaneBuilder();
    const walls = [];
    const floors = [];
    for (const quad of json.quads) {
        const points = quad.points.filter((p) => p !== null).map((xyz) => new Point(...xyz));
        const planes = builder.create(points[0], points[1], points[2], points[3] ?? null, quad.jaggedness);
        for (const plane of planes) {
            if (plane instanceof Wall) {
                walls.push(plane);
            } else if (plane instanceof Floor) {
                floors.push(plane);
            }
        }
    }

    return {
        getWalls: () => walls,
        getFloors: () => floors,
        getSpawnPositionAttacker: () => json.spawnAttackers.map((xyz) => new Point(...xyz)),
        getSpawnPositionDefender: () => json.spawnDefenders.map((xyz) => new Point(...xyz)),
        getSpawnRotationAttacker: () => 0,
        getSpawnRotationDefender: () => 0,
        getStartingPointsForNavigationMesh: () => [
            new Point(...json.spawnAttackers[0]),
            new Point(...json.spawnDefenders[0]),
        ],
        generateNavigationMeshKey: (tileSize, colliderHeight) => `${tileSize}-${colliderHeight}`,
        getNavigationMesh: () => null,
        getPlantArea: () => null,
        getBuyArea: () => null,
    };
}

/** @type {?ReturnType<typeof buildMapFromJson>} */
let cachedMap = null;

function createMapFromJson(json) {
    if (cachedMap === null) {
        cachedMap = buildMapFromJson(json);
    }
    return cachedMap;
}

test("default map json has 1139 quads", () => {
    expect(MAP_JSON.quads).toHaveLength(1139);
});

test("loadMap populates wall and floor buckets", () => {
    const world = new World(createGameStub());
    const map = createMapFromJson(MAP_JSON);
    const planeCount = world.loadMap(map);
    const walls = world.getWalls();
    const floors = world.getFloors();

    expect(planeCount).toBe(walls.length + floors.length);
    expect(planeCount).toBeGreaterThan(0);
    expect(walls.length).toBeGreaterThan(0);
    expect(floors.length).toBeGreaterThan(0);
    expect(Object.keys(world.walls).sort()).toEqual(["xy", "zy"]);
    expect(Object.keys(world.floors).length).toBeGreaterThan(0);
}, 60000);

test("isFloorAt on known floor quad of the map", () => {
    const world = new World(createGameStub());
    world.loadMap(createMapFromJson(MAP_JSON));

    const floor = world.isFloorAt(new Point(11550, 1187, 12570));
    expect(floor).not.toBeNull();
    expect(floor).toBeInstanceOf(Floor);
    // no floor at this height exists on the map
    expect(world.isFloorAt(new Point(11550, 5000, 12570))).toBeNull();
}, 60000);

test("isWallAt on known wall quad of the map", () => {
    const world = new World(createGameStub());
    world.loadMap(createMapFromJson(MAP_JSON));

    const wall = world.isWallAt(new Point(11333, 814, 9000));
    expect(wall).not.toBeNull();
    expect(wall).toBeInstanceOf(Wall);
}, 60000);

test("spawn positions: 10 attackers and 10 defenders", () => {
    const world = new World(createGameStub());
    const map = createMapFromJson(MAP_JSON);
    world.loadMap(map);

    const attackerSpawns = map.getSpawnPositionAttacker();
    expect(attackerSpawns).toHaveLength(10);
    for (let i = 0; i < attackerSpawns.length; i++) {
        expect(world.getPlayerSpawnPosition(true, false)).toEqual(attackerSpawns[i]);
    }
    expect(() => world.getPlayerSpawnPosition(true, false)).toThrow(GameException);
    expect(() => world.getPlayerSpawnPosition(true, false)).toThrow(
        "Cannot find free spawn position for 'attacker' player",
    );

    world.roundReset();
    expect(world.getPlayerSpawnPosition(true, false)).toEqual(attackerSpawns[0]);

    const defenderSpawns = map.getSpawnPositionDefender();
    expect(defenderSpawns).toHaveLength(10);
    for (let i = 0; i < defenderSpawns.length; i++) {
        expect(world.getPlayerSpawnPosition(false, false)).toEqual(defenderSpawns[i]);
    }
    expect(() => world.getPlayerSpawnPosition(false, false)).toThrow(GameException);
}, 60000);

test("random spawn rotation stays in range", () => {
    const world = new World(createGameStub());
    world.loadMap(createMapFromJson(MAP_JSON));

    expect(world.getPlayerSpawnRotationHorizontal(true, 0)).toBe(0);
    for (let i = 0; i < 50; i++) {
        const rotation = world.getPlayerSpawnRotationHorizontal(true, 5);
        expect(rotation).toBeGreaterThanOrEqual(-5);
        expect(rotation).toBeLessThanOrEqual(5);
    }
}, 60000);

test("spatial queries on a synthetic box", () => {
    const world = new World(createGameStub());
    world.addBox(new Box(new Point(0, 0, 0), 100, 100, 100));

    expect(world.getWalls()).toHaveLength(4);
    expect(world.getFloors()).toHaveLength(2);

    expect(world.isFloorAt(new Point(50, 0, 50))).toBeInstanceOf(Floor);
    expect(world.isFloorAt(new Point(50, 100, 50))).toBeInstanceOf(Floor);
    expect(world.isFloorAt(new Point(50, 50, 50))).toBeNull();
    expect(world.isFloorAt(new Point(-50, 0, 50))).toBeNull();

    expect(world.isWallAt(new Point(0, 50, 50))).toBeInstanceOf(Wall);
    expect(world.isWallAt(new Point(100, 50, 50))).toBeInstanceOf(Wall);
    expect(world.isWallAt(new Point(50, 50, 100))).toBeInstanceOf(Wall);
    expect(world.isWallAt(new Point(50, 50, 50))).toBeNull();
});

test("findFloorSquare and wall collision helpers", () => {
    const world = new World(createGameStub());
    world.addBox(new Box(new Point(0, 0, 0), 100, 100, 100));

    expect(world.findFloorSquare(new Point(50, 0, 50), 10)).toBeInstanceOf(Floor);
    expect(world.findFloorSquare(new Point(-50, 0, 50), 10)).toBeNull();
    expect(() => world.findFloorSquare(new Point(50, -1, 50), 10)).toThrow("Y value cannot be lower than zero");

    expect(world.checkXSideWallCollision(new Point(0, 0, 50), 50, 10)).toBeInstanceOf(Wall);
    expect(world.checkZSideWallCollision(new Point(50, 0, 0), 50, 10)).toBeInstanceOf(Wall);
    expect(world.checkXSideWallCollision(new Point(50, 0, 50), 50, 10)).toBeNull();
    expect(world.checkZSideWallCollision(new Point(50, 0, 50), 50, 10)).toBeNull();

    expect(world.findHighestWall(new Point(0, 0, 50), 100, 10, 50, true)).toBe(100);
    expect(world.findHighestWall(new Point(0, 0, 50), 100, 10, 200, true)).toBe(100);
    expect(world.findHighestWall(new Point(50, 0, 50), 100, 10, 50, true)).toBe(0);

    expect(world.isWallOrFloorCollision(new Point(50, 0, 50), new Point(50, 0, 55), 10)).toBe(true);
    expect(world.isWallOrFloorCollision(new Point(50, 0, 50), new Point(50, 0, 200), 10)).toBe(false);
});

test("flame and smoke volumetric interactions", () => {
    const world = new World(createGameStub());
    const min = new Point(0, 0, 0);
    const max = new Point(100, 100, 100);
    const flame = { boundaryMin: min, boundaryMax: max };

    expect(world.flameCanIgnite(flame)).toBe(true);

    const smokePart = { active: true, boundaryMin: min, boundaryMax: max };
    world.activeSmokes = { s1: { boundaryMin: min, boundaryMax: max, parts: [smokePart] } };
    expect(world.flameCanIgnite(flame)).toBe(false);

    const farMin = new Point(200, 0, 200);
    const farMax = new Point(300, 100, 300);
    world.activeSmokes = { s1: { boundaryMin: farMin, boundaryMax: farMax, parts: [smokePart] } };
    expect(world.flameCanIgnite(flame)).toBe(true);

    const extinguished = { active: true, boundaryMin: min, boundaryMax: max };
    const fire = {
        boundaryMin: min,
        boundaryMax: max,
        parts: [extinguished],
        extinguish(part) {
            part.active = false;
        },
    };
    world.activeMolotovs = { f1: fire };
    expect(world.isCollisionWithMolotov(new Point(50, 50, 50))).toBe(true);
    expect(world.isCollisionWithMolotov(new Point(500, 500, 500))).toBe(false);
    expect(world.activeMolotovExists()).toBe(true);

    world.smokeTryToExtinguishFlames(flame);
    expect(extinguished.active).toBe(false);
    expect(world.isCollisionWithMolotov(new Point(50, 50, 50))).toBe(false);
});

test("getMap throws before a map is loaded", () => {
    const world = new World(createGameStub());
    expect(() => world.getMap()).toThrow("No map is loaded!");
});
