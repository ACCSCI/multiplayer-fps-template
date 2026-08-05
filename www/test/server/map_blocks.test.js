import { expect, test } from "bun:test";
import { Floor } from "../../assets/js/server/floor.js";
import { GameException } from "../../assets/js/server/game_exception.js";
import { PlaneBuilder } from "../../assets/js/server/plane_builder.js";
import { Point } from "../../assets/js/server/point.js";
import { Wall } from "../../assets/js/server/wall.js";

// Port of test/og/Unit/PlaneBuilderTest.php

/** PHP rand(a, b) */
function rand(min, max) {
    return Math.floor(Math.random() * (max - min + 1)) + min;
}

/** PHP shuffle() */
function shuffle(items) {
    for (let i = items.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [items[i], items[j]] = [items[j], items[i]];
    }
    return items;
}

/** PHP BaseTest::assertPositionSame() */
function expectPositionSame(expected, actual) {
    expect(actual.x).toBe(expected.x);
    expect(actual.y).toBe(expected.y);
    expect(actual.z).toBe(expected.z);
}

test("AABB floor", () => {
    const pb = new PlaneBuilder();
    const planes = pb.fromQuad(new Point(1, 1, 30), new Point(10, 1, 30), new Point(1, 1, 2), new Point(10, 1, 2));
    expect(planes).toHaveLength(1);
    const floor = planes[0];
    expect(floor).toBeInstanceOf(Floor);
    expectPositionSame(new Point(1, 1, 2), floor.getStart());
    expectPositionSame(new Point(10, 1, 30), floor.getEnd());
    expect(floor.width).toBe(9);
    expect(floor.depth).toBe(28);
});

test("AABB floor shuffled", () => {
    const pb = new PlaneBuilder();
    const points = shuffle([new Point(1, 1, 30), new Point(10, 1, 30), new Point(1, 1, 2), new Point(10, 1, 2)]);

    const planes = pb.fromQuad(...points);
    expect(planes).toHaveLength(1);
    const floor = planes[0];
    expect(floor).toBeInstanceOf(Floor);
    expectPositionSame(new Point(1, 1, 2), floor.getStart());
    expectPositionSame(new Point(10, 1, 30), floor.getEnd());
    expect(floor.width).toBe(9);
    expect(floor.depth).toBe(28);
});

test("AABB floor random", () => {
    const expected = new Floor(
        new Point(rand(-100, 100), rand(-100, 100), rand(-100, 100)),
        rand(1, 100),
        rand(1, 100),
    );
    const pb = new PlaneBuilder();
    const points = shuffle([
        expected.getStart().clone(),
        expected.getStart().clone().addZ(expected.depth),
        expected.getStart().clone().addX(expected.width),
        expected.getStart().clone().addX(expected.width).addZ(expected.depth),
    ]);

    const planes = pb.fromQuad(...points);
    expect(planes).toHaveLength(1);
    const floor = planes[0];
    expect(floor).toBeInstanceOf(Floor);
    expectPositionSame(expected.getStart(), floor.getStart());
    expectPositionSame(expected.getEnd(), floor.getEnd());
    expect(floor.width).toBe(expected.width);
    expect(floor.depth).toBe(expected.depth);
});

test("triangle", () => {
    const pb = new PlaneBuilder();
    const planes = pb.fromTriangle(new Point(2, 1, 3), new Point(4, 3, 5), new Point(6, 2, 1), 1.0);
    expect(planes).toHaveLength(28);
});

test("triangle normal", () => {
    const pb = new PlaneBuilder();
    const planes = pb.fromTriangle(new Point(-10, 10, 46), new Point(10, 38, -10), new Point(41, 10, 10), 20.0);
    expect(planes).toHaveLength(12);
    expect(planes[0].getNormal()).toEqual([35, 50]);
    expect(planes[1].getNormal()).toEqual([35, 50]);
    expect(planes[rand(2, 11)].getNormal()).toEqual([35, 50]);
});

