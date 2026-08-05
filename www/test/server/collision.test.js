import { expect, test } from "bun:test";
import { Box } from "../../assets/js/server/box.js";
import {
    boxWithBox,
    boxWithSegment,
    circleWithPlane,
    circleWithRect,
    cylinderWithCylinder,
    planeWithPlane,
    pointWithBox,
    pointWithBoxBoundary,
    pointWithCircle,
    pointWithCylinder,
    pointWithSphere,
} from "../../assets/js/server/collision.js";
import { Floor } from "../../assets/js/server/floor.js";
import { Point } from "../../assets/js/server/point.js";
import { Point2D } from "../../assets/js/server/point2d.js";

// Ported from server tests: test/og/Unit/CollisionTest.php

test("boxWithSegment", () => {
    const data = [
        // boxMin | boxMax | segmentStart | segmentEnd | isCollision
        [[-1, -1, -1], [1, 1, 1], [-10, 0, 0], [10, 0, 0], true],
        [[-1, -1, -1], [1, 1, 1], [-10, -1, 0], [10, 1, 0], true],
        [[-1, -1, -1], [1, 1, 1], [-1, -1, -1], [1, 1, 1], true],
        [[-1, -1, -1], [1, 1, 1], [-1, -1, -1], [0, 0, 0], true],
        [[-1, -1, -1], [1, 1, 1], [-1, 0, -1], [-1, 0, -1], true],
        [[-1, -1, -1], [1, 1, 1], [-1, 1, 1], [7, -2, 2], false],
        [[-1, -1, -1], [1, 1, 1], [-10, -2, -2], [-10, 10, -4], false],
        [[-1, -1, -1], [1, 1, 1], [-10, -2, 0], [10, -4, 0], false],
        [[-1, -1, -1], [1, 1, 1], [-10, 0, 0], [10, -4, 0], false],
        [[-1, -1, -1], [1, 1, 1], [-10, 1, 0], [10, -4, 0], false],
        [[-1, -1, -1], [1, 1, 1], [-10, 2, 0], [10, -4, 0], true],
        [[-1, -1, -1], [1, 1, 1], [-10, 2, 0], [10, -4, 2], true],
        [[-1, -1, -1], [1, 1, 1], [-10, 3, 0], [10, -4, 2], true],
        [[-1, -1, -1], [1, 1, 1], [-10, 3, 0], [6, -4, 2], false],
        [[5, 5, 5], [20, 20, 20], [0, 0, 0], [30, 30, 30], true],
        [[5, 5, 5], [20, 20, 20], [10, 10, 10], [15, 15, 15], true],
        [[5, 5, 5], [20, 20, 20], [10, 10, 26], [30, 15, 15], false],
    ];
    for (const row of data) {
        expect(
            boxWithSegment(new Point(...row[0]), new Point(...row[1]), new Point(...row[2]), new Point(...row[3])),
            JSON.stringify(row),
        ).toBe(row[4]);
    }
});

test("pointWithCircle", () => {
    expect(pointWithCircle(10, 10, 10, 10, 1)).toBe(true);
    expect(pointWithCircle(11, 10, 10, 10, 1)).toBe(true);
    expect(pointWithCircle(10, 11, 10, 10, 1)).toBe(true);
    expect(pointWithCircle(15, 10, 10, 10, 5)).toBe(true);
    expect(pointWithCircle(10, 15, 10, 10, 6)).toBe(true);

    expect(pointWithCircle(10, 13, 10, 10, 2)).toBe(false);
    expect(pointWithCircle(13, 10, 10, 10, 2)).toBe(false);
    expect(pointWithCircle(15, 15, 10, 10, 4)).toBe(false);
    expect(pointWithCircle(15, 10, 10, 10, 4)).toBe(false);
    expect(pointWithCircle(10, 15, 10, 10, 4)).toBe(false);
});

test("circleWithPlane false", () => {
    const radius = 2;
    const floor = new Floor(new Point(1, 0, 1), 5, 2);
    const circles = [
        new Point2D(-1, 4),
        new Point2D(-2, 2),
        new Point2D(0, -1),
        new Point2D(3, -2),
        new Point2D(7, -1),
        new Point2D(8, 4),
        new Point2D(8, 4),
        new Point2D(6, 6),
        new Point2D(-1, 0),
    ];
    for (const circleCenter of circles) {
        expect(circleWithPlane(circleCenter.x, circleCenter.y, radius, floor), `Circle: ${circleCenter}`).toBe(false);
        const fs = floor.getPoint2DStart();
        const fe = floor.getPoint2DEnd();
        expect(
            circleWithRect(circleCenter.x, circleCenter.y, radius, fs.x, fe.x, fs.y, fe.y),
            `Circle: ${circleCenter}`,
        ).toBe(false);
    }
});

