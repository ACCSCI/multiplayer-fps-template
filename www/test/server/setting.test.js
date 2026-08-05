import { expect, test } from "bun:test";
import { Box } from "../../assets/js/server/box.js";
import { Floor } from "../../assets/js/server/floor.js";
import { GameException } from "../../assets/js/server/game_exception.js";
import { Plane } from "../../assets/js/server/plane.js";
import { Point } from "../../assets/js/server/point.js";
import {
    crouchDistancePerTick,
    fallAmountPerTick,
    flyingMovementSpeedMultiplier,
    getDataArray,
    getWeaponPrimarySpeedMultiplier,
    getWeaponSecondarySpeedMultiplier,
    jumpDistancePerTick,
    jumpMovementSpeedMultiplier,
    loadConstants,
    moveDistanceCrouchPerTick,
    moveDistancePerTick,
    moveDistanceWalkPerTick,
    playerBoundingRadius,
    playerFallDamageThreshold,
    playerHeadHeightCrouch,
    playerHeadHeightStand,
    playerHeadRadius,
    playerJumpHeight,
    playerObstacleOvercomeHeight,
    playerVelocity,
    throwSpeed,
    tickCountCrouch,
    tickCountJump,
} from "../../assets/js/server/setting.js";
import { setTickRate } from "../../assets/js/server/util.js";
import { Wall } from "../../assets/js/server/wall.js";

// Setting tests (tick rate 20 default, matching PHP)

test("Setting derived constants at tick rate 20", () => {
    expect(tickCountCrouch()).toBe(13); // ceil(250 / 20)
    expect(fallAmountPerTick()).toBe(20); // ceil(1 * 20)
    expect(tickCountJump()).toBe(21); // ceil(420 / 20)
    expect(jumpDistancePerTick()).toBe(9); // ceil(170 / 21)
    expect(crouchDistancePerTick()).toBe(4); // ceil((190 - 140) / 13)
    expect(moveDistancePerTick()).toBe(12); // ceil(0.60 * 20)
    expect(moveDistanceWalkPerTick()).toBe(7); // ceil(0.34 * 20)
    expect(moveDistanceCrouchPerTick()).toBe(4); // ceil(0.20 * 20)
    expect(jumpMovementSpeedMultiplier()).toBe(1.0);
    expect(flyingMovementSpeedMultiplier()).toBe(0.8);
    expect(getWeaponPrimarySpeedMultiplier(5)).toBe(0.6);
    expect(getWeaponSecondarySpeedMultiplier(5)).toBe(0.8);
});

test("Setting plain values", () => {
    expect(throwSpeed()).toBe(40);
    expect(playerVelocity()).toBe(100);
    expect(playerHeadRadius()).toBe(10);
    expect(playerBoundingRadius()).toBe(60);
    expect(playerJumpHeight()).toBe(170);
    expect(playerHeadHeightStand()).toBe(190);
    expect(playerHeadHeightCrouch()).toBe(140);
    expect(playerObstacleOvercomeHeight()).toBe(30);
    expect(playerFallDamageThreshold()).toBe(500);
});

test("Setting loadConstants merges defaults and clears caches", () => {
    loadConstants({ moveOneMs: 1.0, "weaponPrimarySpeedMultiplier-5": 1.2 });
    expect(moveDistancePerTick()).toBe(20); // ceil(1.0 * 20)
    expect(getWeaponPrimarySpeedMultiplier(5)).toBe(1.2);
    expect(getWeaponPrimarySpeedMultiplier(6)).toBe(0.6);
    // PHP BC code: playerVelocity ?? 0 is assigned before defaults backfill, so
    // an absent playerVelocity stays 0 while other defaults are backfilled.
    expect(playerVelocity()).toBe(0);
    expect(playerHeadRadius()).toBe(10); // default backfill
    loadConstants({ playerVelocity: 500 });
    expect(playerVelocity()).toBe(500);
    expect(moveDistancePerTick()).toBe(12); // cache cleared: back to default
});

test("Setting tick rate affects derived constants", () => {
    setTickRate(10);
    expect(tickCountCrouch()).toBe(25); // ceil(250 / 10)
    setTickRate(20);
    loadConstants({ ...getDataArray() });
});

// Box / Plane / Wall / Floor tests ported from test/og/Unit/BoxTest.php

test("box construction", () => {
    const width = 19;
    const height = 79;
    const depth = 41;
    const point = new Point(10, 20, 50);

    const box = new Box(point, width, height, depth);
    const walls = box.getWalls();
    const floors = box.getFloors();
    expect(walls).toHaveLength(4);
    expect(floors).toHaveLength(2);

    const bottomFloor = floors[0];
    expect(bottomFloor.getY()).toBe(point.y);
    expect(bottomFloor.getStart().toFlatArray()).toEqual(point.toFlatArray());
    expect(bottomFloor.getEnd().toFlatArray()).toEqual([point.x + width, point.y, point.z + depth]);
    const topFloor = floors[1];
    expect(topFloor.getY()).toBe(point.y + height);
    expect(topFloor.getStart().toFlatArray()).toEqual([point.x, point.y + height, point.z]);
    expect(topFloor.getEnd().toFlatArray()).toEqual([point.x + width, point.y + height, point.z + depth]);

    const frontWall = walls[0];
    expect(frontWall.getStart().toFlatArray()).toEqual(point.toFlatArray());
    expect(frontWall.getEnd().toFlatArray()).toEqual([point.x + width, point.y + height, point.z]);
    const backWall = walls[1];
    expect(backWall.getStart().toFlatArray()).toEqual([point.x, point.y, point.z + depth]);
    expect(backWall.getEnd().toFlatArray()).toEqual([point.x + width, point.y + height, point.z + depth]);
    const leftWall = walls[2];
    expect(leftWall.getStart().toFlatArray()).toEqual(point.toFlatArray());
    expect(leftWall.getEnd().toFlatArray()).toEqual([point.x, point.y + height, point.z + depth]);
    const rightWall = walls[3];
    expect(rightWall.getStart().toFlatArray()).toEqual([point.x + width, point.y, point.z]);
    expect(rightWall.getEnd().toFlatArray()).toEqual([point.x + width, point.y + height, point.z + depth]);

    expect(box.toArray()).toEqual({
        width,
        height,
        depth,
        x: point.x,
        y: point.y,
        z: point.z,
    });
    expect(Box.fromArray(box.toArray()).toArray()).toEqual(box.toArray());
});

