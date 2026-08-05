import { assert } from "./assert.js";
import { DynamicFloor } from "./dynamic_floor.js";
import { ArmorType, InventorySlot } from "./enums.js";
import { TimeoutEvent } from "./events/timeout_event.js";
import { Inventory } from "./inventory.js";
import { mixinAttack } from "./player/traits_attack.js";
import { mixinCrouch } from "./player/traits_crouch.js";
import { mixinGravity } from "./player/traits_gravity.js";
import { mixinInventory } from "./player/traits_inventory.js";
import { mixinJump } from "./player/traits_jump.js";
import { mixinMovement } from "./player/traits_movement.js";
import { PlayerCamera } from "./player_camera.js";
import { Point } from "./point.js";
import { playerBoundingRadius, playerHeadHeightStand, playerHeadRadius, playerVelocity } from "./setting.js";
import { AmmoBasedWeapon } from "./weapon/ammo_based_weapon.js";

/**
 * Port of server/src/Core/Player.php.
 * PHP traits (JumpTrait, CrouchTrait, AttackTrait, GravityTrait,
 * MovementTrait, InventoryTrait) are mixed into the Player class below via the
 * mixin*() functions applied to the prototype after the class definition -
 * method names never collide between traits, so application order is irrelevant.
 * Trait instance state is initialized by the _init*State() hook methods that
 * this constructor calls.
 */
export class Player {
    constructor(id, color, isPlayingOnAttackerSide) {
        // Event IDs, sequence - ascending order priority (PHP private ints)
        this.eventIdPrimary = 0;
        this.eventIdJump = 1;
        this.eventIdCrouch = 2;
        this.eventIdShotSlowdown = 3;
        this.eventIdMovement = 4;
        this.eventIdGravity = 5;
        this.eventIdLast = 6; // last

        this.id = id;
        this.color = color;
        // PHP private readonly bool $isPlayingOnAttackerSide; renamed to avoid
        // the JS name collision between the property and the method.
        this.playingOnAttackerSide = isPlayingOnAttackerSide;

        this._initMovementState();
        this._initGravityState();

        this.eventsCache = [];
        this.events = [];
        this.health = 0;
        this.headHeight = 0;
        this.velocity = 0;
        this.isAttacking = false;
        this.activeFloor = null;
        this.world = null;

        this.inventory = new Inventory(this.playingOnAttackerSide);
        this.sight = new PlayerCamera();
        this.position = new Point();
        this.headFloor = new DynamicFloor(this);
        this.playerBoundingRadius = playerBoundingRadius();
        this.velocity = playerVelocity();

        this.initialize();
    }

    initialize() {
        this.health = 100;
        this.walking = false;
        this.isAttacking = false;
        this.headHeight = playerHeadHeightStand();

        this.events = [];
        this.addEvent(this.createMovementEvent(), this.eventIdMovement);
        this.addEvent(this.createGravityEvent(), this.eventIdGravity);
    }

    onTick(tick) {
        if (this.activeFloor && !this.activeFloor.intersect(this.position, this.playerBoundingRadius)) {
            this.setActiveFloor(null);
        }

        for (let i = 0; i < this.eventIdLast; i++) {
            if (this.events[i] === undefined) {
                continue;
            }

            this.events[i].process(tick);
        }

        this.resetTickStates();
    }

    resetTickStates() {
        this.isAttacking = false;
    }

    onPlayerDied() {
        const dropItems = [];
        const items = this.inventory.getItems();
        if (items[InventorySlot.SLOT_PRIMARY] !== undefined) {
            dropItems.push(items[InventorySlot.SLOT_PRIMARY]);
        } else if (items[InventorySlot.SLOT_SECONDARY] !== undefined) {
            dropItems.push(items[InventorySlot.SLOT_SECONDARY]);
        }
        if (items[InventorySlot.SLOT_KIT] !== undefined) {
            dropItems.push(items[InventorySlot.SLOT_KIT]);
        } else if (items[InventorySlot.SLOT_BOMB] !== undefined) {
            dropItems.push(items[InventorySlot.SLOT_BOMB]);
        }
        for (const slot of this.inventory.getLastEquippedGrenadeSlots()) {
            if (items[slot] !== undefined) {
                dropItems.push(items[slot]);
                break;
            }
        }

        const dropCount = dropItems.length;
        if (dropCount > 0) {
            const angleOffset = 360 / dropCount;
            this.sight.lookVertical(-64);
            for (const item of dropItems) {
                this.sight.lookHorizontalOffset(angleOffset);
                this.world.dropItem(this, item);
            }
        }
    }

    addEvent(event, eventId) {
        this.events[eventId] = event;
        event.customId = eventId;
        event.onComplete.push((e) => this.removeEvent(e.customId));
    }

    removeEvent(eventId) {
        delete this.events[eventId];
    }

    isAlive() {
        return this.health !== 0;
    }

    suicide() {
        this.lowerHealth(this.health);
        this.world.playerDiedToFallDamage(this);
    }

