import { GameException } from "../game_exception.js";
import { Point } from "../point.js";
import { playerHeadRadius } from "../setting.js";
import { SphereGroupHitBox } from "./sphere_group_hit_box.js";

/**
 * Port of server/src/HitGeometry/HitBoxHead.php
 */
export class HitBoxHead extends SphereGroupHitBox {
    constructor() {
        super(true);

        const hitboxes = [
            [new Point(0, -8, 1), 8],
            [new Point(0, -9, 4), 8],
            [new Point(0, -15, 7), 7],
            [new Point(0, -14, 1), 7],
            [new Point(0, -20, 0), 5],
            [new Point(0, -20, 3), 5],
            [new Point(0, -20, 9), 4],
        ];

        const maxRadius = playerHeadRadius();
        for (const [point, radius] of hitboxes) {
            if (Math.abs(point.y) > 2 * maxRadius) {
                GameException.invalid(point.hash());
            }
            if (radius > maxRadius) {
                GameException.invalid(point.hash());
            }

            this.addHitBox(point, radius);
        }
    }
}
