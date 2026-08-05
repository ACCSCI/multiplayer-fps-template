import { HitBoxType, hasArmorBody, hasArmorHead } from "../enums.js";
import { AmmoBasedWeapon } from "./ammo_based_weapon.js";

/**
 * Port of server/src/Weapon/PistolGlock.php
 */
export class PistolGlock extends AmmoBasedWeapon {
    static reloadTimeMs = 2300;
    static equipReadyTimeMs = 400;
    static magazineCapacity = 12;
    static reserveAmmo = 120;
    static killAward = 300;
    static fireRateMs = 150;
    static damage = 110;
    static rangeMaxDamage = 8123;
    static recoilResetMs = 300;
    static recoilPattern = [
        [0, 0],
        [0.12, 0.19],
        [0.13, 0.32],
        [0.24, 0.43],
        [0.21, 0.64],
        [0.24, 0.89],
        [0.12, 1.11],
        [-0.09, 1.25],
        [-0.12, 1.39],
        [0.16, 1.54],
        [0.33, 1.85],
        [-0.68, 2.09],
    ];

    /** @type {number} PHP protected int $price = 200 */
    price = 200;

    getDamageValue(hitBox, armor) {
        switch (hitBox) {
            case HitBoxType.HEAD:
                return hasArmorHead(armor) ? 56 : 119;
            case HitBoxType.CHEST:
            case HitBoxType.BACK:
                return hasArmorBody(armor) ? 14 : 29;
            case HitBoxType.STOMACH:
                return hasArmorBody(armor) ? 17 : 37;
            case HitBoxType.LEG:
                return 22;
        }
    }
}