test("triangle voxel size", () => {
    const pb = new PlaneBuilder();
    const planes = pb.create(new Point(6, 3, 9), new Point(12, 18, 15), new Point(18, 12, 3), null, 3.9);
    expect(planes).toHaveLength(12);
    expect(planes[0].getNormal()).toEqual([48, 29]);
});

test("triangle boundary", () => {
    const pb = new PlaneBuilder();
    const planes = pb.create(new Point(2, 1, 6), new Point(12, 4, 22), new Point(5, 11, -1), null, 1.0);
    expect(planes).toHaveLength(568);

    const boundaryMin = new Point(Number.MAX_SAFE_INTEGER, Number.MAX_SAFE_INTEGER, Number.MAX_SAFE_INTEGER);
    const boundaryMax = new Point(Number.MIN_SAFE_INTEGER, Number.MIN_SAFE_INTEGER, Number.MIN_SAFE_INTEGER);
    for (const plane of planes) {
        boundaryMin.set(
            Math.min(boundaryMin.x, plane.getStart().x),
            Math.min(boundaryMin.y, plane.getStart().y),
            Math.min(boundaryMin.z, plane.getStart().z),
        );
        boundaryMax.set(
            Math.max(boundaryMax.x, plane.getEnd().x),
            Math.max(boundaryMax.y, plane.getEnd().y),
            Math.max(boundaryMax.z, plane.getEnd().z),
        );
    }
    expectPositionSame(new Point(2, 0, 0), boundaryMin);
    expectPositionSame(new Point(12, 10, 22), boundaryMax);
});

test("triangle boundary negative", () => {
    const pb = new PlaneBuilder();
    const planes = pb.create(new Point(2, 1, 6), new Point(12, 4, 22), new Point(5, 11, -1), null, -1.0);
    expect(planes).toHaveLength(584);

    const boundaryMin = new Point(Number.MAX_SAFE_INTEGER, Number.MAX_SAFE_INTEGER, Number.MAX_SAFE_INTEGER);
    const boundaryMax = new Point(Number.MIN_SAFE_INTEGER, Number.MIN_SAFE_INTEGER, Number.MIN_SAFE_INTEGER);
    for (const plane of planes) {
        boundaryMin.set(
            Math.min(boundaryMin.x, plane.getStart().x),
            Math.min(boundaryMin.y, plane.getStart().y),
            Math.min(boundaryMin.z, plane.getStart().z),
        );
        boundaryMax.set(
            Math.max(boundaryMax.x, plane.getEnd().x),
            Math.max(boundaryMax.y, plane.getEnd().y),
            Math.max(boundaryMax.z, plane.getEnd().z),
        );
    }
    expectPositionSame(new Point(2, 0, -1), boundaryMin);
    expectPositionSame(new Point(13, 11, 23), boundaryMax);
});

test("AABB wall X", () => {
    const pb = new PlaneBuilder();
    const planes = pb.fromQuad(new Point(1, 5, 2), new Point(10, 5, 2), new Point(1, 1, 2), new Point(10, 1, 2));
    expect(planes).toHaveLength(1);
    const wall = planes[0];
    expect(wall).toBeInstanceOf(Wall);
    expectPositionSame(new Point(1, 1, 2), wall.getStart());
    expectPositionSame(new Point(10, 5, 2), wall.getEnd());
    expect(wall.isWidthOnXAxis()).toBe(true);
    expect(wall.width).toBe(9);
    expect(wall.height).toBe(4);
});

test("AABB wall Z", () => {
    const pb = new PlaneBuilder();
    const planes = pb.fromQuad(new Point(1, 7, 2), new Point(1, 7, 12), new Point(1, 5, 2), new Point(1, 5, 12));
    expect(planes).toHaveLength(1);
    const wall = planes[0];
    expect(wall).toBeInstanceOf(Wall);
    expectPositionSame(new Point(1, 5, 2), wall.getStart());
    expectPositionSame(new Point(1, 7, 12), wall.getEnd());
    expect(wall.isWidthOnXAxis()).toBe(false);
    expect(wall.width).toBe(10);
    expect(wall.height).toBe(2);
});

