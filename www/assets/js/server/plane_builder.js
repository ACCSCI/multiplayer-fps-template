import { assert } from "./assert.js";
import { Box } from "./box.js";
import { Floor } from "./floor.js";
import { GameException } from "./game_exception.js";
import { Point } from "./point.js";
import {
    continuousPointsBetween,
    directionX,
    directionZ,
    roundHalfAwayFromZero,
    stepsAndIncrements,
    worldAngle,
} from "./util.js";
import { Wall } from "./wall.js";

/**
 * Port of server/src/Core/PlaneBuilder.php
 */
export class PlaneBuilder {
    constructor() {
        this.voxels = new Map(); // "x,y,z" hash -> Point
        this.voxelNormal = null; // [horizontal|null, vertical]
    }

    /** @returns list<Plane> */
    create(a, b, c, d = null, jaggedness = null) {
        if (d === null) {
            return this.fromTriangle(a, b, c, jaggedness ?? 10.0);
        }

        return this.fromQuad(a, b, c, d, jaggedness);
    }

    /** @returns list<Plane> */
    fromTriangle(a, b, c, voxelSizeDotThreshold) {
        this.voxels = new Map();
        let voxelSize = Math.trunc(voxelSizeDotThreshold);
        // PHP: intval(str_replace('0.', '', strval(abs($v - $voxelSize))))
        // with default `precision = 14` (%G-style rounding of significant digits).
        const fraction = String(Number(Math.abs(voxelSizeDotThreshold - voxelSize).toPrecision(14)));
        const voxelThreshold = Math.max(1, parseInt(fraction.replace("0.", ""), 10));
        let matchSize;
        if (voxelSize > 0) {
            voxelSize = Math.max(1, voxelSize);
            matchSize = true;
        } else {
            voxelSize = Math.max(1, Math.abs(voxelSize));
            matchSize = false;
        }

        const planes = [];
        for (const voxelPoint of this.voxelizeTriangle(a, b, c, voxelSize, voxelThreshold, matchSize)) {
            planes.push(
                new Wall(voxelPoint, true, voxelSize, voxelSize).setNormal(this.voxelNormal[0], this.voxelNormal[1]),
            );
            planes.push(
                new Wall(voxelPoint, false, voxelSize, voxelSize).setNormal(this.voxelNormal[0], this.voxelNormal[1]),
            );
            planes.push(
                new Wall(voxelPoint.clone().addX(voxelSize), false, voxelSize, voxelSize).setNormal(
                    this.voxelNormal[0],
                    this.voxelNormal[1],
                ),
            );
            planes.push(
                new Floor(voxelPoint.clone().addY(voxelSize), voxelSize, voxelSize).setNormal(
                    this.voxelNormal[0],
                    this.voxelNormal[1],
                ),
            );
        }
        this.voxels = new Map();
        return planes;
    }

