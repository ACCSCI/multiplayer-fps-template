import { Bullet } from "../bullet.js";
import { HitBoxType, hasArmorBody, hasArmorHead, InventorySlot, ItemType } from "../enums.js";
import { millisecondsToFrames } from "../util.js";
import { BaseWeapon } from "./base_weapon.js";

/**
 * Port of server/src/Weapon/Knife.php
 */
export class Knife extends BaseWeapon {
    static killAward = 1500;
    static stabMaxDistance = 140;
    static equipReadyTimeMs = 500;

    /** @type {boolean} PHP private bool $primaryAttack = true */
    primaryAttack = true;
    /** @type {number} PHP private int $lastAttackTick = 0 */
    lastAttackTick = 0;

    getType() {
        return ItemType.TYPE_KNIFE;
    }

    getSlot() {
        return InventorySlot.SLOT_KNIFE;
    }

    isUserDroppable() {
        return false;
    }

    canAttack(tickId) {
        if (!this.equipped) {
            return false;
        }
        return (
            this.lastAttackTick === 0 ||
            this.lastAttackTick + millisecondsToFrames(this.primaryAttack ? 400 : 1000) <= tickId
        );
    }

    attack(event) {
        this.primaryAttack = true;
        if (!this.canAttack(event.getTickId())) {
            return null;
        }

        this.lastAttackTick = event.getTickId();
        return event.fire();
    }

    attackSecondary(event) {
        this.primaryAttack = false;
        if (!this.canAttack(event.getTickId())) {
            return null;
        }

        this.lastAttackTick = event.getTickId();
        return event.fire();
    }

    createBullet() {
        return new Bullet(this, Knife.stabMaxDistance);
    }

    getDamageValue(hitBox, armor) {
        if (hitBox === HitBoxType.BACK) {
            if (this.primaryAttack) {
                return hasArmorBody(armor) ? 76 : 90;
            }
            return hasArmorBody(armor) ? 153 : 180;
        }

        if (hitBox === HitBoxType.HEAD) {
            if (this.primaryAttack) {
                return hasArmorHead(armor) ? 34 : 40;
            }
            return hasArmorHead(armor) ? 55 : 65;
        }

        if (this.primaryAttack) {
            return hasArmorBody(armor) ? 34 : 40;
        }
        return hasArmorBody(armor) ? 55 : 65;
    }

    getKillAward() {
        return Knife.killAward;
    }
}
