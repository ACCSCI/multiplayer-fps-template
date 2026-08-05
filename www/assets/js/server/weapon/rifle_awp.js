import { HitBoxType, hasArmorBody, hasArmorHead } from "../enums.js";
import { AmmoBasedWeapon } from "./ammo_based_weapon.js";

/**
 * Port of server/src/Weapon/RifleAWP.php
 * PHP: implements ScopeItem (scope(), isScopedIn()).
 */
export class RifleAWP extends AmmoBasedWeapon {
    static reloadTimeMs = 3700;
    static equipReadyTimeMs = 1100;
    static magazineCapacity = 5;
    static reserveAmmo = 30;
    static killAward = 100;
    static fireRateMs = 1463;
    static damage = 350;
    static armorPenetration = 90;

    /** PHP `protected bool $isWeaponPrimary = true` (getter on base class) */
    get isWeaponPrimary() {
        return true;
    }

    /** @type {number} PHP protected int $price = 4750 */
    price = 4750;

    getDamageValue(hitBox, armor) {
        switch (hitBox) {
            case HitBoxType.HEAD:
                return hasArmorHead(armor) ? 448 : 459;
            case HitBoxType.CHEST:
            case HitBoxType.BACK:
                return hasArmorBody(armor) ? 112 : 115;
            case HitBoxType.STOMACH:
                return hasArmorBody(armor) ? 140 : 143;
            case HitBoxType.LEG:
                return 85;
        }
    }

    // PHP rand(a, b) -> Math.floor(Math.random() * (b - a + 1)) + a
    getSpreadOffsets() {
        if (this.scopeLevel === 0) {
            return [
                (Math.floor(Math.random() * 31) + 30) / (Math.floor(Math.random() * 2) === 0 ? -10 : 10),
                (Math.floor(Math.random() * 31) + 20) / (Math.floor(Math.random() * 2) === 0 ? 10 : -10),
            ];
        }

        return [0.0, 0.0];
    }

    scope() {
        this.scopeLevel++;
        if (this.scopeLevel > 2) {
            this.scopeLevel = 0;
        }
    }

    isScopedIn() {
        return this.scopeLevel !== 0;
    }
}