test("simple wall random", () => {
    const widthOnXAxis = Math.random() < 0.5;
    const expected = new Wall(
        new Point(rand(-100, 100), rand(-100, 100), rand(-100, 100)),
        widthOnXAxis,
        rand(1, 100),
        rand(1, 100),
    );
    const pb = new PlaneBuilder();
    const points = shuffle([
        expected.getStart().clone(),
        expected.getStart().clone().addY(expected.height),
        expected.getEnd().clone(),
        expected.getEnd().clone().addY(-expected.height),
    ]);

    const planes = pb.fromQuad(...points);
    expect(planes).toHaveLength(1);
    const wall = planes[0];
    expect(wall).toBeInstanceOf(Wall);
    expectPositionSame(expected.getStart(), wall.getStart());
    expectPositionSame(expected.getEnd(), wall.getEnd());
    expect(wall.width).toBe(expected.width);
    expect(wall.height).toBe(expected.height);
    expect(wall.isWidthOnXAxis()).toBe(expected.isWidthOnXAxis());
});

test("rotated simple wall", () => {
    const pb = new PlaneBuilder();
    const planes = pb.fromQuad(new Point(2, 8, 6), new Point(2, 2, 6), new Point(1, 2, 3), new Point(1, 8, 3));
    expect(planes).toHaveLength(3);
    expect(planes[0]).toBeInstanceOf(Wall);
    expect(planes[1]).toBeInstanceOf(Wall);
    expect(planes[2]).toBeInstanceOf(Wall);
    expectPositionSame(new Point(2, 2, 5), planes[2].getStart());
    expectPositionSame(new Point(2, 8, 6), planes[2].getEnd());
});

test("rotated wall jaggedness", () => {
    const pb = new PlaneBuilder();
    const planes = pb.fromQuad(new Point(1, 2, 3), new Point(1, 8, 3), new Point(2, 2, 6), new Point(2, 8, 6), 4.1);
    expect(planes).toHaveLength(2);
    expectPositionSame(new Point(1, 2, 3), planes[0].getStart());
    expectPositionSame(new Point(1, 8, 6), planes[0].getEnd());
    expectPositionSame(new Point(1, 2, 6), planes[1].getStart());
    expectPositionSame(new Point(2, 8, 6), planes[1].getEnd());
});

test("rotated wall", () => {
    const pb = new PlaneBuilder();
    const points = shuffle([new Point(1, 2, 3), new Point(1, 8, 3), new Point(8, 2, 6), new Point(8, 8, 6)]);

    const planes = pb.fromQuad(...points);
    expect(planes.length).toBeGreaterThan(2);
    const startPlane = planes.shift();
    expect(startPlane).toBeInstanceOf(Wall);
    let widthOnXAxis = startPlane.isWidthOnXAxis();
    const start = startPlane.getStart();
    const end = start
        .clone()
        .addPart(widthOnXAxis ? startPlane.width : 0, startPlane.height, widthOnXAxis ? 0 : startPlane.width);
    expectPositionSame(startPlane.getEnd(), end);
    const previousEnd = end.clone();
    const height = startPlane.height;
    for (const plane of planes) {
        expect(plane).toBeInstanceOf(Wall);
        widthOnXAxis = plane.isWidthOnXAxis();
        expectPositionSame(end.addY(-height), plane.getStart());
        expect(previousEnd.x <= plane.getStart().x && previousEnd.z <= plane.getStart().z).toBe(true);
        expect(plane.getEnd().x > previousEnd.x || plane.getEnd().z > previousEnd.z).toBe(true);

        end.setFrom(plane.getStart());
        end.addPart(widthOnXAxis ? plane.width : 0, height, widthOnXAxis ? 0 : plane.width);
        expectPositionSame(end, plane.getEnd());
        previousEnd.setFrom(end);
    }
});

