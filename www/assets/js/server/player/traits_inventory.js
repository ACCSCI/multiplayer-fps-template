import { InventorySlot, SoundType } from "../enums.js";
import { SoundEvent } from "../events/sound_event.js";

/**
 * Port of server/src/Traits/Player/InventoryTrait.php.
 * Mixin: methods are mounted on the Player class prototype (see player.js).
 */
export function mixinInventory(PlayerClass) {
    PlayerClass.prototype.equip = function (slot) {
        if (slot === InventorySlot.SLOT_KEVLAR || slot === InventorySlot.SLOT_KIT) {
            return false;
        }

        const event = this.inventory.equip(slot);
        if (event) {
            this.addEvent(event, this.eventIdPrimary);
            return true;
        }

        return false;
    };

    PlayerClass.prototype.equipKnife = function () {
        this.equip(InventorySlot.SLOT_KNIFE);
    };

    PlayerClass.prototype.equipPrimaryWeapon = function () {
        this.equip(InventorySlot.SLOT_PRIMARY);
    };

    PlayerClass.prototype.equipSecondaryWeapon = function () {
        this.equip(InventorySlot.SLOT_SECONDARY);
    };

    PlayerClass.prototype.getEquippedItem = function () {
        return this.inventory.getEquipped();
    };

    PlayerClass.prototype.dropItemFromSlot = function (slot) {
        if (!this.inventory.has(slot)) {
            return false;
        }
        const item = this.inventory.getItems()[slot];
        if (!item.isUserDroppable()) {
            return false;
        }

        this.inventory.removeSlot(slot);
        this.world.dropItem(this, item);
        return true;
    };

    PlayerClass.prototype.dropEquippedItem = function () {
        const item = this.inventory.removeEquipped();
        if (item === null) {
            return null;
        }

        this.world.dropItem(this, item);
        this.equip(this.getEquippedItem().getSlot());
        return item;
    };

    PlayerClass.prototype.buyItem = function (item) {
        if (!this.world.canBuy(this)) {
            return false;
        }

        const equipEvent = this.inventory.purchase(this, item);
        if (equipEvent) {
            this.addEvent(equipEvent, this.eventIdPrimary);
            const soundEvent = new SoundEvent(this.getSightPositionClone(), SoundType.ITEM_BUY);
            this.world.makeSound(soundEvent.setPlayer(this));
            return true;
        }

        return false;
    };

    PlayerClass.prototype.getInventory = function () {
        return this.inventory;
    };

    PlayerClass.prototype.getMoney = function () {
        return this.inventory.getDollars();
    };
}
