import { InventorySlot } from "../enums.js";
import { Grenade } from "./grenade.js";

/**
 * Port of server/src/Equipment/Molotov.php
 * @implements {Flammable}
 */
export class Molotov extends Grenade {
    static MAX_TIME_MS = 7000;

    price = 400;

    getSlot() {
        return InventorySlot.SLOT_GRENADE_MOLOTOV;
    }

    getMaxTimeMs() {
        return Molotov.MAX_TIME_MS;
    }

    getSpawnAreaMetersSquared() {
        return 100;
    }

    getMaxAreaMetersSquared() {
        return 450000;
    }

    /**
     * @param {boolean} hasKevlar
     */
    calculateDamage(hasKevlar) {
        return hasKevlar ? 8 : 4;
    }
}
