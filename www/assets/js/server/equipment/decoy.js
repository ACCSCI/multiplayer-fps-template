import { InventorySlot } from "../enums.js";
import { Grenade } from "./grenade.js";

/**
 * Port of server/src/Equipment/Decoy.php
 */
export class Decoy extends Grenade {
    price = 50;

    getSlot() {
        return InventorySlot.SLOT_GRENADE_DECOY;
    }
}
