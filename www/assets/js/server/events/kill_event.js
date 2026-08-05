import { TickEvent } from "./tick_event.js";

/**
 * Port of server/src/Event/KillEvent.php
 */
export class KillEvent extends TickEvent {
    constructor(playerDead, playerCulprit, attackItemId, headShot) {
        super();
        /** @type {object} PHP private Player $playerDead */
        this.playerDead = playerDead;
        /** @type {object} PHP private Player $playerCulprit */
        this.playerCulprit = playerCulprit;
        /** @type {number} PHP private int $attackItemId */
        this.attackItemId = attackItemId;
        /** @type {boolean} PHP private bool $headShot */
        this.headShot = headShot;
    }

    getPlayerDead() {
        return this.playerDead;
    }

    getPlayerCulprit() {
        return this.playerCulprit;
    }

    wasHeadShot() {
        return this.headShot;
    }

    getAttackItemId() {
        return this.attackItemId;
    }

    /** @returns {Record<string, unknown>} PHP array<string,mixed> */
    serialize() {
        return {
            playerDead: this.getPlayerDead().getId(),
            playerCulprit: this.getPlayerCulprit().getId(),
            itemId: this.getAttackItemId(),
            headshot: this.wasHeadShot(),
        };
    }
}
