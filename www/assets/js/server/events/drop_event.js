import { DropItem } from "../drop_item.js";
import { SoundType } from "../enums.js";
import { Sequence } from "../sequence.js";
import { directionX, directionZ, GRAVITY, nearbyInt, rotatePointY } from "../util.js";
import { Event } from "./event.js";
import { SoundEvent } from "./sound_event.js";

/**
 * Port of server/src/Event/DropEvent.php
 */
export class DropEvent extends Event {
    constructor(player, item, world) {
        super();
        /** @type {object} PHP private Player $player */
        this.player = player;
        /** @type {object} PHP private Item $item */
        this.item = item;
        /** @type {object} PHP private World $world */
        this.world = world;
        /** @type {string} PHP private string $id */
        this.id = Sequence.next();
        /** @type {Point} PHP private Point $dropPosition */
        this.dropPosition = player.getSightPositionClone();
        /** @type {DropItem} PHP private DropItem $dropItem */
        this.dropItem = new DropItem(this.id, this.item, this.dropPosition);
        /** @type {number} PHP private float $angleHorizontal */
        this.angleHorizontal = player.getSight().getRotationHorizontal();
        /** @type {number} PHP private float $angleVertical */
        this.angleVertical = player.getSight().getRotationVertical();
        /** @type {number} PHP private float $velocity */
        this.velocity = player.isMoving() || player.isJumping() ? 30.0 : 20.0;
        /** @type {number} PHP private float $timeIncrement */
        this.timeIncrement = 1 / this.timeMsToTick(100);
        if (!player.isAlive()) {
            this.velocity = 7;
            this.timeIncrement = 7;
        }
        /** @type {?function(DropItem):void} PHP null|Closure(DropItem):void */
        this.onLand = null;
        /** @type {number} PHP private float $time */
        this.time = 0.0;
    }

    /** @param {function(object):void} callback PHP function(DropItem $dropItem):void{} */
    onFloorLand(callback) {
        this.onLand = callback;
    }

    finish() {
        this.runOnCompleteHooks();
    }

    process(_tick) {
        const dropPosition = this.dropPosition;
        this.time += this.timeIncrement;
        const dirX = directionX(this.angleHorizontal);
        const dirZ = directionZ(this.angleHorizontal);

        const pos = dropPosition.clone();
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
        const maxStep = Math.max(Math.abs(targetX - x), Math.abs(targetY - y), Math.abs(targetZ - z));
        if (maxStep === 0) {
            return;
        }

        const item = this.item;
        const world = this.world;
        const player = this.player;
        const radius = this.dropItem.getBoundingRadius();
        const height = this.dropItem.getHeight();
        const playerId = this.time > 2 && this.angleVertical > 60 ? -1 : player.getId();
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

            const collisionPlayer = world.isCollisionWithOtherPlayers(playerId, pos, radius, height);
            if (collisionPlayer?.getInventory().pickup(item)) {
                const soundEvent = new SoundEvent(pos.clone(), SoundType.ITEM_PICKUP);
                world.makeSound(soundEvent.setPlayer(collisionPlayer).setItem(item).addExtra("id", this.id));
                this.finish();
                return;
            }
            if (world.isWallOrFloorCollision(dropPosition, pos, radius)) {
                this.angleVertical = -90.0;

                const floorCandidate = world.findFloorSquare(pos, radius);
                if (floorCandidate) {
                    dropPosition.setFrom(pos);
                    if (this.onLand !== null) {
                        this.onLand(this.dropItem);
                    }
                    const soundEvent = new SoundEvent(pos.clone(), SoundType.ITEM_DROP_LAND);
                    world.makeSound(soundEvent.setPlayer(player).setItem(item).addExtra("id", this.id));
                    this.finish();
                    return;
                }

                break;
            }

            dropPosition.setFrom(pos);
        }

        const soundEvent = new SoundEvent(pos.clone(), SoundType.ITEM_DROP_AIR);
        world.makeSound(soundEvent.setPlayer(player).setItem(item).addExtra("id", this.id));
    }

    /** @codeCoverageIgnore */
    /** @returns {Record<string, unknown>} PHP array<string,mixed> */
    serialize() {
        return {
            id: this.id,
            item: this.item.toArray(),
        };
    }
}
