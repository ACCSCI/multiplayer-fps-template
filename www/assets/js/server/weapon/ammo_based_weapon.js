import { Bullet } from "../bullet.js";
import { InventorySlot, ItemType } from "../enums.js";
import { ReloadEvent } from "../events/reload_event.js";
import { millisecondsToFrames } from "../util.js";
import { BaseWeapon } from "./base_weapon.js";

/**
 * Port of server/src/Weapon/AmmoBasedWeapon.php
 */
export class AmmoBasedWeapon extends BaseWeapon {
    /** @type {?ReloadEvent} PHP private ?ReloadEvent $eventReload = null */
    eventReload = null;

    constructor(instantlyEquip = false) {
        super(instantlyEquip);
        this.fireRateTicks = millisecondsToFrames(this.constructor.fireRateMs);
        this.recoilResetTicks = millisecondsToFrames(this.constructor.recoilResetMs);
        this.reset();
    }

    /**
     * PHP: `protected bool $isWeaponPrimary;` per-subclass property initializer
     * (runs before the parent constructor, so getSlot()/getType() work during
     * Item construction for toArrayCache). A getter mirrors that
     * constant-per-class value and stays readable at any time.
     */
    get isWeaponPrimary() {
        return false;
    }

    unEquip() {
        super.unEquip();
        this.reloading = false;
        this.resetRecoil();
    }

    reset() {
        super.reset();
        // PHP subclasses also declare `$ammo = self::magazineCapacity`; reset() sets the same value
        this.ammo = this.constructor.magazineCapacity;
        this.ammoReserve = this.constructor.reserveAmmo;
        this.reloading = false;
        this.lastAttackTick = 0;
        this.resetRecoil();
    }

    canAttack(tickId) {
        if (!this.equipped) {
            return false;
        }
        if (this.reloading) {
            return false;
        }

        return this.lastAttackTick === 0 || this.lastAttackTick + this.fireRateTicks <= tickId;
    }

    attack(event) {
        if (this.ammo === 0) {
            return null;
        }

        this.ammo--;
        this.lastAttackTick = event.getTickId();

        this.recoilModifier(event);
        event.applyRecoil(...this.getSpreadOffsets());
        return event.fire();
    }

    /** @returns {number[]} [offsetHorizontal, offsetVertical] */
    getSpreadOffsets() {
        return [0.0, 0.0];
    }

    resetRecoil(tickId = 0) {
        this.lastRecoilTick = tickId;
        this.lastRecoilBulletCount = 1;
    }

    recoilModifier(event) {
        if (this.recoilResetTicks === 0) {
            return;
        }

        const tickId = event.getTickId();
        if (this.lastRecoilTick === 0 || this.lastRecoilTick + this.recoilResetTicks < tickId) {
            // recoil is fully reset
            this.resetRecoil(tickId);
        }

        const [offsetHorizontal, offsetVertical] = this.constructor.recoilPattern[this.lastRecoilBulletCount - 1] ?? [
            0.0, 0.0,
        ];
        if (this.lastRecoilTick + this.fireRateTicks >= tickId) {
            // maximum (full spraying) recoil
            event.applyRecoil(offsetHorizontal, offsetVertical);
        } else {
            // partial recoil
            const portion = 1 - Math.min(this.recoilResetTicks, tickId - this.lastRecoilTick) / this.recoilResetTicks;
            event.applyRecoil(offsetHorizontal * portion, offsetVertical * portion);
        }
        this.lastRecoilTick = tickId;
        this.lastRecoilBulletCount++;
    }

    attackSecondary(_event) {
        return null;
    }

    createBullet() {
        const bullet = new Bullet(this, this.constructor.range);
        bullet.setProperties(this.constructor.damage);

        return bullet;
    }

    getKillAward() {
        return this.constructor.killAward;
    }

    getAmmo() {
        return this.ammo;
    }

    getAmmoReserve() {
        return this.ammoReserve;
    }

    reload() {
        if (this.reloading || this.ammo === this.constructor.magazineCapacity || this.ammoReserve === 0) {
            return null;
        }

        this.reloading = true;
        return this.createReloadEvent();
    }

    createReloadEvent() {
        if (this.eventReload === null) {
            this.eventReload = new ReloadEvent(() => {
                let newAmmo;
                if (this.ammoReserve >= this.constructor.magazineCapacity) {
                    this.ammoReserve -= this.constructor.magazineCapacity - this.ammo;
                    newAmmo = this.constructor.magazineCapacity;
                } else {
                    newAmmo = this.ammo + this.ammoReserve;
                    this.ammoReserve = Math.abs(this.constructor.magazineCapacity - newAmmo);
                    newAmmo = Math.min(this.constructor.magazineCapacity, newAmmo);
                }

                this.ammo = newAmmo;
                this.reloading = false;
            }, this.constructor.reloadTimeMs);
        }

        this.eventReload.reset();
        return this.eventReload;
    }

    getType() {
        if (this.isWeaponPrimary) {
            return ItemType.TYPE_WEAPON_PRIMARY;
        }
        return ItemType.TYPE_WEAPON_SECONDARY;
    }

    getSlot() {
        if (this.isWeaponPrimary) {
            return InventorySlot.SLOT_PRIMARY;
        }
        return InventorySlot.SLOT_SECONDARY;
    }

    isReloading() {
        return this.reloading;
    }
}
