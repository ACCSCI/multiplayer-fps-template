import { TickEvent } from "./tick_event.js";

/**
 * Port of server/src/Event/RoundStartEvent.php
 */
export class RoundStartEvent extends TickEvent {
    constructor(aliveAttackers, aliveDefenders, callback) {
        super(callback);
        /** @type {number} PHP private int $aliveAttackers */
        this.aliveAttackers = aliveAttackers;
        /** @type {number} PHP private int $aliveDefenders */
        this.aliveDefenders = aliveDefenders;
    }

    /** @returns {Record<string, unknown>} PHP array<string,mixed> */
    serialize() {
        return {
            attackers: this.aliveAttackers,
            defenders: this.aliveDefenders,
        };
    }
}
