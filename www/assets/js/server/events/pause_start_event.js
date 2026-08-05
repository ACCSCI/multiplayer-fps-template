import { TimeoutEvent } from "./timeout_event.js";

/**
 * Port of server/src/Event/PauseStartEvent.php
 */
export class PauseStartEvent extends TimeoutEvent {
    constructor(game, reason, callback, timeoutMs) {
        super(callback, timeoutMs);
        /** @type {object} PHP private Game $game */
        this.game = game;
        /** @type {number} PHP PauseReason */
        this.reason = reason;
    }

    /** @returns {Record<string, unknown>} PHP array<string,mixed> */
    serialize() {
        return {
            score: this.game.getScore().toArray(),
            reason: this.reason,
            ms: this.timeoutMs,
        };
    }
}
