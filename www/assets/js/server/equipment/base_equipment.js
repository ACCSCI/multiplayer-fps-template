import { Item } from "../item.js";

/**
 * Port of server/src/Equipment/BaseEquipment.php
 * Abstract in PHP: equipment items are limited to one copy per slot.
 */
export class BaseEquipment extends Item {
    getMaxBuyCount() {
        return 1;
    }
}