test("box plane counts and throw", () => {
    const topOnly = new Box(new Point(), 100, 100, 100, Box.SIDE_TOP);
    expect(topOnly.getFloors()).toHaveLength(1);
    expect(topOnly.getWalls()).toHaveLength(0);
    expect(() => new Box(new Point(), 1, 1, 1, 0)).toThrow("Choose at least one box side");
});

test("box penetrable param propagation", () => {
    const box = new Box(new Point(), 100, 100, 100, Box.SIDE_BACK | Box.SIDE_BOTTOM);
    const plane = box.getWalls()[0];
    expect(plane).toBeInstanceOf(Wall);
    plane.setHitAntiForce(101, 12, 1);
    expect(plane.getHitAntiForce(box.getBase())).toBe(12);
    expect(plane.getHitAntiForce(box.getBase().clone().addX(50))).toBe(12);
    expect(plane.getHitAntiForce(box.getBase().clone().addY(50))).toBe(12);
    expect(plane.getHitAntiForce(box.getBase().clone().addPart(50, 50, 50))).toBe(101);

    const floor = box.getFloors()[0];
    expect(floor).toBeInstanceOf(Floor);
    floor.setHitAntiForce(101, 12, 1);
    expect(floor.getHitAntiForce(box.getBase())).toBe(12);
    expect(floor.getHitAntiForce(box.getBase().clone().addX(50))).toBe(12);
    expect(floor.getHitAntiForce(box.getBase().clone().addY(50))).toBe(12);
    expect(floor.getHitAntiForce(box.getBase().clone().addPart(50, 50, 50))).toBe(101);

    expect(() => floor.getHitAntiForce(box.getBase().addPart(-1, -1, -1))).toThrow(GameException);
});

test("box unpenetrable", () => {
    const box = new Box(new Point(), 100, 100, 100, Box.SIDE_BACK | Box.SIDE_BOTTOM, false);
    const plane = box.getWalls()[0];
    expect(Plane.MAX_HIT_ANTI_FORCE).toBe(99999);
    expect(plane.getHitAntiForce(box.getBase())).toBe(Plane.MAX_HIT_ANTI_FORCE);
    expect(plane.getHitAntiForce(box.getBase().clone().addPart(50, 50, 50))).toBe(Plane.MAX_HIT_ANTI_FORCE);
    expect(plane.getHitAntiForce(box.getBase().clone().addPart(-50, -50, -50))).toBe(Plane.MAX_HIT_ANTI_FORCE);
});

test("wall and floor behavior", () => {
    const wallHorizontal = new Wall(new Point(0, 0, 0), true, 2, 1);
    const wallVertical = new Wall(new Point(0, 0, 0), false, 2, 1);
    wallHorizontal.setHitAntiForce(123, 10, 1);
    expect(wallHorizontal.getNormal()).toEqual([0, 0]);
    expect(wallVertical.getNormal()).toEqual([90, 0]);
    expect(wallVertical.getNormalizedNormal(270, 0, 1000)).toEqual([1.0, 0.0, 0.0]);
    expect(wallVertical.getNormalizedNormal(90, 0, 1000)).toEqual([-1.0, 0.0, 0.0]);
    expect(wallVertical.getBase()).toBe(0);
    expect(wallVertical.isWidthOnXAxis()).toBe(false);
    expect(wallHorizontal.getFloor()).toBe(0);
    expect(wallHorizontal.getCeiling()).toBe(1);
    expect(wallHorizontal.getPlane()).toBe("xy");
    expect(wallVertical.getPlane()).toBe("zy");
    expect(() => new Wall(new Point(), true, 0, 1)).toThrow(GameException);
    expect(() => new Floor(new Point(), 0, 1)).toThrow(GameException);
    expect(() => new Floor(new Point(), 1, 0)).toThrow(GameException);

    const floor = new Floor(new Point(1, 0, 1), 5, 2);
    expect(floor.getY()).toBe(0);
    expect(floor.getNormal()).toEqual([0, 90]);
    expect(floor.getPoint2DStart().toArray()).toEqual({ x: 1, y: 1 });
    expect(floor.getPoint2DEnd().toArray()).toEqual({ x: 6, y: 3 });
    expect(floor.intersect(new Point(3, 0, 2), 2)).toBe(true);
    expect(floor.intersect(new Point(3, 1, 2), 2)).toBe(false);

    const serialized = floor.toArray();
    expect(Floor.fromArray(serialized).toArray()).toEqual(serialized);
    expect(Wall.fromArray(wallVertical.toArray()).getPlane()).toBe("zy");
});
