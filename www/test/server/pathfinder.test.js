import { afterAll, beforeAll, expect, test } from "bun:test";
import { Box } from "../../assets/js/server/box.js";
import { Floor } from "../../assets/js/server/floor.js";
import { NavigationMesh } from "../../assets/js/server/navigation_mesh.js";
import { PathFinder } from "../../assets/js/server/path_finder.js";
import { Point } from "../../assets/js/server/point.js";
import { loadConstants } from "../../assets/js/server/setting.js";
import { Wall } from "../../assets/js/server/wall.js";
import { World } from "../../assets/js/server/world/index.js";
import { restoreDefaultSettings } from "./player_test_utils.js";

// Ports test/og/World/NavigationMeshTest.php.
// BaseTestCase::setUp() loads these constants (playerObstacleOvercomeHeight 20
// matters for PathFinder; playerBoundingRadius 44 for the World tile check).
// beforeAll/afterAll 保证常量只在本文件生效,不污染同 worker 的其他测试文件。
beforeAll(() => {
    loadConstants({
        moveOneMs: 5,
        moveWalkOneMs: 4,
        moveCrouchOneMs: 3,
        fallAmountOneMs: 6,
        crouchDurationMs: 40,
        jumpDurationMs: 50,
        throwSpeed: 20,
        playerVelocity: 0,
        playerHeadRadius: 10,
        playerBoundingRadius: 44,
        playerJumpHeight: 150,
        playerHeadHeightStand: 190,
        playerHeadHeightCrouch: 140,
        playerObstacleOvercomeHeight: 20,
        playerFallDamageThreshold: 500,
    });
});
afterAll(restoreDefaultSettings);

/** Minimal TestMap port: giant floor at y=0, two boundary walls, one navmesh start point. */
class MockTestMap {
    constructor() {
        this.startPointForNavigationMesh = new Point(100, 0, 100);
    }

    getStartingPointsForNavigationMesh() {
        return [this.startPointForNavigationMesh];
    }

    getWalls() {
        return [
            new Wall(new Point(0, 0, -1), true, 99999).setPenetrable(false),
            new Wall(new Point(-1, 0, 0), false, 99999).setPenetrable(false),
        ];
    }

    getFloors() {
        return [new Floor(new Point(), 99999, 99999).setPenetrable(false)];
    }
}

/** World with the TestMap loaded, ready for boxes/floors/walls. */
function createWorld() {
    const world = new World({ bomb: null });
    world.loadMap(new MockTestMap());
    return world;
}

test("convert point to nav mesh point", () => {
    const data = new Map([
        [
            3,
            [
                ["2,0,2", new Point(1, 0, 1)],
                ["2,0,2", new Point(2, 0, 2)],
                ["2,0,2", new Point(3, 0, 3)],
                ["5,0,2", new Point(4, 0, 1)],
                ["5,0,2", new Point(5, 0, 1)],
                ["5,0,2", new Point(6, 0, 1)],
                ["8,0,5", new Point(9, 0, 4)],
            ],
        ],
        [
            31,
            [
                ["16,0,16", new Point(3, 0, 1)],
                ["47,0,16", new Point(32, 0, 2)],
                ["47,0,16", new Point(42, 0, 17)],
                ["47,0,47", new Point(42, 0, 59)],
                ["47,0,47", new Point(59, 0, 59)],
                ["47,0,47", new Point(59, 0, 59)],
                ["326,333,326", new Point(333, 333, 333)],
                ["450,0,295", new Point(450, 0, 285)],
                ["450,0,295", new Point(461, 0, 285)],
                ["1566,50,16", new Point(1570, 50, 26)],
            ],
        ],
    ]);
    const world = new World({ bomb: null });
    for (const [tileSize, tests] of data) {
        const finder = new PathFinder(world, new NavigationMesh(tileSize, 10));
        for (const [expected, point] of tests) {
            finder.convertToNavMeshNode(point);
            expect(point.hash(), `Size ${tileSize} point`).toBe(expected);
        }
    }
});

test("simple navigation mesh", () => {
    const world = createWorld();
    world.addBox(new Box(new Point(), 10, 1000, 10));
    world.getMap().startPointForNavigationMesh.set(5, 0, 5);

    const path = world.buildNavigationMesh(3, 100);
    expect(path.getGraph().getNodesCount()).toBe(9);
    expect(path.getGraph().getEdgeCount()).toBe(24);

    const start = new Point(4, 0, 1);
    path.convertToNavMeshNode(start);
    const startNode = path.getGraph().getNodeById(start.hash());
    expect(startNode).not.toBeNull();
    expect(path.getNavigationMesh().getGeneratedNeighbors(startNode.getId())).toHaveLength(3);
    const neighbors = path.getGraph().generateNeighbors();
    expect(Object.keys(neighbors)).toHaveLength(9);
    expect(neighbors[startNode.getId()]).toHaveLength(3);
});