test("rotated wall 2", () => {
    const pb = new PlaneBuilder();
    const points = shuffle([new Point(1, 0, 0), new Point(1, 1, 0), new Point(0, 0, 1), new Point(0, 1, 1)]);

    const planes = pb.create(...points);
    expect(planes).toHaveLength(2);
    expectPositionSame(new Point(0, 0, 1), planes[0].getStart());
    expectPositionSame(new Point(1, 1, 1), planes[0].getEnd());
    expectPositionSame(new Point(1, 0, 0), planes[1].getStart());
    expectPositionSame(new Point(1, 1, 1), planes[1].getEnd());
});

test("rotated wall quadrant 3", () => {
    const pb = new PlaneBuilder();
    const points = shuffle([new Point(2, 2, 3), new Point(2, 8, 3), new Point(1, 2, 6), new Point(1, 8, 6)]);

    const planes = pb.create(...points);
    expect(planes).toHaveLength(3);
    const startPlane = planes.shift();
    expect(startPlane).toBeInstanceOf(Wall);
    const widthOnXAxis = startPlane.getPlane() === "xy";
    const start = startPlane.getStart();
    const end = start
        .clone()
        .addPart(widthOnXAxis ? startPlane.width : 0, startPlane.height, widthOnXAxis ? 0 : startPlane.width);
    expectPositionSame(startPlane.getEnd(), end);
    const endWall = planes.pop();
    expectPositionSame(new Point(2, 2, 3), endWall.getStart());
    expectPositionSame(new Point(2, 8, 4), endWall.getEnd());
});

test("ramp on Z 1", () => {
    const pb = new PlaneBuilder();
    const points = shuffle([new Point(1, 2, 0), new Point(5, 2, 0), new Point(1, 3, 1), new Point(5, 3, 1)]);

    const planes = pb.fromQuad(...points);
    expect(planes).toHaveLength(2);

    let plane = planes[0];
    expect(plane).toBeInstanceOf(Wall);
    expectPositionSame(new Point(1, 2, 0), plane.getStart());
    expectPositionSame(new Point(5, 3, 0), plane.getEnd());

    plane = planes[1];
    expect(plane).toBeInstanceOf(Floor);
    expectPositionSame(new Point(1, 3, 0), plane.getStart());
    expectPositionSame(new Point(5, 3, 1), plane.getEnd());
});

test("ramp on Z 2", () => {
    const pb = new PlaneBuilder();
    const planes = pb.fromQuad(new Point(1, 3, 0), new Point(50, 3, 0), new Point(1, 2, 2), new Point(50, 2, 2), 1.0);
    expect(planes).toHaveLength(3);

    let plane = planes[0];
    expect(plane).toBeInstanceOf(Floor);
    expectPositionSame(new Point(1, 3, 0), plane.getStart());
    expectPositionSame(new Point(50, 3, 1), plane.getEnd());

    plane = planes[1];
    expect(plane).toBeInstanceOf(Wall);
    expect(plane.isWidthOnXAxis()).toBe(true);
    expectPositionSame(new Point(1, 2, 1), plane.getStart());
    expectPositionSame(new Point(50, 3, 1), plane.getEnd());

    plane = planes[2];
    expect(plane).toBeInstanceOf(Floor);
    expectPositionSame(new Point(1, 2, 1), plane.getStart());
    expectPositionSame(new Point(50, 2, 2), plane.getEnd());
});

