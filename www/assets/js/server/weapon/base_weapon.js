import { Item } from "../item.js";

/**
 * Port of server/src/Weapon/BaseWeapon.php
 * PHP class constants -> JS static fields (subclasses override them).
 */
export class BaseWeapon extends Item {
    static magazineCapacity = 0;
    static reserveAmmo = 0;
    static killAward = 0;
    static runningSpeed = 0;
    static reloadTimeMs = 0;
    static fireRateMs = 0;
    static recoilResetMs = 0;
    static damage = 0;
    static armorPenetration = 0;
    static range = 20123;
    static rangeMaxDamage = 20123;
    static recoilPattern = [];
}
