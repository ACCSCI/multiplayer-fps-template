import { assert } from "./assert.js";
import { BuyMenu } from "./buy_menu.js";
import { ArmorType, getGrenadeSlotIds, InventorySlot, ItemType } from "./enums.js";
import { Grenade } from "./equipment/grenade.js";
import { Kevlar } from "./equipment/kevlar.js";
import { GameException } from "./game_exception.js";
import { Knife } from "./weapon/knife.js";
import { PistolGlock } from "./weapon/pistol_glock.js";
import { PistolUsp } from "./weapon/pistol_usp.js";

/**
 * Port of server/src/Core/Inventory.php
 * items: PHP array<int,Item> [slotId => Item] (JS plain object, numeric keys)
 */
export class Inventory {
    /** @type {Record<number, Item>} [slotId => Item] */
    items = {};
    dollars = 0;
    /** @type {number} PHP private int $equippedSlot */
    equippedSlot = 0;
    /** @type {number} PHP private int $lastEquippedSlotId */
    lastEquippedSlotId = 0;
    /** @type {number[]} PHP int[] [slotId] */
    lastEquippedGrenadeSlots = [];

    constructor(isAttackerSide) {
        this.store = new BuyMenu(isAttackerSide, []);
        this.reset(isAttackerSide, true);
    }

    reset(isAttackerSide, respawn) {
        if (respawn) {
            this.items = {
                [InventorySlot.SLOT_KNIFE]: new Knife(),
                [InventorySlot.SLOT_SECONDARY]: isAttackerSide ? new PistolGlock(true) : new PistolUsp(true),
            };
            this.equippedSlot = InventorySlot.SLOT_SECONDARY;
            this.lastEquippedSlotId = InventorySlot.SLOT_KNIFE;
            this.lastEquippedGrenadeSlots = getGrenadeSlotIds();
        } else {
            for (const item of Object.values(this.items)) {
                item.reset();
            }
            if (this.items[InventorySlot.SLOT_SECONDARY] === undefined) {
                this.items[InventorySlot.SLOT_SECONDARY] = isAttackerSide ? new PistolGlock(true) : new PistolUsp(true);
            }
        }

        if (this.has(InventorySlot.SLOT_BOMB)) {
            this.removeBomb();
        }
        this.store.reset(isAttackerSide, this.items);
    }

    updateEquippedSlot(item) {
        this.tryRemoveLastEquippedGrenade(item);
        if (this.items[this.equippedSlot] !== undefined) {
            return this.equippedSlot;
        }

        if (this.items[this.lastEquippedSlotId] !== undefined) {
            this.equippedSlot = this.lastEquippedSlotId;
        } else {
            this.equippedSlot = InventorySlot.SLOT_KNIFE;
        }
        return this.equippedSlot;
    }

    /** @returns {number} PHP InventorySlot */
    removeBomb() {
        const bomb = this.items[InventorySlot.SLOT_BOMB] ?? null;
        if (bomb) {
            delete this.items[InventorySlot.SLOT_BOMB];
            return this.updateEquippedSlot(bomb);
        }

        GameException.invalid("You do not have bomb!"); // @codeCoverageIgnore
    }

    /** @returns {Item} */
    getEquipped() {
        return this.items[this.equippedSlot];
    }

    /** @returns {?Item} */
    getItemSlot(slot) {
        return this.items[slot] ?? null;
    }

    tryRemoveLastEquippedGrenade(item) {
        const index = this.lastEquippedGrenadeSlots.indexOf(item.getSlot());
        if (index !== -1) {
            assert(item.getType() === ItemType.TYPE_GRENADE);
            this.lastEquippedGrenadeSlots.splice(index, 1);
        }
    }

    /** @returns {?Item} */
    removeEquipped() {
        if (!this.getEquipped().isUserDroppable()) {
            return null;
        }

        const item = this.items[this.equippedSlot];
        if (item.getQuantity() === 1) {
            delete this.items[this.equippedSlot];
            this.updateEquippedSlot(item);
            item.unEquip();

            return item;
        }

        item.decrementQuantity();
        return item.clone();
    }

