import { TimeoutEvent } from "./timeout_event.js";

/**
 * Port of server/src/Event/PlantEvent.php
 */
export class PlantEvent extends TimeoutEvent {
    constructor(callback, timeoutMs, position) {
        super(callback, timeoutMs);
        /** @type {Point} PHP private Point $position */
        this.position = position;
    }

    /** @returns {Record<string, unknown>} PHP array<string,mixed> */
    serialize() {
        return {
            timeMs: this.timeoutMs,
            position: this.position.toArray(),
        };
    }
}
