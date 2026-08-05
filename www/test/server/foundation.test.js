import { expect, test } from "bun:test";
import { GameException } from "../../assets/js/server/game_exception.js";
import { Point } from "../../assets/js/server/point.js";
import { Point2D } from "../../assets/js/server/point2d.js";
import {
    continuousPointsBetween,
    directionY,
    distanceFromOrigin,
    distanceSquared,
    getTickRate,
    lerpInt,
    lerpPoint,
    mapRange,
    millisecondsToFrames,
    movementXYZ,
    movementXZ,
    nearbyInt,
    normalizeAngle,
    normalizeAngleVertical,
    rotatePointX,
    rotatePointY,
    rotatePointZ,
    setTickRate,
    smallestDeltaAngle,
    stepsAndIncrements,
    worldAngle,
} from "../../assets/js/server/util.js";

// Util tests ported from server tests: test/og/Unit/UtilTest.php

test("millisecondsToFrames", () => {
    expect(millisecondsToFrames(0)).toBe(0);
    expect(millisecondsToFrames(1)).toBe(1);
    expect(millisecondsToFrames(20)).toBe(1);
    expect(millisecondsToFrames(21)).toBe(2);
    expect(millisecondsToFrames(250)).toBe(13);
    expect(() => millisecondsToFrames(-1)).toThrow("Negative time given");
    expect(() => millisecondsToFrames(-1)).toThrow(GameException);
});

test("tickRate get/set", () => {
    expect(getTickRate()).toBe(20);
    setTickRate(10);
    expect(getTickRate()).toBe(10);
    expect(millisecondsToFrames(25)).toBe(3);
    setTickRate(20);
    expect(millisecondsToFrames(25)).toBe(2);
});

test("normalizeAngle", () => {
    expect(normalizeAngle(360.0)).toBe(0.0);
    expect(normalizeAngle(720)).toBe(0.0);
    expect(normalizeAngle(-12.2)).toBe(347.8);
    expect(normalizeAngle(190.3)).toBe(190.3);
});

test("normalizeAngleVertical", () => {
    expect(normalizeAngleVertical(-91)).toBe(-90.0);
    expect(normalizeAngleVertical(-207.23)).toBe(-90.0);
    expect(normalizeAngleVertical(90.1)).toBe(90.0);
    expect(normalizeAngleVertical(43.1)).toBe(43.1);
});

test("movementXZ", () => {
    const hypotenuse = 15;
    expect(movementXZ(0, hypotenuse)).toEqual([0, 15]);
    expect(movementXZ(45, hypotenuse)).toEqual([11, 11]);
    expect(movementXZ(90, hypotenuse)).toEqual([15, 0]);
    expect(movementXZ(135, hypotenuse)).toEqual([11, -11]);
    expect(movementXZ(180, hypotenuse)).toEqual([0, -15]);
    expect(movementXZ(225, hypotenuse)).toEqual([-11, -11]);
    expect(movementXZ(270, hypotenuse)).toEqual([-15, 0]);
    expect(movementXZ(315, hypotenuse)).toEqual([-11, 11]);
    expect(movementXZ(359, hypotenuse)).toEqual([0, 15]);
});

test("movementXYZ", () => {
    expect(movementXYZ(45, 45, 1)).toEqual([1, 1, 1]);
    expect(movementXYZ(45, 45, 15)).toEqual([8, 11, 8]);
    expect(movementXYZ(22, 47, 7)).toEqual([2, 5, 5]);
    expect(movementXYZ(22, -47, 7)).toEqual([2, -5, 5]);
    expect(movementXYZ(77, 35, 60)).toEqual([48, 34, 11]);
    expect(movementXYZ(18, 23, 5)).toEqual([2, 2, 5]);
    expect(movementXYZ(45, -89, 5)).toEqual([0, -5, 0]);
    expect(movementXYZ(45, -89, 50)).toEqual([1, -50, 1]);
    expect(movementXYZ(45, -80, 50)).toEqual([6, -49, 6]);
    expect(movementXYZ(35, -70, 50)).toEqual([10, -47, 14]);
    for (let i = 0; i <= 36; i++) {
        expect(movementXYZ(i * 10, 90, 100)).toEqual([0, 100, 0], `${i}`);
        expect(movementXYZ(i * 10, -90, 100)).toEqual([0, -100, 0], `${i}`);
    }
});