test("ramp on X 1", () => {
    const pb = new PlaneBuilder();
    const points = shuffle([new Point(1, 2, 1), new Point(5, 3, 1), new Point(1, 2, 30), new Point(5, 3, 30)]);

    const planes = pb.fromQuad(...points);
    expect(planes).toHaveLength(2);

    let plane = planes[0];
    expect(plane).toBeInstanceOf(Floor);
    expect(plane.width).toBe(4);
    expect(plane.depth).toBe(29);
    expectPositionSame(new Point(1, 2, 1), plane.getStart());
    expectPositionSame(new Point(5, 2, 30), plane.getEnd());

    plane = planes[1];
    expect(plane).toBeInstanceOf(Wall);
    expect(plane.isWidthOnXAxis()).toBe(false);
    expect(plane.width).toBe(29);
    expectPositionSame(new Point(5, 2, 1), plane.getStart());
    expectPositionSame(new Point(5, 3, 30), plane.getEnd());
});

test("ramp on X 2", () => {
    const pb = new PlaneBuilder();
    const planes = pb.fromQuad(
        new Point(0, 0, 0),
        new Point(0, 0, 40),
        new Point(200, 200, 0),
        new Point(200, 200, 40),
        1.0,
    );
    expect(planes).toHaveLength(400);
    expectPositionSame(new Point(0, 0, 0), planes[0].getStart());
    expectPositionSame(new Point(200, 200, 40), planes[399].getEnd());
});

test("ramp jaggy", () => {
    const pb = new PlaneBuilder();
    const planes = pb.fromQuad(
        new Point(0, 0, 0),
        new Point(0, 0, 40),
        new Point(200, 200, 0),
        new Point(200, 200, 40),
        9999.1,
    );
    expect(planes).toHaveLength(2);
    expectPositionSame(new Point(0, 0, 0), planes[0].getStart());
    expectPositionSame(new Point(200, 0, 40), planes[0].getEnd());
    expectPositionSame(new Point(200, 0, 0), planes[1].getStart());
    expectPositionSame(new Point(200, 200, 40), planes[1].getEnd());
});

test("stairs", () => {
    const pb = new PlaneBuilder();
    const planes = pb.fromQuad(
        new Point(0, 0, 0),
        new Point(0, 0, 60),
        new Point(30, 10, 10),
        new Point(30, 10, 50),
        8,
    );
    expect(planes).toHaveLength(10);
    expectPositionSame(new Point(0, 0, 0), planes[0].getStart());
    expectPositionSame(new Point(30, 8, 0), planes[0].getEnd());
    expectPositionSame(new Point(15, 10, 5), planes[9].getStart());
    expectPositionSame(new Point(30, 10, 55), planes[9].getEnd());
});

test("stairs 2", () => {
    const pb = new PlaneBuilder();
    const planes = pb.fromQuad(
        new Point(0, 10, 10),
        new Point(0, 10, 50),
        new Point(30, 0, 0),
        new Point(30, 0, 60),
        8,
    );
    expect(planes).toHaveLength(10);
    expectPositionSame(new Point(0, 0, 0), planes[0].getStart());
    expectPositionSame(new Point(30, 8, 0), planes[0].getEnd());
    expectPositionSame(new Point(0, 10, 5), planes[9].getStart());
    expectPositionSame(new Point(15, 10, 55), planes[9].getEnd());
});

test("stairs 3", () => {
    const pb = new PlaneBuilder();
    const points = shuffle([new Point(10, 50, 0), new Point(50, 50, 0), new Point(0, 0, 60), new Point(60, 0, 60)]);

    const planes = pb.fromQuad(...points);
    expect(planes).toHaveLength(20);
    expectPositionSame(new Point(0, 0, 0), planes[0].getStart());
    expectPositionSame(new Point(60, 15, 0), planes[0].getEnd());
    expectPositionSame(new Point(2, 30, 0), planes[9].getStart());
    expectPositionSame(new Point(58, 30, 45), planes[9].getEnd());
});

test("bad wall throws", () => {
    const pb = new PlaneBuilder();
    const points = shuffle([
        new Point(11494, 1169, 12109),
        new Point(11494, 1228, 12710),
        new Point(11494, 1162, 12710),
        new Point(11494, 1103, 12109),
    ]);

    expect(() => pb.fromQuad(...points)).toThrow(GameException);
});
