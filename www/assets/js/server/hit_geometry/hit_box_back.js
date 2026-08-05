import { Point } from "../point.js";
import { SphereGroupHitBox } from "./sphere_group_hit_box.js";

/**
 * Port of server/src/HitGeometry/HitBoxBack.php
 */
export class HitBoxBack extends SphereGroupHitBox {
    constructor() {
        super(true);

        this.createBackLeft();
        this.createBackRight();
    }

    createBackLeft() {
        this.addHitBox(new Point(-9, -71, -4), 6);
        this.addHitBox(new Point(-9, -63, -4), 6);
        this.addHitBox(new Point(-9, -56, -6), 6);
        this.addHitBox(new Point(-9, -49, -7), 6);
        this.addHitBox(new Point(-9, -43, -8), 6);
        this.addHitBox(new Point(-9, -36, -7), 6);
        this.addHitBox(new Point(-9, -32, -5), 4);
        this.addHitBox(new Point(-3, -78, -7), 6);
        this.addHitBox(new Point(-3, -71, -6), 6);
        this.addHitBox(new Point(-3, -63, -5), 6);
        this.addHitBox(new Point(-3, -56, -7), 6);
        this.addHitBox(new Point(-3, -49, -8), 6);
        this.addHitBox(new Point(-3, -43, -9), 6);
        this.addHitBox(new Point(-3, -36, -8), 6);
        this.addHitBox(new Point(-3, -31, -7), 4);
        this.addHitBox(new Point(-9, -78, -4), 6);
    }

    createBackRight() {
        this.addHitBox(new Point(9, -71, -4), 6);
        this.addHitBox(new Point(9, -63, -4), 6);
        this.addHitBox(new Point(9, -56, -6), 6);
        this.addHitBox(new Point(9, -49, -7), 6);
        this.addHitBox(new Point(9, -43, -8), 6);
        this.addHitBox(new Point(9, -36, -7), 6);
        this.addHitBox(new Point(9, -32, -5), 4);
        this.addHitBox(new Point(3, -78, -7), 6);
        this.addHitBox(new Point(3, -71, -6), 6);
        this.addHitBox(new Point(3, -63, -5), 6);
        this.addHitBox(new Point(3, -56, -7), 6);
        this.addHitBox(new Point(3, -49, -8), 6);
        this.addHitBox(new Point(3, -43, -9), 6);
        this.addHitBox(new Point(3, -36, -8), 6);
        this.addHitBox(new Point(3, -31, -7), 4);
        this.addHitBox(new Point(9, -78, -4), 6);
    }
}
