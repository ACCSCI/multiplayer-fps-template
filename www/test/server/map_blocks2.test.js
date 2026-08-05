import { expect, mock, test } from "bun:test";
import { Box } from "../../assets/js/server/box.js";
import { BoxGroup } from "../../assets/js/server/box_group.js";
import { Column } from "../../assets/js/server/column.js";
import { DynamicFloor } from "../../assets/js/server/dynamic_floor.js";
import { RampDirection } from "../../assets/js/server/enums.js";
import { Floor } from "../../assets/js/server/floor.js";
import { GameException } from "../../assets/js/server/game_exception.js";
import { Point } from "../../assets/js/server/point.js";
import { Ramp } from "../../assets/js/server/ramp.js";

/** PHP BaseTest::assertPositionSame() */
function expectPositionSame(expected, actual) {
    expect(actual.x).toBe(expected.x);
    expect(actual.y).toBe(expected.y);
    expect(actual.z).toBe(expected.z);
}

// --- Ramp ---

test("ramp grows along positive Z", () => {
    const ramp = new Ramp(new Point(0, 0, 0), RampDirection.GROW_TO_POSITIVE_Z, 3, 100, true, 20, 20);
    expect(ramp.stepCount).toBe(3);
    expect(ramp.stepWidth).toBe(100);
    expect(ramp.stepDepth).toBe(20);
    expect(ramp.stepHeight).toBe(20);

    const boxes = ramp.getBoxes();
    expect(boxes).toHaveLength(3);
    expectPositionSame(new Point(0, 0, 0), boxes[0].getBase());
    expect(boxes[0].widthX).toBe(100);
    expect(boxes[0].heightY).toBe(20);
    expect(boxes[0].depthZ).toBe(20);
    expectPositionSame(new Point(0, 0, 20), boxes[1].getBase());
    expect(boxes[1].heightY).toBe(40);
    expectPositionSame(new Point(0, 0, 40), boxes[2].getBase());
    expect(boxes[2].heightY).toBe(60);
});

test("ramp growing down", () => {
    const ramp = new Ramp(new Point(0, 0, 0), RampDirection.GROW_TO_POSITIVE_Z, 3, 100, false, 20, 20);
    const boxes = ramp.getBoxes();
    expectPositionSame(new Point(0, -60, 0), boxes[0].getBase());
    expect(boxes[0].heightY).toBe(60);
    expectPositionSame(new Point(0, -60, 20), boxes[1].getBase());
    expect(boxes[1].heightY).toBe(40);
    expectPositionSame(new Point(0, -60, 40), boxes[2].getBase());
    expect(boxes[2].heightY).toBe(20);
});

test("ramp on X axis uses stepWidth as depth", () => {
    const ramp = new Ramp(new Point(10, 0, 10), RampDirection.GROW_TO_NEGATIVE_X, 2, 100, true, 20, 20);
    const boxes = ramp.getBoxes();
    expectPositionSame(new Point(10, 0, 10), boxes[0].getBase());
    expect(boxes[0].widthX).toBe(20);
    expect(boxes[0].heightY).toBe(20);
    expect(boxes[0].depthZ).toBe(100);
    expectPositionSame(new Point(-10, 0, 10), boxes[1].getBase());
    expect(boxes[1].heightY).toBe(40);
});

test("ramp directions", () => {
    const cases = [
        [RampDirection.GROW_TO_POSITIVE_Z, new Point(0, 0, 20)],
        [RampDirection.GROW_TO_NEGATIVE_Z, new Point(0, 0, -20)],
        [RampDirection.GROW_TO_POSITIVE_X, new Point(20, 0, 0)],
        [RampDirection.GROW_TO_NEGATIVE_X, new Point(-20, 0, 0)],
    ];
    for (const [direction, expectedBase] of cases) {
        const ramp = new Ramp(new Point(0, 0, 0), direction, 2, 100, true, 20, 20);
        expectPositionSame(expectedBase, ramp.getBoxes()[1].getBase());
    }
});

test("ramp defaults", () => {
    const ramp = new Ramp(new Point(0, 0, 0), RampDirection.GROW_TO_POSITIVE_X, 2, 50);
    expect(ramp.stepDepth).toBe(20);
    expect(ramp.stepHeight).toBe(20);
    const boxes = ramp.getBoxes();
    expectPositionSame(new Point(0, 0, 0), boxes[0].getBase());
    expect(boxes[0].widthX).toBe(20);
    expect(boxes[0].depthZ).toBe(50);
    expectPositionSame(new Point(20, 0, 0), boxes[1].getBase());
});

// --- Column ---

test("column", () => {
    const center = new Point(5, 5, 5);
    const column = new Column(center, 3, 10);
    expect(column.active).toBe(true);
    expect(column.center).toBe(center);
    expect(column.radius).toBe(3);
    expect(column.height).toBe(10);
    expectPositionSame(new Point(5, 15, 5), column.highestPoint);
    expectPositionSame(new Point(2, 5, 2), column.boundaryMin);
    expectPositionSame(new Point(8, 15, 8), column.boundaryMax);
});

