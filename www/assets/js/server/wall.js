import { GameException } from "./game_exception.js";
import { Plane } from "./plane.js";
import { Point } from "./point.js";

/**
 * Port of server/src/Core/Wall.php
 */
export class Wall extends Plane {
    constructor(start, widthOnXAxis = true, width = 1, height = 3800) {
        if (width <= 0 || height <= 0) {
            throw new GameException("Width and height cannot be lower than or equal zero");
        }

        if (widthOnXAxis) {
            super(start, new Point(start.x + width, start.y + height, start.z), "xy");
            this.setNormal(0, 0);
        } else {
            super(start, new Point(start.x, start.y + height, start.z + width), "zy");
            this.setNormal(90, 0);
        }
        this.widthOnXAxis = widthOnXAxis;
        this.width = width;
        this.height = height;
    }

    getBase() {
        return this.widthOnXAxis ? this.getStart().z : this.getStart().x;
    }

    isWidthOnXAxis() {
        return this.widthOnXAxis;
    }

    getFloor() {
        return this.point2DStart.y;
    }

    getCeiling() {
        return this.point2DEnd.y;
    }

    static fromArray(data) {
        const start = new Point(data.s.x, data.s.y, data.s.z);
        const end = new Point(data.e.x, data.e.y, data.e.z);
        const axis = data.p;
        let widthOnXAxis = true;
        let width = end.x - start.x;
        if (axis === "zy") {
            widthOnXAxis = false;
            width = end.z - start.z;
        }

        return new Wall(start, widthOnXAxis, width, end.y - start.y);
    }
}
