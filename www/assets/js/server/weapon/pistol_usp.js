import { HitBoxType, hasArmorBody, hasArmorHead } from "../enums.js";
import { AmmoBasedWeapon } from "./ammo_based_weapon.js";

/**
 * Port of server/src/Weapon/PistolUsp.php
 */
export class PistolUsp extends AmmoBasedWeapon {
    static reloadTimeMs = 2200;
    static equipReadyTimeMs = 400;
    static magazineCapacity = 12;
    static reserveAmmo = 24;
    static killAward = 300;
    static fireRateMs = 170;
    static damage = 116;
    static rangeMaxDamage = 11123;
    static recoilResetMs = 300;
    static recoilPattern = [
        [0, 0],
        [-0.02, 0.12],
        [0.1, 0.36],
        [0.2, 0.41],
        [0.18, 0.61],
        [0.12, 0.91],
        [0.02, 1.01],
        [-0.04, 1.21],
        [-0.14, 1.34],
        [0.18, 1.51],
        [0.38, 1.81],
        [-0.58, 1.99],
    ];

    /** @type {number} PHP protected int $price = 200 */
    price = 200;

    getDamageValue(hitBox, armor) {
        switch (hitBox) {
            case HitBoxType.HEAD:
                return hasArmorHead(armor) ? 70 : 140;
            case HitBoxType.CHEST:
            case HitBoxType.BACK:
                return hasArmorBody(armor) ? 17 : 34;
            case HitBoxType.STOMACH:
                return hasArmorBody(armor) ? 22 : 43;
            case HitBoxType.LEG:
                return 26;
        }
    }
}
