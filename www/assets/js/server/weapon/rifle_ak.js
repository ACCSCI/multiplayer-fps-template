import { HitBoxType, hasArmorBody, hasArmorHead } from "../enums.js";
import { AmmoBasedWeapon } from "./ammo_based_weapon.js";

/**
 * Port of server/src/Weapon/RifleAk.php
 */
export class RifleAk extends AmmoBasedWeapon {
    static reloadTimeMs = 2400;
    static equipReadyTimeMs = 800;
    static magazineCapacity = 30;
    static reserveAmmo = 90;
    static killAward = 300;
    static runningSpeed = 215;
    static fireRateMs = 100;
    static damage = 190;
    static armorPenetration = 77;
    static recoilResetMs = 330;
    static recoilPattern = [
        [0.0, 0.0],
        [0.1, 0.19],
        [-0.01, 0.7],
        [0.06, 1.5],
        [0.09, 2.36],
        [-0.23, 3.26],
        [-0.46, 4.03],
        [-0.82, 4.54],
        [-0.36, 4.95],
        [0.76, 4.82],
        [1.39, 5.06],
        [1.03, 5.28],
        [1.47, 5.32],
        [2.19, 5.07],
        [2.26, 5.21],
        [1.25, 5.43],
        [0.62, 5.57],
        [0.24, 5.73],
        [-0.47, 5.65],
        [-1.41, 5.42],
        [-0.9, 5.56],
        [-1.03, 5.57],
        [-0.8, 5.73],
        [-0.56, 5.78],
        [-1.09, 5.71],
        [-1.29, 5.85],
        [-0.72, 5.87],
        [0.17, 5.8],
        [1.44, 5.22],
        [1.83, 5.23],
    ];

    /** PHP `protected bool $isWeaponPrimary = true` (getter on base class) */
    get isWeaponPrimary() {
        return true;
    }

    /** @type {number} PHP protected int $price = 2700 */
    price = 2700;

    getDamageValue(hitBox, armor) {
        switch (hitBox) {
            case HitBoxType.HEAD:
                return hasArmorHead(armor) ? 111 : 143;
            case HitBoxType.CHEST:
            case HitBoxType.BACK:
                return hasArmorBody(armor) ? 27 : 35;
            case HitBoxType.STOMACH:
                return hasArmorBody(armor) ? 34 : 44;
            case HitBoxType.LEG:
                return 26;
        }
    }
}
