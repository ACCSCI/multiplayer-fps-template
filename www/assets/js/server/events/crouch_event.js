import { crouchDistancePerTick, tickCountCrouch } from "../setting.js";
import { TickEvent } from "./tick_event.js";

/**
 * Port of server/src/Event/CrouchEvent.php
 */
export class CrouchEvent extends TickEvent {
    /** @type {number} PHP readonly int $moveOffset */
    moveOffset;

    /** @param {boolean} directionDown @param {function(object, number):void} callback PHP Closure(static,int):void */
    constructor(directionDown, callback) {
        super(callback, tickCountCrouch());
        /** @type {boolean} PHP public bool $directionDown */
        this.directionDown = directionDown;
        this.moveOffset = crouchDistancePerTick();
    }

    restartTimer() {
        this.tickCount = 0;
    }
}
