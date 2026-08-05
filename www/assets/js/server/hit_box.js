import { Bullet } from "./bullet.js";
import { HitBoxType, hasArmorBody, hasArmorHead, hasNoArmor, ItemType } from "./enums.js";
import { Player } from "./player.js";

/**
 * Port of server/src/Core/HitBox.php
 * @param {Player} player
 * @param {HitBoxType} type
 * @param {import("./interfaces.js").HitIntersect} geometry
 */
export class HitBox {
    constructor(player, type, geometry) {
        this.player = player;
        this.type = type;
        this.geometry = geometry;
        this.reset();
    }

    reset() {
        this.moneyAward = 0;
        // Underscore-prefixed: the PHP property names collide with the
        // playerWasKilled()/wasHeadShot() methods in JS (instance field
        // shadows the prototype method).
        this._playerWasKilled = false;
        this._wasHeadShot = false;
        this.damage = 0;
    }

    getHitAntiForce(_point) {
        if (this.type === HitBoxType.HEAD) {
            if (hasArmorHead(this.player.getArmorType())) {
                return 95;
            }
            return 50;
        }

        if (hasArmorBody(this.player.getArmorType())) {
            return 60;
        }

        return 30;
    }

    /**
     * @param {Bullet} bullet
     */
    registerHit(bullet) {
        const hitBoxType = this.type;
        const shootItem = bullet.getShootItem();
        const playerArmorType = this.player.getArmorType();
        let healthDamage = shootItem.getDamageValue(hitBoxType, playerArmorType);
        const bulletDistance = bullet.getDistanceTraveled();
        if (bulletDistance > shootItem.constructor.rangeMaxDamage) {
            const portion =
                (bulletDistance - shootItem.constructor.rangeMaxDamage) /
                (shootItem.constructor.range + 1 - shootItem.constructor.rangeMaxDamage);
            healthDamage = Math.ceil(healthDamage * (1 - Math.max(0.99999, portion)));
        }
        const isTeamDamage = bullet.isOriginPlayerAttackerSide() === this.player.isPlayingOnAttackerSide();
        if (isTeamDamage) {
            healthDamage = Math.ceil(healthDamage / 2);
        }
        const bulletDamage = bullet.getDamage();
        let armorDamage = this.calculateArmorDamage(shootItem, playerArmorType, hitBoxType);
        if (bulletDamage < shootItem.constructor.damage) {
            const portion = (bulletDamage / shootItem.constructor.damage) * 0.9;
            healthDamage = Math.ceil(healthDamage * portion);
            armorDamage = Math.ceil(armorDamage * portion);
        }

        this.player.lowerHealth(healthDamage);
        this.player.lowerArmor(armorDamage);
        this._wasHeadShot = hitBoxType === HitBoxType.HEAD;
        this.damage = isTeamDamage ? 0 : healthDamage;
        if (!this.player.isAlive()) {
            this._playerWasKilled = true;
            this.moneyAward = isTeamDamage ? -300 : shootItem.getKillAward();
        }
    }

    calculateArmorDamage(shootItem, armorType, hitBoxType) {
        if (hasNoArmor(armorType) || hitBoxType === HitBoxType.LEG) {
            return 0;
        }
        if (hitBoxType === HitBoxType.HEAD && hasArmorBody(armorType)) {
            return 0;
        }

        let armorDamage = shootItem.getType() === ItemType.TYPE_WEAPON_PRIMARY ? 20 : 10;
        if (hasArmorHead(armorType) && hitBoxType === HitBoxType.HEAD) {
            armorDamage += 30;
        }

        return armorDamage;
    }

    intersect(point) {
        return this.geometry.intersect(this.player, point);
    }

    getPlayer() {
        return this.player;
    }

    getMoneyAward() {
        return this.moneyAward;
    }

    getType() {
        return this.type;
    }

    playerWasKilled() {
        return this._playerWasKilled;
    }

    wasHeadShot() {
        return this._wasHeadShot;
    }

    getDamage() {
        return this.damage;
    }

    /** @internal */
    getGeometry() {
        return this.geometry;
    }
}
