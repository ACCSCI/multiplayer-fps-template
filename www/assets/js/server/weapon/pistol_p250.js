import { HitBoxType, hasArmorBody, hasArmorHead } from "../enums.js";
import { AmmoBasedWeapon } from "./ammo_based_weapon.js";

/**
 * Port of server/src/Weapon/PistolP250.php
 */
export class PistolP250 extends AmmoBasedWeapon {
    static reloadTimeMs = 2200;
    static equipReadyTimeMs = 400;
    static magazineCapacity = 13;
    static reserveAmmo = 26;
    static killAward = 300;
    static fireRateMs = 150;
    static damage = 130;
    static rangeMaxDamage = 13123;
    static recoilResetMs = 400;
    static recoilPattern = [
        [0, 0],
        [-0.12, 0.21],
        [0.4, 0.46],
        [0.1, 0.51],
        [0.28, 0.71],
        [0.32, 1.01],
        [0.12, 1.42],
        [-0.24, 1.61],
        [-0.34, 1.84],
        [0.48, 1.91],
        [0.58, 2.11],
        [-0.88, 2.49],
        [-1.28, 2.99],
    ];

    /** @type {number} PHP protected int $price = 300 */
    price = 300;

    getDamageValue(hitBox, armor) {
        switch (hitBox) {
            case HitBoxType.HEAD:
                return hasArmorHead(armor) ? 96 : 151;
            case HitBoxType.CHEST:
            case HitBoxType.BACK:
                return hasArmorBody(armor) ? 24 : 37;
            case HitBoxType.STOMACH:
                return hasArmorBody(armor) ? 30 : 47;
            case HitBoxType.LEG:
                return 28;
        }
    }
}
