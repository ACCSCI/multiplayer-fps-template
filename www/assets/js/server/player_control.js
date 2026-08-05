import { BuyMenuItem, InventorySlot } from "./enums.js";
import { roundHalfAwayFromZero } from "./util.js";

/**
 * Port of server/src/Net/PlayerControl.php
 * Applies one parsed command stream to a player for the current tick.
 */
export class PlayerControl {
    constructor(player, gameState) {
        /** @type {object} PHP private Player $player */
        this.player = player;
        /** @type {object} PHP private GameState $gameState */
        this.gameState = gameState;
    }

    gamePaused() {
        return this.gameState.isPaused();
    }

    isPlantingOrDefusing() {
        return this.player.isPlantingOrDefusing();
    }

    stand() {
        if (this.isPlantingOrDefusing()) {
            return;
        }

        this.player.stand();
    }

    crouch() {
        if (this.isPlantingOrDefusing()) {
            return;
        }

        this.player.crouch();
    }

    walk() {
        if (this.gamePaused() || this.isPlantingOrDefusing()) {
            return;
        }

        this.player.speedWalk();
    }

    run() {
        if (this.gamePaused() || this.isPlantingOrDefusing()) {
            return;
        }

        this.player.speedRun();
    }

    jump() {
        if (this.gamePaused() || this.isPlantingOrDefusing()) {
            return;
        }

        this.player.jump();
    }

    drop() {
        this.player.dropEquippedItem();
    }

    reload() {
        if (this.gamePaused()) {
            return;
        }

        this.player.reload();
    }

    buy(buyMenuItemId) {
        if (!tryFromBuyMenuItem(buyMenuItemId)) {
            return;
        }
        this.player.buyItem(buyMenuItemId);
    }

    look(angleHorizontal, angleVertical) {
        this.player.getSight().look(roundTo2Decimals(angleHorizontal), roundTo2Decimals(angleVertical));
    }

    attack() {
        if (this.gamePaused()) {
            return;
        }

        this.player.attack();
    }

    attack2() {
        if (this.gamePaused()) {
            return;
        }

        this.player.attackSecondary();
    }

    use() {
        this.player.use();
    }

    equip(slotId) {
        if (!tryFromInventorySlot(slotId)) {
            return;
        }
        if (this.player.getEquippedItem().getSlot() === slotId) {
            return;
        }

        this.player.equip(slotId);
    }

    forward() {
        if (this.gamePaused() || this.isPlantingOrDefusing()) {
            return;
        }

        this.player.moveForward();
    }

    backward() {
        if (this.gamePaused() || this.isPlantingOrDefusing()) {
            return;
        }

        this.player.moveBackward();
    }

    left() {
        if (this.gamePaused() || this.isPlantingOrDefusing()) {
            return;
        }

        this.player.moveLeft();
    }

    right() {
        if (this.gamePaused() || this.isPlantingOrDefusing()) {
            return;
        }

        this.player.moveRight();
    }
}

/** PHP BuyMenuItem::tryFrom() */
function tryFromBuyMenuItem(value) {
    return Object.values(BuyMenuItem).includes(value);
}

/** PHP InventorySlot::tryFrom() */
function tryFromInventorySlot(value) {
    return Object.values(InventorySlot).includes(value);
}

/** PHP round($value, 2) - half away from zero. */
function roundTo2Decimals(value) {
    return roundHalfAwayFromZero(value * 100) / 100;
}