    use() {
        this.world.playerUse(this);
    }

    /** @internal */
    setHeadHeight(height) {
        this.headHeight = height;
    }

    /** @internal */
    setVelocity(velocity) {
        this.velocity = velocity;
    }

    getHeadHeight() {
        return this.headHeight;
    }

    getSightHeight() {
        return this.headHeight - playerHeadRadius();
    }

    getSight() {
        return this.sight;
    }

    getId() {
        return this.id;
    }

    setWorld(world) {
        this.world = world;
    }

    isPlayingOnAttackerSide() {
        return this.playingOnAttackerSide;
    }

    getBoundingRadius() {
        return this.playerBoundingRadius;
    }

    lowerArmor(armorDamage) {
        const kevlar = this.inventory.getKevlar();
        if (kevlar) {
            kevlar.lowerArmor(armorDamage);
        }
    }

    lowerHealth(healthDamage) {
        assert(healthDamage >= 0);
        if (healthDamage <= 0) {
            return;
        }

        this.addEvent(new TimeoutEvent(null, 70), this.eventIdShotSlowdown);
        this.health -= healthDamage;
        if (this.health <= 0) {
            this.health = 0;
            this.onPlayerDied();
        }
    }

    isPlantingOrDefusing() {
        return this.world.isPlantingOrDefusing(this);
    }

    getHealth() {
        return this.health;
    }

    getArmorType() {
        const kevlar = this.inventory.getKevlar();
        if (kevlar) {
            return kevlar.getArmorType();
        }
        return ArmorType.NONE;
    }

    getArmorValue() {
        const kevlar = this.inventory.getKevlar();
        return kevlar ? kevlar.getArmor() : 0;
    }

    hasDefuseKit() {
        return this.inventory.has(InventorySlot.SLOT_KIT);
    }

    swapTeam() {
        this.playingOnAttackerSide = !this.playingOnAttackerSide;
    }

    roundReset() {
        this.inventory.reset(this.playingOnAttackerSide, !this.isAlive());
        this.initialize();
    }

    getHeadFloor() {
        return this.headFloor;
    }

    getBoostFloor() {
        return this.activeFloor instanceof DynamicFloor ? this.activeFloor : null;
    }

    /** @returns {Point[]} PHP list<Point> */
    getPlayerGrenadeHitPoints() {
        const output = [];
        const hitPointsCount = 5;
        const offset = Math.max(1, Math.floor((this.headHeight - 8) / (hitPointsCount - 1)));
        const candidate = this.getPositionClone().addY(4);
        for (let i = 0; i < hitPointsCount; i++) {
            output.push(candidate.clone().addY(i * offset));
        }

        return output;
    }

    /**
     * @param {{id: number, color: number, isAttacker: boolean}} data
     */
    static fromArray(data) {
        return new Player(data.id, data.color, data.isAttacker);
    }

    /**
     * @returns {{id: number, color: number, isAttacker: boolean}}
     */
    toArray() {
        return {
            id: this.id,
            color: this.color,
            isAttacker: this.playingOnAttackerSide,
        };
    }

    /** @returns {Record<string, unknown>} PHP array<string,mixed> (network snapshot protocol) */
    serialize() {
        let ammo = null;
        let ammoReserve = null;
        let reloading = false;
        const canAttack = this.world.canAttack(this);
        const equippedItem = this.inventory.getEquipped();
        if (equippedItem instanceof AmmoBasedWeapon) {
            ammo = equippedItem.getAmmo();
            ammoReserve = equippedItem.getAmmoReserve();
            reloading = equippedItem.isReloading();
        }
        const filledSlots = this.inventory.getFilledSlots();
        if (filledSlots[InventorySlot.SLOT_GRENADE_FLASH] !== undefined) {
            filledSlots[InventorySlot.SLOT_GRENADE_FLASH].pcs = this.inventory
                .getItemSlot(InventorySlot.SLOT_GRENADE_FLASH)
                ?.getQuantity();
        }

        return {
            id: this.id,
            color: this.color,
            money: this.inventory.getDollars(),
            item: equippedItem.toArrayCache,
            canAttack,
            canBuy: this.world.canBuy(this),
            canPlant: this.world.canPlant(this),
            slots: filledSlots,
            health: this.health,
            position: this.position.toArray(),
            look: this.sight.toArray(),
            isAttacker: this.playingOnAttackerSide,
            sight: this.getSightHeight(),
            armor: this.getArmorValue(),
            armorType: this.getArmorType(),
            ammo,
            ammoReserve,
            isReloading: reloading,
            scopeLevel: canAttack ? equippedItem.getScopeLevel() : 0,
        };
    }
}

// PHP trait composition: mix all six Player traits into the class prototype.
// Applied at module load, before any Player instance can be constructed.
mixinJump(Player);
mixinCrouch(Player);
mixinAttack(Player);
mixinGravity(Player);
mixinMovement(Player);
mixinInventory(Player);