// --- BoxGroup ---

test("box group", () => {
    const width = 19;
    const height = 79;
    const depth = 41;
    const point = new Point(10, 20, 50);

    const box = new Box(point, width, height, depth);
    const boxGroup = new BoxGroup();
    expect(boxGroup.contains(new Point())).toBe(false);
    boxGroup.add(box);
    expect(boxGroup.contains(new Point(10, 20, 50))).toBe(true);
    expect(boxGroup.contains(new Point(11, 21, 51))).toBe(true);
    expect(boxGroup.contains(new Point(9, 19, 49))).toBe(false);
    expect(boxGroup.toArray()).toEqual([{ width, height, depth, x: 10, y: 20, z: 50 }]);
    boxGroup.add(new Box(new Point(), 1, 2, 3));
    expect(boxGroup.contains(new Point(5, 10, 20))).toBe(false);
});

test("box group constructor with boxes and boundary", () => {
    const box = new Box(new Point(11, 12, 13), 1000, 2000, 1000);
    const boxGroup = new BoxGroup([box]);
    expectPositionSame(new Point(11, 12, 13), boxGroup.boundaryMin);
    expectPositionSame(new Point(1011, 2012, 1013), boxGroup.boundaryMax);
    expect(boxGroup.contains(new Point(11, 12, 13))).toBe(true);
    expect(boxGroup.contains(new Point(1010, 2011, 1012))).toBe(true);
    // PHP pointWithBox boundary is inclusive at the max edge
    expect(boxGroup.contains(new Point(1011, 2012, 1013))).toBe(true);
});

test("box group fromArray", () => {
    const box = new Box(new Point(1, 2, 3), 10, 20, 30);
    const boxGroup = new BoxGroup();
    boxGroup.add(box);
    const data = boxGroup.toArray();
    // Faithful PHP quirk: the constructor re-adds the given boxes (PHP foreach
    // iterates a copy of the array), so a group built from array data holds
    // each box twice.
    const restored = BoxGroup.fromArray(data);
    expect(restored.toArray()).toEqual([...data, ...data]);
    expect(restored.contains(new Point(1, 2, 3))).toBe(true);
    expect(restored.contains(new Point(11, 22, 33))).toBe(true);
    expect(restored.contains(new Point(12, 22, 33))).toBe(false);
});

// --- DynamicFloor ---

function createPlayerMock(overrides = {}) {
    const position = new Point(10, 20, 30);
    return {
        position,
        headHeight: 190,
        alive: true,
        boundingRadius: 60,
        getReferenceToPosition() {
            return this.position;
        },
        getHeadHeight() {
            return this.headHeight;
        },
        isAlive() {
            return this.alive;
        },
        getBoundingRadius() {
            return this.boundingRadius;
        },
        ...overrides,
    };
}

test("dynamic floor basics", () => {
    const player = createPlayerMock();
    const floor = new DynamicFloor(player);
    expect(floor).toBeInstanceOf(Floor);
    expect(floor).toBeInstanceOf(DynamicFloor);
    expect(floor.getPlayer()).toBe(player);
    expect(floor.getY()).toBe(20 + 190 + 1);
});

test("dynamic floor intersect", () => {
    const player = createPlayerMock();
    const floor = new DynamicFloor(player);
    // point exactly on top of the player's head
    expect(floor.intersect(new Point(10, 211, 30), 5)).toBe(true);
    expect(floor.intersect(new Point(10, 211, 30), 0)).toBe(true);
    // outside the circle around the player
    expect(floor.intersect(new Point(10, 211, 100), 5)).toBe(false);
    // wrong height
    expect(floor.intersect(new Point(10, 210, 30), 5)).toBe(false);
    // dead player
    player.alive = false;
    expect(floor.intersect(new Point(10, 211, 30), 5)).toBe(false);
});

test("dynamic floor follows player reference", () => {
    const player = createPlayerMock();
    const floor = new DynamicFloor(player);
    player.position.addY(50);
    expect(floor.getY()).toBe(70 + 190 + 1);
    expect(floor.intersect(new Point(10, 261, 30), 5)).toBe(true);
});

test("dynamic floor invalid methods", () => {
    const floor = new DynamicFloor(createPlayerMock());
    expect(() => floor.getHitAntiForce(new Point())).toThrow(GameException);
    expect(() => floor.getPlane()).toThrow(GameException);
});

// --- PlayerCollider ---

class MockHitBox {
    constructor(player, type, geometry) {
        this.player = player;
        this.type = type;
        this.geometry = geometry;
        this.resetCalls = 0;
        this.registerHits = [];
        this.intersectCalls = 0;
        this.intersectResult = false;
    }

    reset() {
        this.resetCalls++;
    }

    intersect(point) {
        this.intersectCalls++;
        this.lastIntersectPoint = point;
        return this.intersectResult;
    }

    registerHit(bullet) {
        this.registerHits.push(bullet);
    }
}