    /** @returns list<Plane> */
    fromQuad(a, b, c, d, jaggedness = null) {
        const minX = Math.min(a.x, b.x, c.x, d.x);
        const maxX = Math.max(a.x, b.x, c.x, d.x);
        const minY = Math.min(a.y, b.y, c.y, d.y);
        const maxY = Math.max(a.y, b.y, c.y, d.y);
        const minZ = Math.min(a.z, b.z, c.z, d.z);
        const maxZ = Math.max(a.z, b.z, c.z, d.z);

        // Floor
        if (minY === maxY) {
            const sort = [new Map(), new Map()];
            for (const point of [a, b, c, d]) {
                if (!sort[0].has(point.x)) {
                    sort[0].set(point.x, []);
                }
                sort[0].get(point.x).push(point);
                if (!sort[1].has(point.z)) {
                    sort[1].set(point.z, []);
                }
                sort[1].get(point.z).push(point);
            }

            // AABB floor
            if (sort[0].size === 2 && sort[1].size === 2 && sort[0].get(minX).length === 2) {
                return [new Floor(new Point(minX, minY, minZ), maxX - minX, maxZ - minZ)];
            }

            GameException.notImplementedYet("skew floor?"); // @codeCoverageIgnore
        }

        // Wall
        if (minX === maxX || minZ === maxZ) {
            const widthOnXAxis = minZ === maxZ;
            const width = widthOnXAxis ? maxX - minX : maxZ - minZ;

            if (
                !(
                    (a.y === minY || a.y === maxY) &&
                    (b.y === minY || b.y === maxY) &&
                    (c.y === minY || c.y === maxY) &&
                    (d.y === minY || d.y === maxY)
                )
            ) {
                GameException.invalid("Skew wall Y coord");
            }

            return [new Wall(new Point(minX, minY, minZ), widthOnXAxis, width, maxY - minY)];
        }

        // Maybe rotated wall or stairs
        const wallRotated = new Map(); // x -> Point[]
        const isWallRotatedCheck = new Map(); // yIndex -> Map<"x|z", Point[]>
        const isStairs = new Map(); // y -> Point[]
        const isRamp = new Map(); // x -> Map<z, Point[]>
        for (const point of [a, b, c, d]) {
            const yIndex = point.y === minY || point.y === maxY ? 0 : 1;
            if (!wallRotated.has(point.x)) {
                wallRotated.set(point.x, []);
            }
            wallRotated.get(point.x).push(point);

            if (!isWallRotatedCheck.has(yIndex)) {
                isWallRotatedCheck.set(yIndex, new Map());
            }
            const rotatedKey = `${point.x}|${point.z}`;
            if (!isWallRotatedCheck.get(yIndex).has(rotatedKey)) {
                isWallRotatedCheck.get(yIndex).set(rotatedKey, []);
            }
            isWallRotatedCheck.get(yIndex).get(rotatedKey).push(point);

            if (!isStairs.has(point.y)) {
                isStairs.set(point.y, []);
            }
            isStairs.get(point.y).push(point);

            if (!isRamp.has(point.x)) {
                isRamp.set(point.x, new Map());
            }
            if (!isRamp.get(point.x).has(point.z)) {
                isRamp.get(point.x).set(point.z, []);
            }
            isRamp.get(point.x).get(point.z).push(point);
        }

        // Rotated wall
        if (isWallRotatedCheck.size === 1 && (isWallRotatedCheck.get(0)?.size ?? 0) === 2) {
            const xCoordinates = [...wallRotated.keys()].sort((x1, x2) => x1 - x2);
            const start = wallRotated.get(xCoordinates[0])[0];
            const end = wallRotated.get(xCoordinates[1])[0];

            return this.rotatedWall(start.setY(minY), end.setY(minY), maxY - minY, jaggedness ?? 1.0);
        }

        // Ramp
        const minXKeys = [...isRamp.get(minX).keys()];
        if (
            (isRamp.get(minX)?.get(minZ) ?? []).length === 1 &&
            (isRamp.get(minX)?.get(maxZ) ?? []).length === 1 &&
            minXKeys.length === 2 &&
            isRamp.get(maxX)?.has(minXKeys[0]) &&
            isRamp.get(maxX)?.has(minXKeys[1])
        ) {
            const min = isRamp.get(minX).get(minZ)[0];
            const max = isRamp.get(minX).get(maxZ)[0];

            const rampDirectionOnX = min.y === max.y;
            const width = rampDirectionOnX ? maxZ - minZ : maxX - minX;
            if (rampDirectionOnX) {
                max.setX(maxX).setZ(minZ);
            }

            max.setY(min.y === minY ? maxY : minY);
            return this.ramp(min, max, width, jaggedness ?? 1.0);
        }

        // Stairs maybe
        if ((isStairs.get(minY) ?? []).length === 2 && (isStairs.get(maxY) ?? []).length === 2) {
            const [baseA, baseB] = isStairs.get(minY);
            const [topA, topB] = isStairs.get(maxY);
            const onX = baseA.z === baseB.z;
            const base = (onX ? baseA.x < baseB.x : baseA.z < baseB.z) ? baseA : baseB;
            const top = (onX ? topA.x < topB.x : topA.z < topB.z) ? topA : topB;
            const topSize = Math.abs(onX ? topA.x - topB.x : topA.z - topB.z);

            // Stairs
            if (topSize > 0) {
                const stepHeight = Math.trunc(jaggedness ?? 15);

                return this.stairs(base, top, topSize, stepHeight, onX);
            }
        }

        GameException.notImplementedYet(); // @codeCoverageIgnore
    }

