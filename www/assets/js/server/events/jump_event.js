import { TickEvent } from "./tick_event.js";

/**
 * Port of server/src/Event/JumpEvent.php
 * NOTE: PHP `public int $maxYPosition` starts uninitialized (null semantics);
 * it is set by the Player jump logic. JS initializes it to 0.
 */
export class JumpEvent extends TickEvent {
    /** @type {number} PHP public int $maxYPosition */
    maxYPosition = 0;
}