test("movementXZ far distance final value", () => {
    expect(movementXZ(42, 105123)).toEqual([70341, 78122]);
    expect(movementXYZ(42, 42, 105123)).toEqual([52274, 70341, 58056]);
    expect(movementXYZ(0.1, 0.1, 105123)).toEqual([183, 183, 105123]);
});

test("nearbyInt", () => {
    expect(nearbyInt(2.5)).toBe(3);
    expect(nearbyInt(-2.5)).toBe(-3);
    expect(nearbyInt(-0.3)).toBe(0);
    expect(nearbyInt(0.4)).toBe(0);
    expect(nearbyInt(1.499)).toBe(1);
});

test("rotatePointY", () => {
    const data = {
        0: [-45, 32],
        45: [-10, 67],
        65: [11, 73],
        149: [79, 18],
        192: [69, -28],
        322: [-47, -10],
    };
    for (const [angle, xz] of Object.entries(data)) {
        expect(rotatePointY(Number(angle), -45, 32, 15, 8)).toEqual(xz);
    }

    expect(rotatePointY(111, 115, 478, 1000, 1000)).toEqual([830, 2013]);
    expect(rotatePointY(45, 300, 300, 1000, 1000)).toEqual([10, 1000]);
    expect(rotatePointY(0, 300, 300, 1000, 1000)).toEqual([300, 300]);
    expect(rotatePointY(10, -45, 32, 0, 0)).toEqual([-39, 39]);
    expect(rotatePointY(20, -45, 32, 0, 0)).toEqual([-31, 45]);
    expect(rotatePointY(45, -45, 32, 0, 0)).toEqual([-9, 54]);

    expect(rotatePointY(63, 6, 8, 0, 0)).toEqual([10, -2]);
    expect(rotatePointY(116, 6, 8, 0, 0)).toEqual([5, -9]);
    expect(rotatePointY(-3, 6, 8, 0, 0)).toEqual([6, 8]);
    expect(rotatePointY(-22, 6, 8, 0, 0)).toEqual([3, 10]);
    expect(rotatePointY(-63, 6, 8, 0, 0)).toEqual([-4, 9]);
    expect(rotatePointY(351, 6, 8, 0, 0)).toEqual([5, 9]);
    expect(rotatePointY(-351, 6, 8, 0, 0)).toEqual([7, 7]);

    expect(rotatePointY(0, -2, 2, 2, 3)).toEqual([-2, 2]);
    expect(rotatePointY(22, -2, 2, 2, 3)).toEqual([-2, 4]);
    expect(rotatePointY(123, -2, 2, 2, 3)).toEqual([3, 7]);
    expect(rotatePointY(132, -2, 2, 2, 3)).toEqual([4, 7]);
    expect(rotatePointY(298, -2, 2, 2, 3)).toEqual([1, -1]);
    expect(rotatePointY(-298, -2, 2, 2, 3)).toEqual([-1, 6]);
    expect(rotatePointY(-14, -2, 2, 2, 3)).toEqual([-2, 1]);
});

test("rotatePointX", () => {
    const data = {
        0: [20, 10],
        4: [20, 11],
        76: [5, 29],
        90: [0, 30],
    };
    for (const [angle, xz] of Object.entries(data)) {
        expect(rotatePointX(Number(angle), 20, 10, 0, 10)).toEqual(xz);
    }

    expect(rotatePointX(90, 20, 0)).toEqual([0, 20]);
    expect(rotatePointX(198, 5, 8)).toEqual([-2, -9]);
    expect(rotatePointX(22, 5, 8)).toEqual([2, 9]);
    expect(rotatePointX(287, 5, 8)).toEqual([9, -2]);
    expect(rotatePointX(9, 5, 8)).toEqual([4, 9]);
    expect(rotatePointX(-33, 5, 8, 0, 0)).toEqual([9, 4]);
    expect(rotatePointX(-333, 5, 8, 0, 0)).toEqual([1, 9]);

    expect(rotatePointX(0, -2, 2, 2, 3)).toEqual([-2, 2]);
    expect(rotatePointX(22, -2, 2, 2, 3)).toEqual([-1, 1]);
    expect(rotatePointX(123, -2, 2, 2, 3)).toEqual([5, 0]);
    expect(rotatePointX(132, -2, 2, 2, 3)).toEqual([5, 1]);
    expect(rotatePointX(298, -2, 2, 2, 3)).toEqual([-1, 6]);
    expect(rotatePointX(-298, -2, 2, 2, 3)).toEqual([1, -1]);
    expect(rotatePointX(-14, -2, 2, 2, 3)).toEqual([-2, 3]);
});

