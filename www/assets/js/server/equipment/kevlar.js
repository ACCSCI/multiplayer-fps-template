import { assert } from "../assert.js";
import { ArmorType, InventorySlot, ItemType } from "../enums.js";
import { BaseEquipment } from "./base_equipment.js";

/**
 * Port of server/src/Equipment/Kevlar.php
 */
export class Kevlar extends BaseEquipment {
    /** @type {number} PHP private int $armor = 100 */
    armor = 100;

    constructor(bodyPlusHelmet) {
        super(true);
        this.bodyPlusHelmet = bodyPlusHelmet;
        this.type = bodyPlusHelmet ? ArmorType.BODY_AND_HEAD : ArmorType.BODY;
    }

    getArmor() {
        return this.armor;
    }

    repairArmor() {
        this.armor = 100;
    }

    /** @codeCoverageIgnore **/
    lowerArmor(armorDamage) {
        assert(armorDamage >= 0);
        this.armor -= armorDamage;
        if (this.armor <= 0) {
            this.armor = 0;
            this.type = ArmorType.NONE;
        }
    }

    getArmorType() {
        return this.type;
    }

    getType() {
        return ItemType.TYPE_KEVLAR;
    }

    getSlot() {
        return InventorySlot.SLOT_KEVLAR;
    }

    canBeEquipped() {
        return false;
    }

    isUserDroppable() {
        return false;
    }

    getMaxBuyCount() {
        return 5;
    }

    canPurchaseMultipleTime(newSlotItem) {
        if (this.armor < 100) {
            return true;
        }
        return this.type === ArmorType.BODY && newSlotItem.type === ArmorType.BODY_AND_HEAD;
    }

    getPrice(alreadyHaveSlotItem = null) {
        if (alreadyHaveSlotItem && alreadyHaveSlotItem.type === ArmorType.BODY_AND_HEAD) {
            return 650;
        }
        if (
            alreadyHaveSlotItem &&
            this.type === ArmorType.BODY_AND_HEAD &&
            alreadyHaveSlotItem.type === ArmorType.BODY &&
            alreadyHaveSlotItem.armor === 100
        ) {
            return 350;
        }
        return this.bodyPlusHelmet ? 1000 : 650;
    }
}
