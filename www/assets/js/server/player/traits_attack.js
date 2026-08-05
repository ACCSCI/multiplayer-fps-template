import { ItemType, SoundType } from "../enums.js";
import { Bomb } from "../equipment/bomb.js";
import { Grenade } from "../equipment/grenade.js";
import { AttackEvent } from "../events/attack_event.js";
import { SoundEvent } from "../events/sound_event.js";
import { ThrowEvent } from "../events/throw_event.js";
import { hasContract, ScopeItem } from "../interfaces.js";
import { throwSpeed } from "../setting.js";
import { AmmoBasedWeapon } from "../weapon/ammo_based_weapon.js";
import { Knife } from "../weapon/knife.js";

/** PHP rand(min, max): inclusive both ends. */
function randomIntInclusive(min, max) {
    return Math.floor(Math.random() * (max - min + 1)) + min;
}

/**
 * Port of server/src/Traits/Player/AttackTrait.php.
 * Mixin: methods are mounted on the Player class prototype (see player.js).
 */
export function mixinAttack(PlayerClass) {
    PlayerClass.prototype.attack = function () {
        if (this.isAttacking) {
            return null;
        }
        this.isAttacking = true;
        const item = this.getEquippedItem();

        if (item instanceof Bomb) {
            if (item.canAttack(this.world.getTickId())) {
                this.world.tryPlantBomb(this);
            }
            return null;
        }

        if (typeof item.attack !== "function") {
            return null; // @codeCoverageIgnore
        }
        if (item instanceof AmmoBasedWeapon && item.getAmmo() === 0 && !item.isReloading()) {
            const soundEvent = new SoundEvent(this.getSightPositionClone(), SoundType.ATTACK_NO_AMMO);
            this.world.makeSound(soundEvent.setPlayer(this).setItem(item));
            this.reload();
            return null;
        }
        if (!item.canAttack(this.world.getTickId())) {
            return null;
        }

        const result = item.attack(this.createAttackEvent(item));
        if (result) {
            const soundEvent = new SoundEvent(this.getSightPositionClone(), SoundType.ITEM_ATTACK);
            this.world.makeSound(soundEvent.setPlayer(this).setItem(item));
            return this.processAttackResult(result);
        }
        return null; // @codeCoverageIgnore
    };

    PlayerClass.prototype.attackSecondary = function () {
        const item = this.getEquippedItem();

        if (item instanceof Knife || item instanceof Grenade) {
            const result = item.attackSecondary(this.createAttackEvent(item));
            if (result) {
                const soundEvent = new SoundEvent(this.getSightPositionClone(), SoundType.ITEM_ATTACK2);
                this.world.makeSound(soundEvent.setPlayer(this).setItem(item));
                return this.processAttackResult(result);
            }

            return null;
        }

        if (hasContract(item, ScopeItem)) {
            item.scope();
            return null;
        }

        return null;
    };

    PlayerClass.prototype.processAttackResult = function (result) {
        this.inventory.earnMoney(result.getMoneyAward());
        return result;
    };

    PlayerClass.prototype.getThrowSpeed = function () {
        let base = throwSpeed();
        if (this.isMoving() && this.isRunning()) {
            base *= 1.2;
        }
        if (this.isJumping()) {
            base *= 1.1;
        }
        return Math.ceil(base);
    };

    PlayerClass.prototype.createAttackEvent = function (item) {
        const origin = this.getSightPositionClone();

        if (item instanceof Grenade) {
            const event = new ThrowEvent(
                this,
                this.world,
                origin,
                item,
                this.getSight().getRotationHorizontal(),
                this.getSight().getRotationVertical(),
                item.getBoundingRadius(),
                this.getThrowSpeed(),
            );
            this.world.throw(event);
            return event;
        }
        const event = new AttackEvent(
            this.world,
            origin,
            item,
            this.getSight().getRotationHorizontal(),
            this.getSight().getRotationVertical(),
            this.getId(),
            this.isPlayingOnAttackerSide(),
        );

        this.applyMovementRecoil(event);
        return event;
    };

    PlayerClass.prototype.applyMovementRecoil = function (event) {
        const item = this.getEquippedItem();
        if ([ItemType.TYPE_KNIFE, ItemType.TYPE_BOMB, ItemType.TYPE_GRENADE].includes(item.getType())) {
            return;
        }
        // fixme: better offsets value calculations for each item and smallest group range randomness as possible

        if (this.isFlying()) {
            const offsetHorizontal =
                item.getType() === ItemType.TYPE_WEAPON_PRIMARY
                    ? randomIntInclusive(15, 25)
                    : randomIntInclusive(10, 11);
            const offsetVertical =
                item.getType() === ItemType.TYPE_WEAPON_PRIMARY ? randomIntInclusive(8, 16) : randomIntInclusive(6, 12);
            event.applyRecoil(
                (randomIntInclusive(0, 1) === 1 ? -1 : 1) * offsetHorizontal,
                (randomIntInclusive(0, 1) === 1 ? -1 : 1) * offsetVertical,
            );
            return;
        }

        if (this.isCrouching()) {
            return;
        }

        if (this.isMoving()) {
            if (this.isWalking()) {
                const offsetHorizontal =
                    item.getType() === ItemType.TYPE_WEAPON_PRIMARY
                        ? randomIntInclusive(2, 4)
                        : randomIntInclusive(0, 1) === 1
                          ? randomIntInclusive(10, 19) / 10
                          : randomIntInclusive(4, 12) / 10;
                const offsetVertical =
                    item.getType() === ItemType.TYPE_WEAPON_PRIMARY
                        ? randomIntInclusive(2, 3)
                        : randomIntInclusive(0, 1) === 1
                          ? randomIntInclusive(8, 14) / 10
                          : randomIntInclusive(7, 9) / 10;
                event.applyRecoil(
                    (randomIntInclusive(0, 1) === 1 ? -1 : 1) * offsetHorizontal,
                    (randomIntInclusive(0, 1) === 1 ? -1 : 1) * offsetVertical,
                );
            } else if (this.isRunning()) {
                const offsetHorizontal =
                    item.getType() === ItemType.TYPE_WEAPON_PRIMARY
                        ? randomIntInclusive(3, 9)
                        : randomIntInclusive(3, 7);
                const offsetVertical =
                    item.getType() === ItemType.TYPE_WEAPON_PRIMARY
                        ? randomIntInclusive(5, 15)
                        : randomIntInclusive(4, 6);
                event.applyRecoil(
                    (randomIntInclusive(0, 1) === 1 ? -1 : 1) * offsetHorizontal,
                    (randomIntInclusive(0, 1) === 1 ? -1 : 1) * offsetVertical,
                );
            }
        }
    };

    PlayerClass.prototype.reload = function () {
        const item = this.getEquippedItem();
        if (typeof item.reload !== "function") {
            return;
        }

        const event = item.reload();
        if (event) {
            this.addEvent(event, this.eventIdPrimary);
            const soundEvent = new SoundEvent(this.getSightPositionClone(), SoundType.ITEM_RELOAD);
            this.world.makeSound(soundEvent.setPlayer(this).setItem(item));
        }
    };
}