test("rotatePointZ", () => {
    const data = {
        0: [6, 5],
        6: [6, 4],
        112: [2, -7],
        254: [-6, 4],
        322: [2, 8],
    };
    for (const [angle, xy] of Object.entries(data)) {
        expect(rotatePointZ(Number(angle), 6, 5)).toEqual(xy);
    }

    expect(rotatePointZ(-322, 6, 5, 0, 0)).toEqual([8, 0]);
    expect(rotatePointZ(-45, 6, 5, 0, 0)).toEqual([1, 8]);

    expect(rotatePointZ(45, -12, 10, 0, 0)).toEqual([-1, 16]);
    expect(rotatePointZ(-22, -12, 10, 0, 0)).toEqual([-15, 5]);
    expect(rotatePointZ(22, -12, 10, 0, 0)).toEqual([-7, 14]);

    expect(rotatePointZ(0, -1, -2, 3, 2)).toEqual([-1, -2]);
    expect(rotatePointZ(22, -1, -2, 3, 2)).toEqual([-2, 0]);
    expect(rotatePointZ(123, -1, -2, 3, 2)).toEqual([2, 8]);
    expect(rotatePointZ(132, -1, -2, 3, 2)).toEqual([3, 8]);
    expect(rotatePointZ(298, -1, -2, 3, 2)).toEqual([5, -3]);
    expect(rotatePointZ(-298, -1, -2, 3, 2)).toEqual([-2, 4]);
    expect(rotatePointZ(-14, -1, -2, 3, 2)).toEqual([0, -3]);
});

test("worldAngle", () => {
    expect(worldAngle(new Point(10, 10, 20), new Point(10, 10, 10))).toEqual([0.0, 0.0]);
    expect(worldAngle(new Point(10, 10, 20), new Point(10, 10, 30))).toEqual([180.0, 0.0]);
    expect(worldAngle(new Point(11, 10, 20), new Point(10, 10, 20))).toEqual([90.0, 0.0]);
    expect(worldAngle(new Point(9, 10, 20), new Point(10, 10, 20))).toEqual([270.0, 0.0]);

    expect(worldAngle(new Point(), new Point(0, 10, 0))).toEqual([null, -90.0]);
    expect(worldAngle(new Point(), new Point(0, -10, 0))).toEqual([null, 90.0]);
    expect(worldAngle(new Point(), new Point(10, 0, 0))).toEqual([normalizeAngle(-90.0), 0.0]);
    expect(worldAngle(new Point(), new Point(0, 0, 10))).toEqual([180.0, 0.0]);
    expect(worldAngle(new Point(), new Point(0, 0, -10))).toEqual([0.0, 0.0]);
    expect(worldAngle(new Point(829, 773, 10), new Point(829, 940, 145))).not.toEqual([180.0, -90.0]);
    expect(worldAngle(new Point(10, 0, 0))).toEqual([90.0, 0.0]);
    expect(worldAngle(new Point(10, 4, 6), new Point(10, 2, 6))).toEqual([null, 90.0]);

    expect(worldAngle(new Point(0, 0, 10))).toEqual([0.0, 0.0]);
    expect(worldAngle(new Point(5, 0, 5))).toEqual([45.0, 0.0]);
    expect(worldAngle(new Point(10, 2, 6), new Point(10, 2, 6))).toEqual([null, 0.0]);
});

test("worldAngle roundtrip with movementXYZ", () => {
    const start = new Point(123, 456, -789);
    const end = start.clone();
    end.addFromArray(movementXYZ(217, -33, 9999));
    const [actualH, actualV] = worldAngle(end, start);
    expect([actualH === null ? null : Math.round(actualH), Math.round(actualV)]).toEqual([217, -33]);
});

