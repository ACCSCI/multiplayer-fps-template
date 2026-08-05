import { Bullet } from "../bullet.js";
import { SoundType } from "../enums.js";
import { Flashbang } from "../equipment/flashbang.js";
import { HighExplosive } from "../equipment/high_explosive.js";
import { Incendiary } from "../equipment/incendiary.js";
import { Molotov } from "../equipment/molotov.js";
import { Smoke } from "../equipment/smoke.js";
import { GameException } from "../game_exception.js";
import { BallCollider } from "../hit_geometry/ball_collider.js";
import { Sequence } from "../sequence.js";
import { directionX, directionZ, GRAVITY, nearbyInt, rotatePointY } from "../util.js";
import { AttackResult } from "./attack_result.js";
import { Event } from "./event.js";
import { SoundEvent } from "./sound_event.js";

/** PHP "instanceof Flammable": only Molotov and Incendiary implement it. */
function isFlammable(item) {
    return item instanceof Molotov || item instanceof Incendiary;
}

/**
 * Port of server/src/Event/ThrowEvent.php
 * @implements {Attackable}
 */
export class ThrowEvent extends Event {
    constructor(player, world, origin, item, angleHorizontal, angleVertical, radius, velocity) {
        super();
        if (velocity <= 0) {
            throw new GameException("Velocity needs to be positive");
        }

        /** @type {object} PHP private Player $player */
        this.player = player;
        /** @type {object} PHP private World $world */
        this.world = world;
        /** @type {object} PHP public Grenade $item */
        this.item = item;
        /** @type {number} PHP private float $angleHorizontal */
        this.angleHorizontal = angleHorizontal;
        /** @type {number} PHP private float $angleVertical */
        this.angleVertical = angleVertical;
        /** @type {number} PHP public readonly int $radius */
        this.radius = radius;
        /** @type {number} PHP private float $velocity */
        this.velocity = velocity;
        /** @type {string} PHP private readonly string $id */
        this.id = Sequence.next();
        /** @type {number} PHP private float $time */
        this.time = 0.0;
        /** @type {number} PHP private float $timeIncrement */
        this.timeIncrement = 1 / this.timeMsToTick(150); // fixme some good value or velocity or gravity :)
        /** @type {Point} PHP private Point $position */
        this.position = origin.clone();
        /** @type {Point} PHP private Point $floorCandidate */
        this.floorCandidate = origin.clone();
        /** @type {BallCollider} PHP private BallCollider $ball */
        this.ball = new BallCollider(world, origin, radius, angleHorizontal, angleVertical);
        /** @type {boolean} PHP private bool $needsToLandOnFloor */
        this.needsToLandOnFloor = !(item instanceof Flashbang || item instanceof HighExplosive);
        /** @type {number} PHP private int $tickMax */
        this.tickMax = this.getTickId() + this.timeMsToTick(this.needsToLandOnFloor ? 30000 : 1200);
        /** @type {number} PHP private int $bounceCount */
        this.bounceCount = 0;
        /** @type {boolean} PHP private bool $lastBounce */
        this.lastBounce = false;
    }

    /** @returns {Event} PHP Event */
    makeEvent(point, type) {
        const event = new SoundEvent(point.clone(), type)
            .setItem(this.item)
            .setPlayer(this.player)
            .addExtra("id", this.id);
        this.world.makeSound(event);
        return event;
    }

    finishLanding(point) {
        if (!this.needsToLandOnFloor) {
            this.makeEvent(point, SoundType.GRENADE_LAND);
            this.runOnCompleteHooks();
            return;
        }

        if (this.tickMax > 0) {
            point.addY(-this.radius);
            this.tickMax = 0;
        }
        for (let i = 1; i <= Math.ceil(GRAVITY * 2); i++) {
            if (!this.world.findFloorSquare(point, this.radius)) {
                point.addY(-1);
                continue;
            }

            point.addY(this.radius);
            this.makeEvent(point, SoundType.GRENADE_LAND);
            this.runOnCompleteHooks();
            return;
        }
    }