    /** @returns list<Wall> */
    rotatedWall(start, end, height, jaggedness) {
        const [angleH, angleV] = worldAngle(end, start);
        assert(angleV === 0.0 && angleH !== null);
        const direction = [directionX(angleH), directionZ(angleH)];
        assert(direction[0] === 1 && Math.abs(direction[1]) === 1);

        const walls = [];
        const previous = start.clone();
        const points = continuousPointsBetween(start, end, jaggedness);
        let widthOnXAxis = points[1][2] === points[0][2];

        let i = 0;
        const maxIteration = points.length;
        while (++i <= maxIteration) {
            const xyz = points[i] ?? null;

            if (xyz !== null) {
                const hasSameBaseAxisAsPrevious =
                    (!widthOnXAxis && previous.x === xyz[0]) || (widthOnXAxis && previous.z === xyz[2]);
                if (hasSameBaseAxisAsPrevious) {
                    continue;
                }
            }

            const current = points[i - 1];
            const width = Math.abs(widthOnXAxis ? previous.x - current[0] : previous.z - current[2]);
            const leftPoint =
                direction[1] === 1 || widthOnXAxis ? previous.clone() : new Point(current[0], start.y, current[2]);

            walls.push(new Wall(leftPoint, widthOnXAxis, width, height).setNormal(90 + angleH, 0));
            previous.set(current[0], start.y, current[2]);
            widthOnXAxis = !widthOnXAxis;
        }

        return walls;
    }

    /** @returns list<Plane> */
    ramp(start, end, width, jaggedness) {
        const [angleH, angleV] = worldAngle(end, start);
        if (angleH === null || angleH % 90 !== 0.0) {
            GameException.invalid(); // @codeCoverageIgnore
        }
        assert(angleV !== 0.0);
        const normalH = angleH; // fixme: embrace jaggedness
        const normalV = angleV - 90; // fixme: embrace jaggedness

        const planes = [];
        const previous = start.clone();
        const points = continuousPointsBetween(start, end, jaggedness);
        let isFloor = points[1][1] === points[0][1];
        const stairsGoingUp = angleV > 0;
        const wallWidthOnXAxis = directionX(angleH) === 0;

        let i = 0;
        const maxIteration = points.length;
        while (++i <= maxIteration) {
            const xyz = points[i] ?? null;

            if (xyz !== null) {
                if (isFloor) {
                    if (previous.y === xyz[1]) {
                        continue;
                    }
                } else {
                    const hasSameBaseAxisAsPrevious =
                        (!wallWidthOnXAxis && previous.x === xyz[0]) || (wallWidthOnXAxis && previous.z === xyz[2]);
                    if (hasSameBaseAxisAsPrevious) {
                        continue;
                    }
                }
            }

            const current = points[i - 1];
            if (isFloor) {
                if (wallWidthOnXAxis) {
                    planes.push(
                        new Floor(previous.clone(), width, current[2] - previous.z).setNormal(normalH, normalV),
                    );
                } else {
                    planes.push(
                        new Floor(previous.clone(), current[0] - previous.x, width).setNormal(normalH, normalV),
                    );
                }
            } else {
                const wallStart = stairsGoingUp ? previous.clone() : new Point(current[0], current[1], current[2]);
                planes.push(
                    new Wall(wallStart, wallWidthOnXAxis, width, Math.abs(current[1] - previous.y)).setNormal(
                        normalH,
                        normalV,
                    ),
                );
            }

            previous.set(current[0], current[1], current[2]);
            isFloor = !isFloor;
        }

        return planes;
    }

    /** @returns list<Plane> */
    stairs(base, top, topSize, stepHeight, onX) {
        assert(topSize > 0);
        assert(stepHeight > 0);
        const fullHeight = top.y - base.y;
        assert(fullHeight > 1 && fullHeight > stepHeight);
        const stepCount = Math.trunc(Math.ceil(fullHeight / stepHeight));

        const previous = base.clone();
        let width = Math.abs(top.x - base.x);
        let depth = Math.abs(top.z - base.z);
        const stepWidth = Math.trunc(Math.floor(width / stepCount));
        const stepDepth = Math.trunc(Math.floor(depth / stepCount));

        const [angleH, angleV] = worldAngle(top, base);
        assert(angleH !== null && angleV > 0);

        const negativeZ = directionZ(angleH) === -1;
        const negativeX = directionX(angleH) === -1;
        if (negativeX || negativeZ) {
            previous.addPart(negativeX ? -width : 0, 0, negativeZ ? -depth : 0);
        }

        const planes = [];
        let currentStepHeight = stepHeight;
        for (let step = 1; step <= stepCount; step++) {
            if (step === stepCount) {
                currentStepHeight = top.y - previous.y;
            }

            const box = new Box(
                previous.clone(),
                onX ? 2 * width + topSize : width,
                currentStepHeight,
                onX ? depth : 2 * depth + topSize,
                Box.SIDE_ALL ^ Box.SIDE_BOTTOM,
            );
            for (const plane of [...box.getWalls(), ...box.getFloors()]) {
                planes.push(plane);
            }

            width = Math.max(1, width - stepWidth);
            depth = Math.max(1, depth - stepDepth);
            previous.addPart(
                negativeX ? 0 : width === 1 ? 0 : stepWidth,
                currentStepHeight,
                negativeZ ? 0 : depth === 1 ? 0 : stepDepth,
            );
        }

        return planes;
    }