const geometryClasses = {
    hit_box: "HitBox",
    hit_box_head: "HitBoxHead",
    hit_box_back: "HitBoxBack",
    hit_box_stomach: "HitBoxStomach",
    hit_box_chest: "HitBoxChest",
    hit_box_legs: "HitBoxLegs",
};
for (const [file, exportName] of Object.entries(geometryClasses)) {
    mock.module(`../../assets/js/server/${file}.js`, () => {
        const cls = file === "hit_box" ? MockHitBox : class {};
        return { [exportName]: cls };
    });
}

const { PlayerCollider } = await import("../../assets/js/server/player_collider.js");
const { HitBoxType } = await import("../../assets/js/server/enums.js");

function createColliderPlayerMock() {
    const position = new Point(10, 20, 30);
    return {
        id: 7,
        position,
        headHeight: 190,
        alive: true,
        boundingRadius: 60,
        getId() {
            return this.id;
        },
        getReferenceToPosition() {
            return this.position;
        },
        getHeadHeight() {
            return this.headHeight;
        },
        isAlive() {
            return this.alive;
        },
        getBoundingRadius() {
            return this.boundingRadius;
        },
    };
}

test("player collider construction", () => {
    const player = createColliderPlayerMock();
    const collider = new PlayerCollider(player);
    expect(collider.playerId).toBe(7);
    expect(collider.getPlayer()).toBe(player);
    const hitBoxes = collider.getHitBoxes();
    expect(hitBoxes).toHaveLength(5);
    expect(hitBoxes.map((hitBox) => hitBox.type)).toEqual([
        HitBoxType.HEAD,
        HitBoxType.BACK,
        HitBoxType.STOMACH,
        HitBoxType.CHEST,
        HitBoxType.LEG,
    ]);
    for (const hitBox of hitBoxes) {
        expect(hitBox.player).toBe(player);
        expect(typeof hitBox.geometry).toBe("object");
        expect(hitBox.geometry).not.toBeNull();
    }
});

test("player collider round reset", () => {
    const collider = new PlayerCollider(createColliderPlayerMock());
    const hitBoxes = collider.getHitBoxes();
    for (const hitBox of hitBoxes) {
        expect(hitBox.resetCalls).toBe(0);
    }
    collider.roundReset();
    for (const hitBox of hitBoxes) {
        expect(hitBox.resetCalls).toBe(1);
    }
});

test("player collider tryHitPlayer", () => {
    const collider = new PlayerCollider(createColliderPlayerMock());
    const hitBoxes = collider.getHitBoxes();
    hitBoxes[2].intersectResult = true;
    const appliedStates = [];
    const backtrack = {
        getStates() {
            return [1, 2];
        },
        apply(state, playerId) {
            appliedStates.push([state, playerId]);
        },
    };
    const bullet = { damage: 25 };

    const hit = collider.tryHitPlayer(bullet, new Point(10, 21, 30), backtrack);
    expect(hit).toBe(hitBoxes[2]);
    expect(appliedStates).toEqual([[1, 7]]);
    expect(hitBoxes[2].registerHits).toEqual([bullet]);
    expect(hitBoxes[2].lastIntersectPoint).toEqual({ x: 10, y: 21, z: 30 });
    expect(hitBoxes[0].intersectCalls).toBe(1);
    expect(hitBoxes[1].intersectCalls).toBe(1);
});

test("player collider tryHitPlayer cylinder miss", () => {
    const collider = new PlayerCollider(createColliderPlayerMock());
    const hitBoxes = collider.getHitBoxes();
    const backtrack = {
        getStates() {
            return [1];
        },
        apply() {},
    };

    const hit = collider.tryHitPlayer({}, new Point(10, 21, 3000), backtrack);
    expect(hit).toBeNull();
    for (const hitBox of hitBoxes) {
        expect(hitBox.intersectCalls).toBe(0);
    }
});

test("player collider tryHitPlayer across backtrack states", () => {
    const player = createColliderPlayerMock();
    const collider = new PlayerCollider(player);
    const hitBoxes = collider.getHitBoxes();
    hitBoxes[0].intersectResult = true;
    const appliedStates = [];
    const backtrack = {
        getStates() {
            return [1, 2];
        },
        apply(state) {
            appliedStates.push(state);
            if (state === 1) {
                player.position.set(10, 21, 3000);
            } else {
                player.position.set(10, 21, 30);
            }
        },
    };

    const hit = collider.tryHitPlayer({}, new Point(10, 21, 30), backtrack);
    expect(hit).toBe(hitBoxes[0]);
    expect(appliedStates).toEqual([1, 2]);
});

test("player collider boundary collision", () => {
    const player = createColliderPlayerMock();
    const collider = new PlayerCollider(player);
    expect(collider.isBoundaryCollision(new Point(10, 20, 30), 5, 10)).toBe(true);
    expect(collider.isBoundaryCollision(new Point(1000, 20, 30), 5, 10)).toBe(false);
    player.alive = false;
    expect(collider.isBoundaryCollision(new Point(10, 20, 30), 5, 10)).toBe(false);
});