    process(tick) {
        if (this.tickMax < tick) {
            this.finishLanding(this.position);
            return;
        }

        const pos = this.position;
        this.time += this.timeIncrement;
        const dirX = directionX(this.angleHorizontal);
        const dirZ = directionZ(this.angleHorizontal);

        let x = pos.x;
        let y = pos.y;
        let z = pos.z;

        let targetX = nearbyInt(this.velocity * this.time * Math.cos((this.angleVertical * Math.PI) / 180));
        const targetY =
            y +
            nearbyInt(
                this.velocity * this.time * Math.sin((this.angleVertical * Math.PI) / 180) -
                    0.5 * GRAVITY * this.time * this.time,
            );
        let targetZ;
        [targetX, targetZ] = rotatePointY(this.angleHorizontal, 0, targetX);
        targetX += x;
        targetZ += z;
        // fixme cap to some max (min value) and do partial float round sub-step for lower targets based on maxTargetDistance
        const maxStep = Math.max(Math.abs(targetX - x), Math.abs(targetY - y), Math.abs(targetZ - z));
        if (maxStep === 0) {
            return;
        }
        if (this.lastBounce && this.angleVertical >= 0 && targetY < y) {
            // gravity force too strong for going up
            this.finishLanding(pos);
            return;
        }
        this.lastBounce = false;

        const dirY = Math.sign(targetY - y);
        for (let step = 1; step <= maxStep; step++) {
            if (targetX !== x) {
                x += dirX;
                pos.x = x;
            }
            if (targetY !== y) {
                y += dirY;
                pos.y = y;
            }
            if (targetZ !== z) {
                z += dirZ;
                pos.z = z;
            }

            const ballCollision = this.ball.hasCollision(pos);
            if (ballCollision === false) {
                continue;
            }

            /** @infection-ignore-all */
            if (
                this.ball.getResolutionAngleVertical() > 0 &&
                (isFlammable(this.item) || this.item instanceof Smoke) &&
                this.world.findFloorSquare(this.floorCandidate.set(pos.x, pos.y - this.radius, pos.z), this.radius)
            ) {
                if (isFlammable(this.item)) {
                    this.finishLanding(pos);
                    return;
                }
                if (this.world.isCollisionWithMolotov(this.floorCandidate)) {
                    this.finishLanding(pos);
                    return;
                }
            }

            this.setAngles(this.ball.getResolutionAngleHorizontal(), this.ball.getResolutionAngleVertical());
            this.bounceCount++;
            this.velocity = this.velocity / (this.bounceCount > 4 ? this.bounceCount : 1.5);
            if (ballCollision === null) {
                this.finishLanding(pos);
                return;
            }

            this.makeEvent(pos, SoundType.GRENADE_BOUNCE);
            this.lastBounce = true;
            this.time = 0.0;
            pos.setFrom(this.ball.getLastValidPosition());
            return;
        }

        this.makeEvent(pos, SoundType.GRENADE_AIR);
    }

    /** @returns {AttackResult} */
    fire() {
        this.player.getInventory().removeEquipped();
        this.player.equip(this.player.getEquippedItem().getSlot());
        this.velocity *= this.item.getSpeedMultiplier();
        const bullet = new Bullet(this.item);
        return new AttackResult(bullet);
    }

    getTickId() {
        return this.world.getTickId();
    }

    /** @codeCoverageIgnore */
    applyRecoil(_offsetHorizontal, _offsetVertical) {
        // no recoil on throw
    }

    setAngles(angleHorizontal, angleVertical) {
        this.angleHorizontal = angleHorizontal;
        this.angleVertical = angleVertical;
    }

    /** @codeCoverageIgnore */
    /** @returns {Record<string, unknown>} PHP array<string,mixed> */
    serialize() {
        return {
            id: this.id,
            radius: this.radius,
            item: this.item.toArray(),
            position: this.position.toArray(),
        };
    }

    getPositionClone() {
        return this.position.clone();
    }

    getPlayer() {
        return this.player;
    }
}
