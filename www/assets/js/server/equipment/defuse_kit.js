import { InventorySlot, ItemType } from "../enums.js";
import { BaseEquipment } from "./base_equipment.js";

/**
 * Port of server/src/Equipment/DefuseKit.php
 */
export class DefuseKit extends BaseEquipment {
    price = 400;

    getType() {
        return ItemType.TYPE_DEFUSE_KIT;
    }

    getSlot() {
        return InventorySlot.SLOT_KIT;
    }

    canBeEquipped() {
        return false;
    }

    isUserDroppable() {
        return false;
    }

    canPurchaseMultipleTime(_newSlotItem) {
        return false;
    }
}
