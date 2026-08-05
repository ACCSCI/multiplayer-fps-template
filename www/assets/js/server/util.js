import { assert } from "./assert.js";
import { GameException } from "./game_exception.js";
import { Point } from "./point.js";

/**
 * Port of server/src/Core/Util.php
 */
export const GRAVITY = 9.8;

/** Static global Util::$TICK_RATE in PHP; mutable module state in JS. */
let tickRate = 20;

export function getTickRate() {
    return tickRate;
}

export function setTickRate(ms) {
    tickRate = ms;
}

const DEG2RAD = Math.PI / 180;
const RAD2DEG = 180 / Math.PI;

/** PHP (int) cast: truncation toward zero, normalized to +0. */
function truncateToInt(float) {
    const result = Math.trunc(float);
    return result === 0 ? 0 : result;
}

/** PHP (int)($float > 0 ? $float + .5 : $float - .5) */
export function nearbyInt(float) {
    const result = truncateToInt(float > 0 ? float + 0.5 : float - 0.5);
    return result;
}

/** PHP round() default mode: half away from zero. */
export function roundHalfAwayFromZero(float) {
    const result = Math.sign(float) * Math.round(Math.abs(float));
    return result === 0 ? 0 : result;
}

export function millisecondsToFrames(timeMs) {
    if (timeMs < 0) {
        throw new GameException("Negative time given");
    }
    return Math.ceil(timeMs / tickRate);
}

/** @returns float 0..359 */
export function normalizeAngle(angleDegree) {
    let result = angleDegree % 360;
    if (result < 0) {
        result = 360 + result;
    }
    return result;
}

export function normalizeAngleVertical(angleVerticalDegree) {
    return Math.max(-90.0, Math.min(90.0, angleVerticalDegree % 360));
}

/** @returns int[] [x, z] */
export function movementXZ(angleHorizontal, distance) {
    return [
        nearbyInt(Math.sin(angleHorizontal * DEG2RAD) * distance),
        nearbyInt(Math.cos(angleHorizontal * DEG2RAD) * distance),
    ];
}

export function smallestDeltaAngle(start, target) {
    const a = (((start - target) % 360) + 360) % 360;
    const b = (((target - start) % 360) + 360) % 360;
    return a < b ? -a : b;
}

/** @returns [horizontal|null, vertical] world angles in degree */
export function worldAngle(point, origin = new Point()) {
    const d = distanceSquared(origin, point);
    if (d === 0) {
        return [null, 0.0];
    }

    const cx = point.x - origin.x;
    const cy = point.y - origin.y;
    const cz = point.z - origin.z;

    let h = null;
    if (cz !== 0 || cx !== 0) {
        h = (450 - Math.atan2(cz, cx) * RAD2DEG) % 360.0;
    }

    const v = Math.asin(Math.abs(cy) / Math.sqrt(d)) * RAD2DEG;
    return [h, cy >= 0 ? v : -v];
}

export function directionX(angleHorizontal) {
    return angleHorizontal === 0.0 || angleHorizontal === 180.0
        ? 0
        : angleHorizontal > 0 && angleHorizontal < 180
          ? +1
          : -1;
}

export function directionY(angleVertical) {
    return angleVertical === 0.0 ? 0 : angleVertical > 0 ? +1 : -1;
}

export function directionZ(angleHorizontal) {
    return angleHorizontal === 90.0 || angleHorizontal === 270.0
        ? 0
        : angleHorizontal > 270 || angleHorizontal < 90
          ? +1
          : -1;
}

/** @returns int[] [x, y, z] */
export function movementXYZ(angleHorizontal, angleVertical, distance) {
    const y = distance * Math.sin(angleVertical * DEG2RAD);
    const z = nearbyInt(Math.sqrt(distance * distance - y * y));

    return [
        nearbyInt(Math.sin(angleHorizontal * DEG2RAD) * z),
        nearbyInt(y),
        nearbyInt(Math.cos(angleHorizontal * DEG2RAD) * z),
    ];
}

export function distanceFromOrigin(point) {
    return nearbyInt(Math.hypot(point.x, point.y));
}

export function distanceSquared(a, b) {
    const dx = a.x - b.x;
    const dy = a.y - b.y;
    const dz = a.z - b.z;
    return dx * dx + dy * dy + dz * dz;
}

export function lerpInt(start, end, percentage) {
    return truncateToInt(roundHalfAwayFromZero(start + percentage * (end - start)));
}

export function mapRange(fromMin, fromMax, toMin, toMax, value, clamp = true) {
    if (clamp) {
        value = Math.min(fromMax, Math.max(fromMin, value));
    }
    return truncateToInt(roundHalfAwayFromZero(((value - fromMin) * (toMax - toMin)) / (fromMax - fromMin) + toMin));
}

