import { normalizeAngle } from "./util.js";

/**
 * Port of server/src/Core/PlayerCamera.php
 */
export class PlayerCamera {
    /** @type {number} PHP private float $rotationHorizontal */
    rotationHorizontal = 0.0;
    /** @type {number} PHP private float $rotationVertical */
    rotationVertical = 0.0;

    look(angleHorizontal, angleVertical) {
        this.lookHorizontal(angleHorizontal);
        this.lookVertical(angleVertical);
    }

    lookVertical(angle) {
        if (angle < -90) {
            angle = -90;
        }
        if (angle > 90) {
            angle = 90;
        }

        this.rotationVertical = angle;
    }

    lookHorizontal(angle) {
        this.rotationHorizontal = normalizeAngle(angle);
    }

    lookHorizontalOffset(angle) {
        this.lookHorizontal(this.rotationHorizontal + angle);
    }

    getRotationHorizontal() {
        return this.rotationHorizontal;
    }

    getRotationVertical() {
        return this.rotationVertical;
    }

    /** @returns {Record<string, number>} PHP array<string,float> */
    toArray() {
        return {
            horizontal: this.getRotationHorizontal(),
            vertical: this.getRotationVertical(),
        };
    }
}
