import { assert } from "../assert.js";
import { InventorySlot } from "../enums.js";
import { Grenade } from "./grenade.js";

/**
 * Port of server/src/Equipment/Flashbang.php
 */
export class Flashbang extends Grenade {
    /** @type {number} PHP private positive-int $quantity = 1 */
    quantity = 1;

    price = 200;

    getSlot() {
        return InventorySlot.SLOT_GRENADE_FLASH;
    }

    canPurchaseMultipleTime(_newSlotItem) {
        return this.getQuantity() < 2;
    }

    getQuantity() {
        return this.quantity;
    }

    /** PHP clone $this with quantity reset to 1 (shallow copy) */
    clone() {
        const clone = Object.assign(Object.create(Object.getPrototypeOf(this)), this);
        clone.quantity = 1;
        return clone;
    }

    getMaxQuantity() {
        return 2;
    }

    getMaxBuyCount() {
        return 2;
    }

    decrementQuantity() {
        assert(this.quantity > 1);
        this.quantity--;
    }

    incrementQuantity() {
        this.quantity++;
    }
}