export function lerpPoint(start, end, percentage) {
    return new Point(
        lerpInt(start.x, end.x, percentage),
        lerpInt(start.y, end.y, percentage),
        lerpInt(start.z, end.z, percentage),
    );
}

/** @returns list<[x, y, z]> */
export function continuousPointsBetween(start, end, jaggedness = 1.0) {
    const [angleH, angleV] = worldAngle(end, start);
    if (angleH === null && angleV === 0.0) {
        return [];
    }

    let x = start.x;
    let y = start.y;
    let z = start.z;

    if (angleH === null) {
        const output = [];
        const step = end.y >= start.y ? 1 : -1;
        for (let yy = start.y; step > 0 ? yy <= end.y : yy >= end.y; yy += step) {
            output.push([x, yy, z]);
        }
        return output;
    }

    const output = [[x, y, z]];
    const distances = [Math.abs(end.x - x), Math.abs(end.y - y), Math.abs(end.z - z)];
    const directions = [directionX(angleH), directionY(angleV), directionZ(angleH)];
    const maxCount = distances[0] + distances[1] + distances[2];
    const stepAvg = Math.ceil(maxCount / (maxCount / 3));

    let mainAxisIndex = null;
    if (jaggedness !== 1.0) {
        const maxDistance = Math.max(...distances);
        for (let axisIndex = 0; axisIndex < 3; axisIndex++) {
            if (distances[axisIndex] === maxDistance) {
                mainAxisIndex = axisIndex;
                break;
            }
        }
    }

    let i = 1;
    const target = mainAxisIndex === null ? new Point() : end;
    while (++i <= maxCount) {
        if (mainAxisIndex === null) {
            // try match the closest diagonal path
            if (i + 2 < maxCount && (i === 2 || i % stepAvg === 0)) {
                target.set(x, y, z);
                const currentDistance = 1 + Math.ceil(Math.sqrt(distanceSquared(start, target)));
                target.setFrom(start);
                target.addPart(...movementXYZ(angleH, angleV, currentDistance));
            } else {
                target.setFrom(end);
            }
        }

        const steps = [Math.abs(target.x - x), Math.abs(target.y - y), Math.abs(target.z - z)];
        if (mainAxisIndex !== null) {
            steps[mainAxisIndex] = Math.ceil(steps[mainAxisIndex] * jaggedness);
        }
        // PHP arsort($steps, SORT_NUMERIC) is stable in PHP 8: ties keep index order.
        const order = [0, 1, 2].sort((a, b) => steps[b] - steps[a]);
        const axisMove = order[0];

        assert(steps[axisMove] > 0 && directions[axisMove] !== 0);
        x += axisMove === 0 ? directions[0] : 0;
        y += axisMove === 1 ? directions[1] : 0;
        z += axisMove === 2 ? directions[2] : 0;

        output.push([x, y, z]);
    }

    output.push([end.x, end.y, end.z]);
    return output;
}

/** @returns [steps, xIncrement, yIncrement, zIncrement] */
export function stepsAndIncrements(start, end, precision = 1.0) {
    const dx = end.x - start.x;
    const dy = end.y - start.y;
    const dz = end.z - start.z;

    // todo precision boundary check
    const steps = Math.ceil(Math.max(Math.abs(dx), Math.abs(dy), Math.abs(dz)) * precision);
    if (steps === 0) {
        return [0, 0, 0, 0];
    }

    return [steps, dx / steps, dy / steps, dz / steps];
}

/** @returns int[] new [x, z] */
export function rotatePointY(angle, x, z, centerX = 0, centerZ = 0) {
    const sin = Math.sin(angle * DEG2RAD);
    const cos = Math.cos(angle * DEG2RAD);

    return [
        centerX + nearbyInt(cos * (x - centerX) + sin * (z - centerZ)),
        centerZ + nearbyInt(-sin * (x - centerX) + cos * (z - centerZ)),
    ];
}

/** @returns int[] new [y, z] */
export function rotatePointX(angle, y, z, centerY = 0, centerZ = 0) {
    const sin = Math.sin(angle * DEG2RAD);
    const cos = Math.cos(angle * DEG2RAD);

    return [
        centerY + nearbyInt(cos * (y - centerY) - sin * (z - centerZ)),
        centerZ + nearbyInt(sin * (y - centerY) + cos * (z - centerZ)),
    ];
}

/** @returns int[] new [x, y] */
export function rotatePointZ(angle, x, y, centerX = 0, centerY = 0) {
    const sin = Math.sin(angle * DEG2RAD);
    const cos = Math.cos(angle * DEG2RAD);

    return [
        centerX + nearbyInt(cos * (x - centerX) + sin * (y - centerY)),
        centerY + nearbyInt(-sin * (x - centerX) + cos * (y - centerY)),
    ];
}
