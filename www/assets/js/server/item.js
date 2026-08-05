import { ItemId, ItemType } from "./enums.js";
import { EquipEvent } from "./events/equip_event.js";
import { GameException } from "./game_exception.js";

/**
 * Port of server/src/Core/Item.php
 * PHP: abstract class with abstract getType()/getSlot(); JS port keeps the
 * abstract methods as throwing stubs (base-layer convention).
 */
export class Item {
    /** PHP PHP_INT_MAX */
    static equipReadyTimeMs = Number.MAX_SAFE_INTEGER;

    constructor(equipped = false) {
        this.equipped = equipped;
        this.skinId = 0;
        /** @type {number} non-negative int, PHP protected int $price = 9999 */
        this.price = 9999;
        /** @type {number} PHP protected int $scopeLevel = 0 */
        this.scopeLevel = 0;
        // PHP ItemId::$map[get_class($this)] - JS class names mirror PHP class names
        this.id = ItemId[this.constructor.name];
        this.toArrayCache = Object.freeze({
            id: this.id,
            slot: this.getSlot(),
        });
        // PHP static::equipReadyTimeMs (late static binding)
        this.eventEquip = new EquipEvent(() => {
            this.equipped = true;
        }, this.constructor.equipReadyTimeMs);
    }

    canAttack(_tickId) {
        return this.equipped;
    }

    canBeEquipped() {
        return true;
    }

    reset() {
        this.scopeLevel = 0;
    }

    isUserDroppable() {
        return true;
    }

    getMaxBuyCount() {
        return 5;
    }

    getMaxQuantity() {
        return 1;
    }

    getQuantity() {
        return 1;
    }

    getScopeLevel() {
        return this.scopeLevel;
    }

    decrementQuantity() {
        // empty hook (PHP @codeCoverageIgnore)
    }

    incrementQuantity() {
        // empty hook (PHP @codeCoverageIgnore)
    }

    /** @codeCoverageIgnore PHP: throws by default */
    clone() {
        throw new GameException(`Override clone() method if makes sense for item: ${this.constructor.name}`);
    }

    // abstract in PHP
    getType() {
        throw new Error("Not implemented: abstract method");
    }

    // abstract in PHP
    getSlot() {
        throw new Error("Not implemented: abstract method");
    }

    getId() {
        return this.id;
    }

    setSkinId(skinId) {
        this.skinId = skinId;
    }

    getSkinId() {
        return this.skinId;
    }

    getPrice(_alreadyHaveSlotItem = null) {
        return this.price;
    }

    canPurchaseMultipleTime(_newSlotItem) {
        const type = this.getType();
        if (type === ItemType.TYPE_WEAPON_PRIMARY || type === ItemType.TYPE_WEAPON_SECONDARY) {
            return true;
        }
        GameException.invalid(`New item? ${this.constructor.name}`);
    }

    equip() {
        if (!this.canBeEquipped()) {
            return null;
        }
        this.eventEquip.reset();
        return this.eventEquip;
    }

    unEquip() {
        this.equipped = false;
        this.scopeLevel = 0;
    }

    isEquipped() {
        return this.equipped;
    }

    toArray() {
        return this.toArrayCache;
    }
}