    /**
     * @param {number} voxelSize positive-int
     * @param {number} voxelThreshold positive-int
     * @returns list<Point>
     */
    voxelizeTriangle(a, b, c, voxelSize, voxelThreshold, matchTriangleSize) {
        const u = [b.x - a.x, b.y - a.y, b.z - a.z];
        const v = [c.x - a.x, c.y - a.y, c.z - a.z];
        this.voxelNormal = worldAngle(
            new Point(u[1] * v[2] - u[2] * v[1], u[2] * v[0] - u[0] * v[2], u[0] * v[1] - u[1] * v[0]),
        );

        this.voxelizeLine(a, b);
        this.voxelizeLine(b, c);
        this.voxelizeLine(c, a);

        const perAxis = [new Map(), new Map(), new Map()];
        for (const voxel of this.voxels.values()) {
            if (!perAxis[0].has(voxel.x)) {
                perAxis[0].set(voxel.x, new Map());
            }
            perAxis[0].get(voxel.x).set(voxel.z, voxel);
            if (!perAxis[1].has(voxel.y)) {
                perAxis[1].set(voxel.y, new Map());
            }
            perAxis[1].get(voxel.y).set(voxel.x, voxel);
            if (!perAxis[2].has(voxel.z)) {
                perAxis[2].set(voxel.z, new Map());
            }
            perAxis[2].get(voxel.z).set(voxel.x, voxel);
        }
        for (const axisData of perAxis) {
            for (const key of [...axisData.keys()].sort((k1, k2) => k1 - k2)) {
                const data = axisData.get(key);
                if (data.size === 1) {
                    continue;
                }
                const axisKeys = [...data.keys()].sort((k1, k2) => k1 - k2);
                this.voxelizeLine(data.get(axisKeys[0]), data.get(axisKeys[axisKeys.length - 1]));
            }
        }

        const bbMin = new Point(Math.min(a.x, b.x, c.x), Math.min(a.y, b.y, c.y), Math.min(a.z, b.z, c.z));
        const bbMax = new Point(
            Math.max(a.x, b.x, c.x) - (matchTriangleSize ? voxelSize : 0),
            Math.max(a.y, b.y, c.y) - (matchTriangleSize ? voxelSize : 0),
            Math.max(a.z, b.z, c.z) - (matchTriangleSize ? voxelSize : 0),
        );

        const data = new Map();
        for (const voxel of this.voxels.values()) {
            if (matchTriangleSize && (voxel.x > bbMax.x || voxel.y > bbMax.y || voxel.z > bbMax.z)) {
                continue;
            }

            const key = [
                Math.trunc(Math.ceil((voxel.x - bbMin.x) / voxelSize)),
                Math.trunc(Math.ceil((voxel.y - bbMin.y) / voxelSize)),
                Math.trunc(Math.ceil((voxel.z - bbMin.z) / voxelSize)),
            ].join(",");
            data.set(key, (data.get(key) ?? 0) + 1);
        }

        const startPoints = [];
        const halfHeight = Math.trunc(roundHalfAwayFromZero(voxelSize / 2));
        for (const [key, hits] of data) {
            if (hits < voxelThreshold) {
                continue;
            }

            const sizeIncrements = key.split(",");
            startPoints.push(
                bbMin
                    .clone()
                    .addPart(
                        voxelSize * Number(sizeIncrements[0]),
                        voxelSize * Number(sizeIncrements[1]) - halfHeight,
                        voxelSize * Number(sizeIncrements[2]),
                    ),
            );
        }
        return startPoints;
    }

    voxelizeLine(start, end) {
        let x = start.x;
        let y = start.y;
        let z = start.z;

        const [steps, xIncrement, yIncrement, zIncrement] = stepsAndIncrements(start, end);
        for (let step = 0; step <= steps; step++) {
            this.addVoxel(roundHalfAwayFromZero(x), roundHalfAwayFromZero(y), roundHalfAwayFromZero(z));
            x += xIncrement;
            y += yIncrement;
            z += zIncrement;
        }
    }

    addVoxel(x, y, z) {
        const key = `${x},${y},${z}`;
        if (this.voxels.has(key)) {
            return;
        }

        this.voxels.set(key, new Point(x, y, z));
    }
}
