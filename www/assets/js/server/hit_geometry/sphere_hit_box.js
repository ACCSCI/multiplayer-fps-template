import { pointWithSphere } from "../collision.js";
import { GameException } from "../game_exception.js";
import { Point } from "../point.js";
import { rotatePointY } from "../util.js";

/**
 * Port of server/src/HitGeometry/SphereHitBox.php
 */
export class SphereHitBox {
    constructor(relativeCenter, radius) {
        if (radius <= 0) {
            throw new GameException("Radius needs to be bigger than zero");
        }
        this.relativeCenter = relativeCenter;
        this.radius = radius;
        this.point = new Point();
    }

    intersect(player, point) {
        return pointWithSphere(point, this.calculateWorldCoordinate(player), this.radius);
    }

    calculateWorldCoordinate(player, centerModifier = null) {
        const [x, z] = rotatePointY(
            player.getSight().getRotationHorizontal(),
            this.relativeCenter.x,
            this.relativeCenter.z,
        );
        this.point.setFrom(player.getReferenceToPosition());
        this.point.addPart(x, this.relativeCenter.y, z);

        if (centerModifier) {
            this.point.add(centerModifier);
        }

        return this.point;
    }
}
