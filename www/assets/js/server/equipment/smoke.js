import { InventorySlot } from "../enums.js";
import { Grenade } from "./grenade.js";

/**
 * Port of server/src/Equipment/Smoke.php
 * @implements {Volumetric}
 */
export class Smoke extends Grenade {
    static MAX_HEIGHT = 350;
    static MAX_CORNER_HEIGHT = 270;
    static MAX_TIME_MS = 18000;

    price = 300;

    getSlot() {
        return InventorySlot.SLOT_GRENADE_SMOKE;
    }

    getSpawnAreaMetersSquared() {
        return 120;
    }

    getMaxTimeMs() {
        return Smoke.MAX_TIME_MS;
    }

    getMaxAreaMetersSquared() {
        return 550000;
    }
}