    removeSlot(slot) {
        const item = this.items[slot] ?? false;
        if (!item) {
            return; // @codeCoverageIgnore
        }

        if (this.equippedSlot === slot) {
            this.removeEquipped();
            return;
        }

        delete this.items[slot];
        this.updateEquippedSlot(item);
    }

    /** @returns {boolean} */
    canBuy(item) {
        const alreadyHave = this.items[item.getSlot()] ?? null;
        if (item.getPrice(alreadyHave) > this.dollars) {
            return false;
        }

        if (alreadyHave) {
            return alreadyHave.canPurchaseMultipleTime(item);
        }
        return true;
    }

    /**
     * PHP: purchase(Player $player, BuyMenuItem $buyCandidate): ?EquipEvent
     * @param {object} player Player (duck-typed: dropEquippedItem())
     * @returns {?import("./events/equip_event.js").EquipEvent}
     */
    purchase(player, buyCandidate) {
        let item = this.store.get(buyCandidate);
        if (!item || !this.canBuy(item)) {
            return null;
        }

        const alreadyHave = this.items[item.getSlot()] ?? null;
        this.dollars -= item.getPrice(alreadyHave);
        if (alreadyHave) {
            if (alreadyHave.getQuantity() < item.getMaxQuantity()) {
                alreadyHave.incrementQuantity();
                item = alreadyHave;
            } else if (alreadyHave instanceof Kevlar && alreadyHave.getArmorType() === ArmorType.BODY_AND_HEAD) {
                alreadyHave.repairArmor();
                item = alreadyHave;
            } else if (item.canBeEquipped()) {
                this.equip(item.getSlot());
                player.dropEquippedItem();
            }
        }

        this.store.confirmPurchase(item);
        this.items[item.getSlot()] = item;
        if (item.canBeEquipped()) {
            return this.equip(item.getSlot());
        }
        return null;
    }

    /** @returns {?import("./events/equip_event.js").EquipEvent} */
    equip(slot) {
        const item = this.items[slot] ?? false;
        if (!item) {
            return null;
        }

        this.items[this.equippedSlot].unEquip();
        this.lastEquippedSlotId = this.equippedSlot;
        this.equippedSlot = slot;
        if (item instanceof Grenade) {
            this.tryRemoveLastEquippedGrenade(item);
            this.lastEquippedGrenadeSlots.unshift(slot);
        }
        return item.equip();
    }

    /** @returns {boolean} */
    pickup(item) {
        const haveIt = this.items[item.getSlot()] ?? false;
        if (haveIt && haveIt.getQuantity() === haveIt.getMaxQuantity()) {
            return false;
        }
        if (item.getSlot() === InventorySlot.SLOT_KIT && this.store.forAttackerStore) {
            return false;
        }
        if (item.getSlot() === InventorySlot.SLOT_BOMB && !this.store.forAttackerStore) {
            return false;
        }

        if (haveIt) {
            haveIt.incrementQuantity();
            return true;
        }
        this.items[item.getSlot()] = item;
        return true;
    }

    getDollars() {
        return this.dollars;
    }

    earnMoney(amount) {
        this.dollars += amount;
        if (this.dollars < 0) {
            this.dollars = 0;
        }
        if (this.dollars > 16000) {
            this.dollars = 16000;
        }
    }

    /** @returns {Record<number, Item>} [slotId => Item] */
    getItems() {
        // PHP returns an array by value (copy-on-write); a shallow copy mirrors that
        return { ...this.items };
    }

    /** @returns {Record<number, {id: number, slot: number}>} [slotId => item] */
    getFilledSlots() {
        const output = {};
        for (const [key, item] of Object.entries(this.items)) {
            output[key] = item.toArrayCache;
        }
        return output;
    }

    /** @returns {number[]} */
    getLastEquippedGrenadeSlots() {
        // PHP returns an array by value (copy-on-write)
        return [...this.lastEquippedGrenadeSlots];
    }

    /** @returns {?Kevlar} */
    getKevlar() {
        return this.items[InventorySlot.SLOT_KEVLAR] ?? null; // @phpstan-ignore-line
    }

    /** @returns {boolean} */
    has(slotId) {
        return this.items[slotId] !== undefined;
    }
}