test("lerp", () => {
    expect(lerpInt(1, 9, 0)).toBe(1);
    expect(lerpInt(1, 9, 0.35)).toBe(4);
    expect(lerpInt(1, 9, 0.5)).toBe(5);
    expect(lerpInt(1, 9, 1)).toBe(9);
    expect(lerpInt(1, 9, 2)).toBe(17);
    const p = lerpPoint(new Point(), new Point(100, 140, 160), 0.5);
    expect([p.x, p.y, p.z]).toEqual([50, 70, 80]);
    const p2 = lerpPoint(new Point(2, 7, 9), new Point(11, 15, 23), 0.9);
    expect([p2.x, p2.y, p2.z]).toEqual([10, 14, 22]);
});

test("mapRange", () => {
    expect(mapRange(0, 10, 20, 30, 0, false)).toBe(20);
    expect(mapRange(0, 10, 20, 30, 5, false)).toBe(25);
    expect(mapRange(0, 10, 20, 30, 15, false)).toBe(35);
    expect(mapRange(0, 10, 20, 30, 15, true)).toBe(30);
    expect(mapRange(30, 80, 50, 1, 1, false)).toBe(78);
    expect(mapRange(30, 80, 50, 1, 1, true)).toBe(50);
    expect(mapRange(30, 80, 50, 1, 5, true)).toBe(50);
    expect(mapRange(30, 80, 50, 1, 30, true)).toBe(50);
    expect(mapRange(30, 80, 50, 1, 40, true)).toBe(40);
    expect(mapRange(30, 80, 50, 1, 60, true)).toBe(21);
    expect(mapRange(30, 80, 50, 1, 70, true)).toBe(11);
    expect(mapRange(30, 80, 50, 1, 80, true)).toBe(1);
    expect(mapRange(30, 80, 50, 1, 85, true)).toBe(1);
    expect(mapRange(30, 80, 50, 1, 85, false)).toBe(-4);
});

test("point hash and helpers", () => {
    expect(new Point(1, 2, 3).hash()).toBe("1,2,3");
    const point = new Point();
    point.addPart(1, 2, 3);
    expect([point.x, point.y, point.z]).toEqual([1, 2, 3]);
    const twoD = point.to2D("zy").add(-1, 2).toArray();
    expect(twoD).toEqual({ x: 2, y: 4 });
    point.setFromArray([1, 3, 2]);
    expect(new Point(1, 3, 2).equals(point)).toBe(true);

    const cloned = new Point(5, 6, 7).clone();
    expect([cloned.x, cloned.y, cloned.z]).toEqual([5, 6, 7]);
    expect(cloned.toFlatArray()).toEqual([5, 6, 7]);
    expect(cloned.toArray()).toEqual({ x: 5, y: 6, z: 7 });
    const fromHash = Point.fromHash("1,2,3");
    expect([fromHash.x, fromHash.y, fromHash.z]).toEqual([1, 2, 3]);
    const fromArray = Point.fromArray({ x: 9, y: 8, z: 7 });
    expect([fromArray.x, fromArray.y, fromArray.z]).toEqual([9, 8, 7]);
    expect(() => new Point(1, 2, 3).to2D("unknown")).toThrow("Not implemented yet!");
    expect(cloned.toString()).toBe("Point(5, 6, 7)");
});

test("point2d", () => {
    const p = new Point2D(3, 4);
    expect(p.toArray()).toEqual({ x: 3, y: 4 });
    expect(p.add(-1, 2).toArray()).toEqual({ x: 2, y: 6 });
    expect(p.toString()).toBe("Point2D(2,6)");
});

test("distance", () => {
    expect(distanceSquared(new Point(4, 1, -8), new Point(2, 2, 2))).toBe(105);
    expect(distanceSquared(new Point(11, -1, -8), new Point(-2, -4, 12))).toBe(578);
    expect(distanceFromOrigin(new Point2D(4, 1))).toBe(4);
    expect(distanceFromOrigin(new Point2D(0, 4))).toBe(4);
});

