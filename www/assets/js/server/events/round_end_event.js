import { TickEvent } from "./tick_event.js";

/**
 * Port of server/src/Event/RoundEndEvent.php
 */
export class RoundEndEvent extends TickEvent {
    /** @type {number} PHP readonly int $roundNumberEnded */
    roundNumberEnded;

    constructor(game, attackersWins, reason) {
        super();
        /** @type {object} PHP private Game $game */
        this.game = game;
        /** @type {boolean} PHP public readonly bool $attackersWins */
        this.attackersWins = attackersWins;
        /** @type {number} PHP public readonly RoundEndReason $reason */
        this.reason = reason;
        this.roundNumberEnded = game.getRoundNumber();
    }

    /** @returns {Record<string, unknown>} PHP array<string,mixed> */
    serialize() {
        return {
            roundNumber: this.roundNumberEnded,
            newRoundNumber: this.roundNumberEnded + 1,
            attackersWins: this.attackersWins,
            score: this.game.getScore().toArray(),
        };
    }
}