test("circleWithPlane true", () => {
    const radius = 2;
    const floor = new Floor(new Point(1, 0, 1), 5, 2);
    const circles = [
        new Point2D(-1, 3),
        new Point2D(-1, 2),
        new Point2D(3, 5),
        new Point2D(7, 2),
        new Point2D(6, -1),
        new Point2D(4, -1),
        new Point2D(3, 0),
        new Point2D(1, 0),
        new Point2D(0, 1),
    ];
    for (const circleCenter of circles) {
        expect(circleWithPlane(circleCenter.x, circleCenter.y, radius, floor), `Circle: ${circleCenter}`).toBe(true);
        const fs = floor.getPoint2DStart();
        const fe = floor.getPoint2DEnd();
        expect(
            circleWithRect(circleCenter.x, circleCenter.y, radius, fs.x, fe.x, fs.y, fe.y),
            `Circle: ${circleCenter}`,
        ).toBe(true);
    }
});

test("pointWithCylinder true", () => {
    const cylinderBottom = new Point(3, -1, 0);
    const radius = 3;
    const height = 6;
    const points = [
        new Point(0, 0, 0),
        new Point(3, 0, 0),
        new Point(3, 0, 1),
        new Point(4, 2, 0),
        new Point(4, 1, 1),
        new Point(6, 0, 0),
    ];
    for (const point of points) {
        expect(pointWithCylinder(point, cylinderBottom, radius, height), `Point: ${point}`).toBe(true);
    }
});

test("pointWithCylinder false", () => {
    expect(cylinderWithCylinder(new Point(132, 3, 88), 44, 190, new Point(55, -10, 45), 44, 190)).toBe(false);
    const cylinderBottom = new Point(3, -1, 0);
    const radius = 3;
    const height = 6;
    const points = [new Point(0, -3, 0), new Point(4, 6, 0), new Point(2, -3, 0), new Point(6, 0, 1)];
    for (const point of points) {
        expect(pointWithCylinder(point, cylinderBottom, radius, height), `Point: ${point}`).toBe(false);
    }
});

test("cylinderWithCylinder true", () => {
    const centerA = new Point(4, 0, 0);
    const radiusA = 3;
    const heightA = 6;
    const radiusB = 2;
    const heightB = 4;
    const centers = [
        new Point(0, 0, 0),
        new Point(0, -3, 0),
        new Point(4, 6, 0),
        new Point(2, -3, 0),
        new Point(4, 2, 0),
        new Point(4, 1, 1),
    ];
    for (const centerB of centers) {
        expect(cylinderWithCylinder(centerA, radiusA, heightA, centerB, radiusB, heightB), `CenterB: ${centerB}`).toBe(
            true,
        );
    }
});

test("cylinderWithCylinder false", () => {
    const centerA = new Point(-2, 1, 2);
    const radiusA = 2;
    const heightA = 6;
    const radiusB = 2;
    const heightB = 4;
    const centers = [
        new Point(-2, 11, 2),
        new Point(-6, 2, 0),
        new Point(-8, 2, 0),
        new Point(-7, 2, 0),
        new Point(5, 2, 0),
        new Point(2, 2, 0),
        new Point(1, 2, 5),
        new Point(5, 3, 5),
        new Point(0, -5, 0),
    ];
    for (const centerB of centers) {
        expect(cylinderWithCylinder(centerA, radiusA, heightA, centerB, radiusB, heightB), `CenterB: ${centerB}`).toBe(
            false,
        );
    }
});

test("pointWithSphere", () => {
    const sphereCenter = new Point();
    const sphereRadius = 10;

    let points = [
        new Point(-4, 6, 6),
        new Point(-5, 6, 6),
        new Point(-1, 7, 6),
        new Point(-1, 7, 7),
        new Point(-5, 5, 6),
        new Point(-1, 6, 7),
        new Point(-6, 6, 5),
    ];
    for (const point of points) {
        expect(pointWithSphere(point, sphereCenter, sphereRadius), `Point: ${point}`).toBe(true);
    }
    points = [
        new Point(-6, 6, 6),
        new Point(-5, 7, 6),
        new Point(-5, 8, 6),
        new Point(4, -7, 6),
        new Point(7, 2, 7),
        new Point(8, 2, 7),
    ];
    for (const point of points) {
        expect(pointWithSphere(point, sphereCenter, sphereRadius), `Point: ${point}`).toBe(false);
    }
});

test("pointWithBox", () => {
    const box = new Box(new Point(1, 1, 1), 10, 2, 4);

    let points = [new Point(1, 1, 3), new Point(2, 2, 4), new Point(11, 2, 1), new Point(10, 3, 3)];
    for (const point of points) {
        expect(pointWithBox(point, box), `Point: ${point}`).toBe(true);
    }
    points = [
        new Point(1, 1, -3),
        new Point(2, 4, 4),
        new Point(12, 2, 1),
        new Point(-1, 3, 3),
        new Point(2, 2, 0),
        new Point(2, 2, 6),
    ];
    for (const point of points) {
        expect(pointWithBox(point, box), `Point: ${point}`).toBe(false);
    }
});

