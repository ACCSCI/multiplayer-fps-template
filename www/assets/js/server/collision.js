import { assert } from "./assert.js";

/**
 * Port of server/src/Core/Collision.php
 * PHP static class -> ESM exported functions (duck-typed Point/Point2D/Box/Plane).
 */
export function boxWithSegment(boxMin, boxMax, segmentStart, segmentEnd) {
    assert(boxMin.x < boxMax.x);
    assert(boxMin.y < boxMax.y);
    assert(boxMin.z < boxMax.z);

    let tMin = 0;
    let tMax = Infinity;
    const aabbMin = [boxMin.x, boxMin.y, boxMin.z];
    const aabbMax = [boxMax.x, boxMax.y, boxMax.z];
    const lineStart = [segmentStart.x, segmentStart.y, segmentStart.z];
    const lineEnd = [segmentEnd.x, segmentEnd.y, segmentEnd.z];

    for (let i = 0; i < 3; i++) {
        const direction = lineEnd[i] - lineStart[i];
        if (direction === 0) {
            if (lineStart[i] < aabbMin[i] || lineStart[i] > aabbMax[i]) {
                return false;
            }
        } else {
            const inverseDirection = 1.0 / direction;
            let t0 = (aabbMin[i] - lineStart[i]) * inverseDirection;
            let t1 = (aabbMax[i] - lineStart[i]) * inverseDirection;

            if (inverseDirection < 0.0) {
                [t0, t1] = [t1, t0];
            }

            tMin = Math.max(tMin, t0);
            tMax = Math.min(tMax, t1);

            if (tMax <= tMin) {
                return false;
            }
        }
    }

    return true;
}

export function pointWithCircle(pointX, pointY, circleCenterX, circleCenterY, circleRadius) {
    const a = pointX - circleCenterX;
    const b = pointY - circleCenterY;
    return a * a + b * b <= circleRadius * circleRadius;
}

export function pointWithSphere(point, sphereCenter, sphereRadius) {
    const dx = point.x - sphereCenter.x;
    const dy = point.y - sphereCenter.y;
    const dz = point.z - sphereCenter.z;
    return dx * dx + dy * dy + dz * dz <= sphereRadius * sphereRadius;
}

export function cylinderWithCylinder(
    cylinderBottomCenterA,
    cylinderRadiusA,
    cylinderHeightA,
    cylinderBottomCenterB,
    cylinderRadiusB,
    cylinderHeightB,
) {
    const yTop = Math.min(cylinderBottomCenterA.y + cylinderHeightA, cylinderBottomCenterB.y + cylinderHeightB);
    const yBottom = Math.max(cylinderBottomCenterA.y, cylinderBottomCenterB.y);
    if (yTop - yBottom < 0) {
        return false;
    }

    const a = cylinderBottomCenterA.x - cylinderBottomCenterB.x;
    const b = cylinderBottomCenterA.z - cylinderBottomCenterB.z;
    const r = cylinderRadiusA + cylinderRadiusB;
    return a * a + b * b <= r * r;
}

export function pointWithCylinder(point, cylinderBottomCenter, cylinderRadius, cylinderHeight) {
    if (point.y < cylinderBottomCenter.y || point.y > cylinderBottomCenter.y + cylinderHeight) {
        return false;
    }

    const a = point.x - cylinderBottomCenter.x;
    const b = point.z - cylinderBottomCenter.z;
    return a * a + b * b <= cylinderRadius * cylinderRadius;
}

export function planeWithPlane(pointA, planeWidthA, planeHeightA, pointBx, pointBy, planeWidthB, planeHeightB) {
    return (
        pointA.x + planeWidthA >= pointBx &&
        pointA.x <= pointBx + planeWidthB &&
        pointA.y + planeHeightA >= pointBy &&
        pointA.y <= pointBy + planeHeightB
    );
}

export function circleWithRect(circleCenterX, circleCenterY, circleRadius, rectStartX, rectEndX, rectStartY, rectEndY) {
    let testX = circleCenterX;
    if (circleCenterX < rectStartX) {
        testX = rectStartX;
    } else if (circleCenterX > rectEndX) {
        testX = rectEndX;
    }
    let testY = circleCenterY;
    if (circleCenterY < rectStartY) {
        testY = rectStartY;
    } else if (circleCenterY > rectEndY) {
        testY = rectEndY;
    }

    const a = circleCenterX - testX;
    const b = circleCenterY - testY;
    return a * a + b * b <= circleRadius * circleRadius;
}

export function circleWithPlane(circleX, circleY, circleRadius, plane) {
    const planeStart = plane.getPoint2DStart();
    const planeEnd = plane.getPoint2DEnd();

    let testX;
    if (circleX < planeStart.x) {
        testX = planeStart.x;
    } else if (circleX > planeEnd.x) {
        testX = planeEnd.x;
    } else {
        testX = circleX;
    }
    let testY;
    if (circleY < planeStart.y) {
        testY = planeStart.y;
    } else if (circleY > planeEnd.y) {
        testY = planeEnd.y;
    } else {
        testY = circleY;
    }

    const a = circleX - testX;
    const b = circleY - testY;
    return a * a + b * b <= circleRadius * circleRadius;
}

export function pointWithBox(point, box) {
    const base = box.getBase();
    if (point.x < base.x || point.x > base.x + box.widthX) {
        return false;
    }
    if (point.y < base.y || point.y > base.y + box.heightY) {
        return false;
    }
    if (point.z < base.z || point.z > base.z + box.depthZ) {
        return false;
    }

    return true;
}

export function pointWithBoxBoundary(point, boxMin, boxMax) {
    assert(boxMin.x < boxMax.x);
    assert(boxMin.y < boxMax.y);
    assert(boxMin.z < boxMax.z);

    if (point.y > boxMax.y || point.y < boxMin.y) {
        return false;
    }
    if (point.x > boxMax.x || point.x < boxMin.x) {
        return false;
    }
    if (point.z > boxMax.z || point.z < boxMin.z) {
        return false;
    }

    return true;
}

export function boxWithBox(boundaryAMin, boundaryAMax, boundaryBMin, boundaryBMax) {
    assert(boundaryAMin.x < boundaryAMax.x);
    assert(boundaryAMin.y < boundaryAMax.y);
    assert(boundaryAMin.z < boundaryAMax.z);

    assert(boundaryBMin.x < boundaryBMax.x);
    assert(boundaryBMin.y < boundaryBMax.y);
    assert(boundaryBMin.z < boundaryBMax.z);

    if (boundaryAMin.x > boundaryBMax.x || boundaryBMin.x > boundaryAMax.x) {
        return false;
    }
    if (boundaryAMin.y > boundaryBMax.y || boundaryBMin.y > boundaryAMax.y) {
        return false;
    }
    if (boundaryAMin.z > boundaryBMax.z || boundaryBMin.z > boundaryAMax.z) {
        return false;
    }
    return true;
}
