import { HitBoxType, hasArmorBody, hasArmorHead } from "../enums.js";
import { AmmoBasedWeapon } from "./ammo_based_weapon.js";

/**
 * Port of server/src/Weapon/RifleM4A4.php
 */
export class RifleM4A4 extends AmmoBasedWeapon {
    static reloadTimeMs = 3100;
    static equipReadyTimeMs = 800;
    static magazineCapacity = 30;
    static reserveAmmo = 90;
    static killAward = 300;
    static runningSpeed = 215;
    static fireRateMs = 90;
    static damage = 170;
    static armorPenetration = 67;
    static recoilResetMs = 310;
    // fixme better pattern (PHP comment)
    static recoilPattern = [
        [0.0, 0.0],
        [0.09, 0.17],
        [-0.02, 0.72],
        [0.04, 1.53],
        [0.07, 2.32],
        [-0.24, 3.29],
        [-0.47, 4.01],
        [-0.84, 4.55],
        [-0.32, 4.96],
        [0.74, 4.82],
        [1.39, 5.08],
        [1.05, 5.26],
        [1.49, 5.33],
        [2.17, 5.09],
        [2.25, 5.26],
        [1.26, 5.41],
        [0.64, 5.53],
        [0.23, 5.72],
        [-0.45, 5.64],
        [-1.42, 5.42],
        [-0.91, 5.57],
        [-1.04, 5.55],
        [-0.83, 5.71],
        [-0.55, 5.79],
        [-1.06, 5.72],
        [-1.28, 5.83],
        [-0.74, 5.89],
        [0.19, 5.83],
        [1.42, 5.23],
        [1.84, 5.21],
    ];

    /** PHP `protected bool $isWeaponPrimary = true` (getter on base class) */
    get isWeaponPrimary() {
        return true;
    }

    /** @type {number} PHP protected int $price = 3100 */
    price = 3100;

    getDamageValue(hitBox, armor) {
        switch (hitBox) {
            case HitBoxType.HEAD:
                return hasArmorHead(armor) ? 92 : 131;
            case HitBoxType.CHEST:
            case HitBoxType.BACK:
                return hasArmorBody(armor) ? 23 : 32;
            case HitBoxType.STOMACH:
                return hasArmorBody(armor) ? 28 : 41;
            case HitBoxType.LEG:
                return 24;
        }
    }
}
