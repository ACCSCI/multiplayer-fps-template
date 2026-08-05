import { GameException } from "./game_exception.js";
import { SolidSurface } from "./solid_surface.js";
import {
    movementXYZ,
    normalizeAngle,
    normalizeAngleVertical,
    roundHalfAwayFromZero,
    smallestDeltaAngle,
} from "./util.js";

/**
 * Port of server/src/Core/Plane.php
 */
export class Plane extends SolidSurface {
    static MAX_HIT_ANTI_FORCE = 99999;

    constructor(start, end, axis2d) {
        super();
        this.penetrable = true;
        this.hitAntiForce = 25123;
        this.hitAntiForceMargin = 10;
        this.wallBangEdgeMarginDistance = 8;
        this.normal = 0;
        this.start = start;
        this.end = end;
        this.axis2d = axis2d;
        this.point2DStart = this.start.to2D(axis2d);
        this.point2DEnd = this.end.to2D(axis2d);
    }

    setPenetrable(penetrable) {
        this.penetrable = penetrable;
        return this;
    }

    setHitAntiForce(hitAntiForceBody, hitAntiForceMargin, wallBangEdgeMarginDistance) {
        this.hitAntiForce = Math.max(0, hitAntiForceBody);
        this.hitAntiForceMargin = Math.max(0, hitAntiForceMargin);
        this.wallBangEdgeMarginDistance = Math.max(0, wallBangEdgeMarginDistance);
    }

    setNormal(angleHorizontal, angleVertical) {
        let h = Math.trunc(normalizeAngle(angleHorizontal ?? 0));
        h += h > 180 ? -180 : 0;
        const v = Math.trunc(normalizeAngleVertical(angleVertical));
        this.normal = (h << 8) | Math.abs(v);
        return this;
    }

    /** @returns [horizontal, vertical] */
    getNormal() {
        return [this.normal >> 8, this.normal & 0xff];
    }

    /** @returns [x, y, z] normalized */
    getNormalizedNormal(targetAngleHorizontal, targetAngleVertical, precision) {
        const [normalHorizontal, normalVertical] = this.getNormal();
        const deltaHorizontal = Math.abs(
            smallestDeltaAngle(Math.trunc(roundHalfAwayFromZero(targetAngleHorizontal)), normalHorizontal),
        );
        const deltaVertical = Math.abs(
            smallestDeltaAngle(Math.trunc(roundHalfAwayFromZero(targetAngleVertical)), normalVertical),
        );
        let h = normalHorizontal;
        let v = normalVertical;
        if (deltaHorizontal < 90) {
            h = normalizeAngle(normalHorizontal + 180);
        }
        if (deltaVertical < 90) {
            v *= -1;
        }

        const normalVec = movementXYZ(h, v, precision);
        const precisionFloat = precision;
        return [normalVec[0] / precisionFloat, normalVec[1] / precisionFloat, normalVec[2] / precisionFloat];
    }

    getHitAntiForce(point) {
        if (!this.penetrable) {
            return Plane.MAX_HIT_ANTI_FORCE;
        }

        const hit = point.to2D(this.axis2d);
        if (
            hit.x < this.point2DStart.x ||
            hit.x > this.point2DEnd.x ||
            hit.y < this.point2DStart.y ||
            hit.y > this.point2DEnd.y
        ) {
            throw new GameException(`Hit '${hit}' (${point}) out of plane boundary '${this}'`);
        }

        const margin = this.wallBangEdgeMarginDistance;
        if (hit.x - this.point2DStart.x <= margin || this.point2DEnd.x - hit.x <= margin) {
            return this.hitAntiForceMargin;
        }
        if (hit.y - this.point2DStart.y <= margin || this.point2DEnd.y - hit.y <= margin) {
            return this.hitAntiForceMargin;
        }

        return this.hitAntiForce;
    }

    getPoint2DStart() {
        return this.point2DStart;
    }

    getPoint2DEnd() {
        return this.point2DEnd;
    }

    getStart() {
        return this.start;
    }

    getEnd() {
        return this.end;
    }

    toString() {
        return `${this.constructor.name}(\n start${this.getStart()}\n end${this.getEnd()}\n axis: ${this.axis2d}\n)`;
    }

    toArray() {
        return {
            s: this.start.toArray(),
            e: this.end.toArray(),
            p: this.axis2d,
        };
    }

    getPlane() {
        return this.axis2d;
    }
}
