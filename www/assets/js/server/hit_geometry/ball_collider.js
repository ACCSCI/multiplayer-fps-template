import { GameException } from "../game_exception.js";
import { Point } from "../point.js";
import { movementXYZ, nearbyInt, roundHalfAwayFromZero, worldAngle } from "../util.js";

/**
 * Port of server/src/HitGeometry/BallCollider.php
 * The World dependency is duck-typed (findFloorSquare / checkXSideWallCollision
 * / checkZSideWallCollision methods).
 */
export class BallCollider {
    static ANGLE_WORLD_PRECISION = 1_000_000;
    static ANGLE_ROUND_DECIMAL_PLACES = 2;

    constructor(world, origin, radius, angleHorizontal, angleVertical) {
        if (radius <= 0) {
            throw new GameException("Radius needs to be bigger than zero"); // @codeCoverageIgnore
        }

        this.world = world;
        this.radius = radius;
        this.angleHorizontal = angleHorizontal;
        this.angleVertical = angleVertical;

        this.candidate = new Point();
        this.lastMoveY = Math.sign(angleVertical);
        this.lastValidPosition = origin.clone();
        this.lastExtremePosition = origin.clone();
    }

    /** @returns {?boolean} PHP ?bool */
    hasCollision(point) {
        const moveX = Math.sign(point.x - this.lastValidPosition.x);
        const moveY = Math.sign(point.y - this.lastValidPosition.y);
        const moveZ = Math.sign(point.z - this.lastValidPosition.z);

        const r = this.radius;
        let planeCollision = null;
        this.candidate.set(point.x + r * moveX, point.y + r * moveY, point.z + r * moveZ);

        // PHP: if ($moveY !== 0 && $planeCollision = ...) {} elseif ... (first non-null wins)
        if (moveY !== 0) {
            planeCollision = this.world.findFloorSquare(this.candidate, r);
        }
        if (planeCollision === null && moveX !== 0) {
            planeCollision = this.world.checkXSideWallCollision(this.candidate, 2 * r, r);
        }
        if (planeCollision === null && moveZ !== 0) {
            planeCollision = this.world.checkZSideWallCollision(this.candidate, 2 * r, r);
        }

        if (planeCollision !== null) {
            if (planeCollision.getNormal()[1] !== 0) {
                this.angleVertical = worldAngle(point, this.lastExtremePosition)[1];
            }
            const precision = BallCollider.ANGLE_WORLD_PRECISION;
            const normalVec = planeCollision.getNormalizedNormal(this.angleHorizontal, this.angleVertical, precision);
            const directionVec = movementXYZ(this.angleHorizontal, this.angleVertical, precision);
            const doubleDotProduct =
                2 * (directionVec[0] * normalVec[0] + directionVec[1] * normalVec[1] + directionVec[2] * normalVec[2]);
            if (doubleDotProduct === 0) {
                return null;
            }
            const reflectionVec = [
                nearbyInt(directionVec[0] - doubleDotProduct * normalVec[0]),
                nearbyInt(directionVec[1] - doubleDotProduct * normalVec[1]),
                nearbyInt(directionVec[2] - doubleDotProduct * normalVec[2]),
            ];

            this.candidate.setFromArray(reflectionVec);
            const [h, v] = worldAngle(this.candidate);
            this.angleHorizontal = roundHalfAwayFromZero((h ?? 0) * 100) / 100;
            this.angleVertical = roundHalfAwayFromZero(v * 100) / 100;
            this.lastExtremePosition.setFrom(point);
            return true;
        }

        if (moveY !== 0 && this.lastMoveY !== moveY) {
            this.lastMoveY = moveY;
            this.lastExtremePosition.setFrom(point);
        }

        this.lastValidPosition.setFrom(point);
        return false;
    }

    getLastValidPosition() {
        return this.lastValidPosition.clone();
    }

    getLastExtremePosition() {
        return this.lastExtremePosition.clone();
    }

    getResolutionAngleHorizontal() {
        return this.angleHorizontal;
    }

    getResolutionAngleVertical() {
        return this.angleVertical;
    }
}
