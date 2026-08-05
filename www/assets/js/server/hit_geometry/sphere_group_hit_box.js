import { pointWithSphere } from "../collision.js";
import { Point } from "../point.js";
import { SphereHitBox } from "./sphere_hit_box.js";

/**
 * Port of server/src/HitGeometry/SphereGroupHitBox.php
 */
export class SphereGroupHitBox {
    constructor(relativeToPlayerHighestPoint) {
        this.relativeToPlayerHighestPoint = relativeToPlayerHighestPoint;
        this.parts = [];
        this.point = new Point();
    }

    intersect(player, point) {
        this.point.setScalar(0).addY(this.relativeToPlayerHighestPoint ? player.getHeadHeight() : 0);
        for (const part of this.getParts(player)) {
            if (pointWithSphere(point, part.calculateWorldCoordinate(player, this.point), part.radius)) {
                return true;
            }
        }

        return false;
    }

    addHitBox(relativeCenter, radius) {
        this.parts.push(this.createHitBox(relativeCenter, radius));
        return this;
    }

    createHitBox(relativeCenter, radius) {
        return new SphereHitBox(relativeCenter, radius);
    }

    getParts(_player) {
        return this.parts;
    }
}
