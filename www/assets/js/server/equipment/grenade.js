import { ItemType } from "../enums.js";
import { GameException } from "../game_exception.js";
import { BaseEquipment } from "./base_equipment.js";

/**
 * Port of server/src/Equipment/Grenade.php
 * @implements {AttackEnable}
 */
export class Grenade extends BaseEquipment {
    static equipReadyTimeMs = 100;
    static boundingRadius = 10;

    /** PHP private bool $primaryAttack = true */
    primaryAttack = true;

    getType() {
        return ItemType.TYPE_GRENADE;
    }

    /**
     * @param {import("../interfaces.js").Attackable} event
     */
    attack(event) {
        this.primaryAttack = true;
        return event.fire();
    }

    /**
     * @param {import("../interfaces.js").Attackable} event
     */
    attackSecondary(event) {
        this.primaryAttack = false;
        return event.fire();
    }

    /**
     * @codeCoverageIgnore
     * @param {import("../enums.js").HitBoxType} _hitBox
     * @param {import("../enums.js").ArmorType} _armor
     */
    getDamageValue(_hitBox, _armor) {
        GameException.invalid();
    }

    getKillAward() {
        return 300;
    }

    /** PHP static::boundingRadius (late static binding) */
    getBoundingRadius() {
        return this.constructor.boundingRadius;
    }

    getSpeedMultiplier() {
        return this.primaryAttack ? 1.0 : 0.5;
    }

    /** @codeCoverageIgnore **/
    createBullet() {
        GameException.invalid(this.constructor.name);
    }
}