test("boundary", () => {
    const world = createWorld();
    world.addBox(new Box(new Point(), 10, 1000, 10));
    const boxPoint = new Point(5, 0, 1);
    world.addBox(new Box(boxPoint, 10, 1000, 10));
    world.getMap().startPointForNavigationMesh.set(1, 0, 9);
    const path = world.buildNavigationMesh(3, 100);

    const candidate = boxPoint.clone().addX(-1).setZ(5);
    expect(path.getGraph().getNodeById(candidate.hash())).toBeNull();

    const closestCandidate = candidate.clone();
    path.convertToNavMeshNode(closestCandidate);
    expect(path.getGraph().getNodeById(closestCandidate.hash())).toBeNull();

    const validPoint = path.findTile(candidate, 1);
    expect(validPoint).not.toBeNull();
    expect(validPoint.x).toBeLessThan(closestCandidate.x);
    expect(path.getGraph().getNodeById(validPoint.hash())).not.toBeNull();
    expect(validPoint.hash()).toBe("2,0,5");

    const orig = candidate.clone();
    candidate.addX(-1);
    const validPoint2 = path.findTile(candidate, 1);
    expect(validPoint2).not.toBeNull();
    expect(validPoint2.x).toBeLessThan(closestCandidate.x);
    expect(path.getGraph().getNodeById(validPoint2.hash())).not.toBeNull();
    expect(validPoint2.hash()).toBe("2,0,5");

    expect(candidate.hash()).not.toBe("2,0,5");
    path.convertToNavMeshNode(candidate);
    expect(candidate.hash()).toBe("2,0,5");
    expect([orig.x, orig.y, orig.z]).not.toEqual([candidate.x, candidate.y, candidate.z]);
});

test("boundary above", () => {
    const world = createWorld();
    world.addBox(new Box(new Point(), 10, 1000, 10));
    const start = new Point(1, 1, 1);
    world.addBox(new Box(start.clone(), 1, 1, 10));
    world.getMap().startPointForNavigationMesh.setFrom(start);
    const path = world.buildNavigationMesh(3, 100);

    const candidate = start.clone().setY(0);
    expect(path.getGraph().getNodeById(candidate.hash())).toBeNull();

    const closestCandidate = candidate.clone();
    path.convertToNavMeshNode(closestCandidate);
    expect(path.getGraph().getNodeById(closestCandidate.hash())).toBeNull();

    const validPoint = path.findTile(candidate, 1);
    expect(validPoint).not.toBeNull();
    expect(path.getGraph().getNodeById(validPoint.hash())).not.toBeNull();
    expect(validPoint.hash()).toBe("2,1,2");
});

test("neighbours share same node reference", () => {
    const world = createWorld();
    world.getMap().startPointForNavigationMesh.set(1, 0, 1);
    world.addBox(new Box(new Point(), 7, 1000, 4));
    const path = world.buildNavigationMesh(3, 10);
    const graph = path.getGraph();
    expect(graph.getNodesCount()).toBe(2);
    expect(graph.getEdgeCount()).toBe(2);
    const node1 = graph.getNodeById("2,0,2");
    expect(node1).not.toBeNull();
    const node2 = graph.getNodeById("5,0,2");
    expect(node2).not.toBeNull();
    const node1neighbours = graph.getNeighbors(node1);
    const node2neighbours = graph.getNeighbors(node2);
    expect(node1neighbours).toHaveLength(1);
    expect(node2neighbours).toHaveLength(1);
    expect(node1neighbours[0]).toBe(node2);
    expect(node2neighbours[0]).toBe(node1);
});

test("wall boundary", () => {
    const world = createWorld();
    world.getMap().startPointForNavigationMesh.set(1, 0, 1);
    world.addBox(new Box(new Point(), 5, 1000, 4));
    const path = world.buildNavigationMesh(3, 10);
    const graph = path.getGraph();
    expect(graph.getNodesCount()).toBe(1);
    expect(graph.getEdgeCount()).toBe(0);

    const node = graph.getNodeById("2,0,2");
    expect(node).not.toBeNull();
    expect(graph.getNeighbors(node)).toHaveLength(0);
});

