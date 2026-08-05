import { InventorySlot } from "../enums.js";
import { Grenade } from "./grenade.js";

/**
 * Port of server/src/Equipment/HighExplosive.php
 */
export class HighExplosive extends Grenade {
    static DAMAGE = 20;
    static MAX_BLAST_RADIUS = 400;
    static MAX_BLAST_RADIUS_SQUARED = this.MAX_BLAST_RADIUS * this.MAX_BLAST_RADIUS;

    price = 300;

    getSlot() {
        return InventorySlot.SLOT_GRENADE_HE;
    }

    getMaxBlastRadius() {
        return HighExplosive.MAX_BLAST_RADIUS;
    }

    /**
     * @param {number} distanceSquared
     * @param {boolean} harArmor
     */
    calculateDamage(distanceSquared, harArmor) {
        distanceSquared = Math.max(1, distanceSquared);
        if (distanceSquared >= HighExplosive.MAX_BLAST_RADIUS_SQUARED) {
            return 0; // @codeCoverageIgnore
        }

        const damage = HighExplosive.DAMAGE * (1 - distanceSquared / HighExplosive.MAX_BLAST_RADIUS_SQUARED);
        return Math.ceil(harArmor ? damage * 0.3 : damage);
    }
}