test("smallestDeltaAngle", () => {
    expect(smallestDeltaAngle(0, 4)).toBe(4);
    expect(smallestDeltaAngle(8, 4)).toBe(-4);
    expect(smallestDeltaAngle(-45, 180)).toBe(-135);
    expect(smallestDeltaAngle(90, 135)).toBe(45);
    expect(smallestDeltaAngle(135, 90)).toBe(-45);
    expect(smallestDeltaAngle(-45, 179)).toBe(-136);
    expect(smallestDeltaAngle(-46, -22)).toBe(24);
    expect(smallestDeltaAngle(-46, 22)).toBe(68);
    expect(smallestDeltaAngle(290, 22)).toBe(92);
    expect(smallestDeltaAngle(246, 22)).toBe(136);
    expect(smallestDeltaAngle(720, 1)).toBe(1);
    expect(smallestDeltaAngle(1, 720)).toBe(-1);
    expect(smallestDeltaAngle(-46, 44)).toBe(90);
});

test("directionY", () => {
    expect(directionY(12.3)).toBe(1);
    expect(directionY(0.0)).toBe(0);
    expect(directionY(-32.1)).toBe(-1);
});

test("stepsAndIncrements", () => {
    expect(stepsAndIncrements(new Point(), new Point())).toEqual([0, 0, 0, 0]);
    const [steps, xi, yi, zi] = stepsAndIncrements(new Point(0, 0, 0), new Point(10, 20, 30));
    expect([steps, xi, yi, zi]).toEqual([30, 10 / 30, 20 / 30, 30 / 30]);
    const [steps2] = stepsAndIncrements(new Point(0, 0, 0), new Point(10, 20, 30), 0.5);
    expect(steps2).toBe(15);
});

test("continuousPointsBetween", () => {
    expect(continuousPointsBetween(new Point(), new Point(3, 3, 0))).toEqual([
        [0, 0, 0],
        [1, 0, 0],
        [1, 1, 0],
        [2, 1, 0],
        [2, 2, 0],
        [3, 2, 0],
        [3, 3, 0],
    ]);
    expect(continuousPointsBetween(new Point(), new Point(-3, -3, 0))).toEqual([
        [0, 0, 0],
        [-1, 0, 0],
        [-1, -1, 0],
        [-2, -1, 0],
        [-2, -2, 0],
        [-3, -2, 0],
        [-3, -3, 0],
    ]);
    expect(continuousPointsBetween(new Point(), new Point(2, 5, 0))).toEqual([
        [0, 0, 0],
        [0, 1, 0],
        [1, 1, 0],
        [1, 2, 0],
        [1, 3, 0],
        [1, 4, 0],
        [2, 4, 0],
        [2, 5, 0],
    ]);
    expect(continuousPointsBetween(new Point(), new Point(30, 50, 20)).slice(50, 51)).toEqual([[12, 32, 6]]);
    expect(continuousPointsBetween(new Point(), new Point())).toEqual([]);
});

test("continuousPointsBetween jaggedness", () => {
    expect(continuousPointsBetween(new Point(), new Point(3, 3, 0), 3.1)).toEqual([
        [0, 0, 0],
        [1, 0, 0],
        [2, 0, 0],
        [3, 0, 0],
        [3, 1, 0],
        [3, 2, 0],
        [3, 3, 0],
    ]);
    expect(continuousPointsBetween(new Point(), new Point(3, 3, 0), 3.1)).not.toEqual(
        continuousPointsBetween(new Point(), new Point(3, 3, 0), 0.1),
    );
    expect(continuousPointsBetween(new Point(), new Point(3, 3, 0), 0.1)).toEqual([
        [0, 0, 0],
        [0, 1, 0],
        [0, 2, 0],
        [1, 2, 0],
        [2, 2, 0],
        [3, 2, 0],
        [3, 3, 0],
    ]);
    expect(continuousPointsBetween(new Point(1, 2, 3), new Point(1, 5, 3), 2.3)).toEqual([
        [1, 2, 3],
        [1, 3, 3],
        [1, 4, 3],
        [1, 5, 3],
    ]);
});

test("GameException", () => {
    expect(() => GameException.notImplementedYet("foo")).toThrow("Not implemented yet! foo");
    expect(() => GameException.invalid("bar")).toThrow("This should not be called! bar");
});