test("pointWithSphere radius 2", () => {
    const sphereCenter = new Point();
    const sphereRadius = 2;
    let points = [
        new Point(),
        new Point(0, 0, 1),
        new Point(0, 0, 2),
        new Point(1, 0, 1),
        new Point(1, 1, 1),
        new Point(2, 0, 0),
    ];
    for (const point of points) {
        expect(pointWithSphere(point, sphereCenter, sphereRadius), `Point: ${point}`).toBe(true);
    }
    points = [
        new Point(-2, 1, 1),
        new Point(-2, 2, 1),
        new Point(-4, 0, 1),
        new Point(-4, 2, 3),
        new Point(0, 2, 5),
        new Point(1, 2, 1),
        new Point(1, 2, 5),
        new Point(1, 3, 5),
        new Point(1, 0, 2),
        new Point(2, -2, 1),
        new Point(2, 1, 1),
        new Point(2, 2, 1),
    ];
    for (const point of points) {
        expect(pointWithSphere(point, sphereCenter, sphereRadius), `Point: ${point}`).toBe(false);
    }
});

test("planeWithPlane", () => {
    expect(planeWithPlane(new Point2D(0, 0), 3440, 950, 45, 0, 88, 190)).toBe(true);
    expect(planeWithPlane(new Point2D(45, 0), 3440, 950, 45, 0, 88, 190)).toBe(true);
    expect(planeWithPlane(new Point2D(145, 0), 3440, 950, 45, 0, 88, 190)).toBe(false);
});

test("pointWithBoxBoundary", () => {
    expect(pointWithBoxBoundary(new Point(), new Point(-5, 0, -5), new Point(5, 4, 5))).toBe(true);
    expect(pointWithBoxBoundary(new Point(4, 2, 5), new Point(-5, 0, -5), new Point(5, 4, 5))).toBe(true);
    expect(pointWithBoxBoundary(new Point(0, 1, 1), new Point(), new Point(1, 1, 1))).toBe(true);
    expect(pointWithBoxBoundary(new Point(0, 1, 1), new Point(), new Point(1, 8, 1))).toBe(true);
    expect(pointWithBoxBoundary(new Point(1, 1, 1), new Point(), new Point(1, 8, 1))).toBe(true);
    expect(pointWithBoxBoundary(new Point(1, 1, 0), new Point(), new Point(1, 8, 1))).toBe(true);

    expect(pointWithBoxBoundary(new Point(-6), new Point(-5, 0, -5), new Point(5, 4, 5))).toBe(false);
    expect(pointWithBoxBoundary(new Point(4, 5, 2), new Point(-5, 0, -5), new Point(5, 4, 5))).toBe(false);
    expect(pointWithBoxBoundary(new Point(4, 2, 6), new Point(-5, 0, -5), new Point(5, 4, 5))).toBe(false);
});

test("boxWithBox", () => {
    expect(boxWithBox(new Point(-5, 0, -5), new Point(5, 4, 5), new Point(1, 0, -1), new Point(3, 3, 1))).toBe(true);
    expect(boxWithBox(new Point(-5, 0, -5), new Point(5, 4, 5), new Point(1, 4, -1), new Point(3, 7, 1))).toBe(true);
    expect(boxWithBox(new Point(-5, 0, -5), new Point(5, 4, 5), new Point(1, -2, -1), new Point(3, 1, 1))).toBe(true);
    expect(boxWithBox(new Point(-5, 0, -5), new Point(5, 4, 5), new Point(1, 2, -3), new Point(3, 5, -1))).toBe(true);
    expect(boxWithBox(new Point(-5, 0, -5), new Point(5, 4, 5), new Point(-3, 3, 2), new Point(-1, 6, 4))).toBe(true);
    expect(boxWithBox(new Point(-5, 0, -5), new Point(5, 4, 5), new Point(1, 2, -7), new Point(3, 5, -5))).toBe(true);
    expect(boxWithBox(new Point(-5, 0, -5), new Point(5, 4, 5), new Point(5, 2, -7), new Point(6, 5, -5))).toBe(true);
    expect(boxWithBox(new Point(-5, 0, -5), new Point(5, 4, 5), new Point(1, 2, -5), new Point(3, 5, 5))).toBe(true);
    expect(boxWithBox(new Point(-5, 0, -5), new Point(5, 4, 5), new Point(1, -2, -5), new Point(3, 0, 5))).toBe(true);
    expect(boxWithBox(new Point(-5, 0, -5), new Point(5, 4, 5), new Point(-6, 0, -5), new Point(-5, 2, 5))).toBe(true);
    expect(boxWithBox(new Point(2, 0, 1), new Point(5, 4, 5), new Point(-1, -1, 5), new Point(2, 2, 6))).toBe(true);

    expect(boxWithBox(new Point(-5, 0, -5), new Point(5, 4, 5), new Point(1, 5, 2), new Point(3, 8, 4))).toBe(false);
    expect(boxWithBox(new Point(-5, 0, -5), new Point(5, 4, 5), new Point(1, 2, -8), new Point(3, 5, -6))).toBe(false);
    expect(boxWithBox(new Point(-5, 0, -5), new Point(5, 4, 5), new Point(1, -6, -5), new Point(3, -3, -3))).toBe(
        false,
    );
    expect(boxWithBox(new Point(0, 0, 0), new Point(5, 1, 1), new Point(-10, 0, 0), new Point(-3, 1, 1))).toBe(false);
});
