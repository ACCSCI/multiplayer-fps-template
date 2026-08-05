import { pointWithCircle } from "./collision.js";
import { Floor } from "./floor.js";
import { GameException } from "./game_exception.js";
import { Point } from "./point.js";

/**
 * Port of server/src/Core/DynamicFloor.php
 * The Player dependency is duck-typed (passed in, only methods are called).
 */
export class DynamicFloor extends Floor {
    constructor(player) {
        // PHP does not call the parent constructor here (no parent::__construct),
        // which would leave the Floor geometry state uninitialized. JS subclass
        // constructors must call super(); minimal valid values keep instanceof
        // checks working and the overridden methods never touch parent state.
        super(new Point(0, 0, 0), 1, 1);
        this.player = player;
        this.pointReference = player.getReferenceToPosition();
    }

    getPlayer() {
        return this.player;
    }

    getY() {
        return this.pointReference.y + this.player.getHeadHeight() + 1;
    }

    intersect(point, radius) {
        return (
            this.player.isAlive() &&
            this.pointReference.y + this.player.getHeadHeight() + 1 === point.y &&
            pointWithCircle(
                this.pointReference.x,
                this.pointReference.z,
                point.x,
                point.z,
                this.player.getBoundingRadius() + radius,
            )
        );
    }

    // @codeCoverageIgnore
    getHitAntiForce(_point) {
        GameException.invalid();
    }

    // @codeCoverageIgnore
    getPlane() {
        GameException.invalid();
    }
}
