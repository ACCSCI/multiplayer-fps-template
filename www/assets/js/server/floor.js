import { planeWithPlane } from "./collision.js";
import { GameException } from "./game_exception.js";
import { Plane } from "./plane.js";
import { Point } from "./point.js";

/**
 * Port of server/src/Core/Floor.php
 */
export class Floor extends Plane {
    constructor(start, width = 1, depth = 1) {
        if (width <= 0 || depth <= 0) {
            throw new GameException("Width and depth cannot be lower than or equal zero");
        }
        super(start, new Point(start.x + width, start.y, start.z + depth), "xz");
        this.supportNavmesh = true;
        this.width = width;
        this.depth = depth;
        this.setNormal(0, 90);
    }

    getY() {
        return this.getStart().y;
    }

    intersect(point, radius) {
        return (
            this.getY() === point.y &&
            planeWithPlane(
                this.point2DStart,
                this.width,
                this.depth,
                point.x - radius,
                point.z - radius,
                2 * radius,
                2 * radius,
            )
        );
    }

    static fromArray(data) {
        const start = new Point(data.s.x, data.s.y, data.s.z);
        const end = new Point(data.e.x, data.e.y, data.e.z);

        return new Floor(start, end.x - start.x, end.z - start.z);
    }
}
