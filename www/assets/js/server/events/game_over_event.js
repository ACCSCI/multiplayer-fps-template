import { NoTickEvent } from "./no_tick_event.js";

/**
 * Port of server/src/Event/GameOverEvent.php
 */
export class GameOverEvent extends NoTickEvent {
    /** @type {number} PHP GameOverReason */
    reason;

    constructor(reason) {
        super();
        this.reason = reason;
    }

    /** @returns {Record<string, unknown>} PHP array<string,mixed> */
    serialize() {
        return {
            reason: this.reason,
        };
    }
}
