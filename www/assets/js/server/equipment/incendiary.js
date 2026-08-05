import { InventorySlot } from "../enums.js";
import { Grenade } from "./grenade.js";

/**
 * Port of server/src/Equipment/Incendiary.php
 * @implements {Flammable}
 */
export class Incendiary extends Grenade {
    static MAX_TIME_MS = 7000;

    price = 600;

    getSlot() {
        return InventorySlot.SLOT_GRENADE_MOLOTOV;
    }

    getMaxTimeMs() {
        return Incendiary.MAX_TIME_MS;
    }

    getSpawnAreaMetersSquared() {
        return 90;
    }

    getMaxAreaMetersSquared() {
        return 200000;
    }

    /** @codeCoverageIgnore **/
    calculateDamage(hasKevlar) {
        return hasKevlar ? 7 : 3;
    }
}