test("under nav mesh", () => {
    const world = createWorld();
    const expectedPoint = new Point(2, 2, 2);
    world.getMap().startPointForNavigationMesh.set(1, 2, 1);
    world.addBox(new Box(new Point(), 5, 1000, 7));
    world.addFloor(new Floor(new Point(2, 2, 0), 10, 10));

    const path = world.buildNavigationMesh(3, 10);
    const graph = path.getGraph();

    const nodes = graph.getNodes();
    expect(nodes).toHaveLength(2);
    expect(graph.getEdgeCount()).toBe(2);
    const node = graph.getNodeById("2,2,2");
    expect(node).not.toBeNull();
    expect(nodes[0]).toBe(node);
    const nodePosition = node.getData();
    expect([nodePosition.x, nodePosition.y, nodePosition.z]).toEqual([
        expectedPoint.x,
        expectedPoint.y,
        expectedPoint.z,
    ]);

    const tilePoint = path.findTile(new Point(1, 0, 1), 1);
    expect(tilePoint).not.toBeNull();
    expect([tilePoint.x, tilePoint.y, tilePoint.z]).toEqual([expectedPoint.x, expectedPoint.y, expectedPoint.z]);
    expect(path.findTile(new Point(20, 0, 1), 1)).toBeNull();
});

test("deep hole", () => {
    const world = createWorld();
    world.getMap().startPointForNavigationMesh.set(1, 1000, 1);
    world.addBox(new Box(new Point(), 10, 2000, 10));
    world.addFloor(new Floor(new Point(1, 1000, 1), 1, 1));

    const path = world.buildNavigationMesh(3, 10);
    expect(path.getGraph().getNodesCount()).toBe(1);
    expect(path.getGraph().getEdgeCount()).toBe(0);
});

test("wall without floor on top", () => {
    const world = createWorld();
    world.getMap().startPointForNavigationMesh.set(1, 0, 1);
    world.addBox(new Box(new Point(), 10, 2000, 10));
    world.addWall(new Wall(new Point(5, -3, 5), true, 1, 6));

    expect(() => world.buildNavigationMesh(3, 10)).toThrow(/Wall we can step over but no floor there/);
});

test("one way direction", () => {
    const world = createWorld();
    const height = World.GRENADE_NAVIGATION_MESH_OBJECT_HEIGHT;
    const doubleHeight = height * 2;
    world.addBox(new Box(new Point(), 10, 1000, 10));

    world.addBox(new Box(new Point(7, 0, 0), 10, doubleHeight, 10));
    world.addBox(new Box(new Point(7, 0, 0), 10, 1000, 10));
    world.getMap().startPointForNavigationMesh.set(8, doubleHeight, 8);

    const path = world.buildNavigationMesh(3, height);
    expect(path.getGraph().getNodesCount()).toBe(9);
    expect(path.getGraph().getEdgeCount()).toBe(21);

    const start = new Point(4, 0, 1);
    path.convertToNavMeshNode(start);
    const startNode = path.getGraph().getNodeById(start.hash());
    expect(startNode).not.toBeNull();
    expect(path.getGraph().getNeighbors(startNode)).toHaveLength(2);

    const stepNode = path.getGraph().getNodeById(new Point(8, doubleHeight, 8).hash());
    expect(stepNode).not.toBeNull();
    expect(path.getGraph().shortestPathDijkstra(startNode, stepNode)).toEqual({ path: [], cost: Infinity });
    expect(path.getGraph().shortestPathDijkstra(stepNode, startNode)).toEqual({
        path: [`8,${doubleHeight},8`, "5,0,8", "5,0,5", "5,0,2"],
        cost: 3,
    });

    const skyNode = path.getGraph().getNodeById(new Point(8, 1000, 4).hash());
    expect(skyNode).toBeNull();
});

test("navigation mesh serialize roundtrip", () => {
    const mesh = new NavigationMesh(31, 80);
    mesh.setData({ "2,0,2": ["5,0,2"], "5,0,2": ["2,0,2"] });
    const restored = NavigationMesh.unserialize(mesh.serialize());
    expect(restored.tileSize).toBe(31);
    expect(restored.colliderHeight).toBe(80);
    expect(restored.tileSizeHalf).toBe(15);
    expect(restored.getGeneratedNeighbors("2,0,2")).toEqual(["5,0,2"]);
    expect(restored.has("5,0,2")).toBe(true);
    expect(restored.has("missing")).toBe(false);
});

test("navigation mesh invalid tile size", () => {
    expect(() => new NavigationMesh(2, 80)).toThrow(/odd and greater than 1/);
    expect(() => new NavigationMesh(8, 80)).toThrow(/odd and greater than 1/);
    expect(() => new NavigationMesh(0, 80)).toThrow(/odd and greater than 1/);
});
