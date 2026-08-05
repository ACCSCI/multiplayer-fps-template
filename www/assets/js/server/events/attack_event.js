import { movementXYZ, nearbyInt } from "../util.js";
import { AttackResult } from "./attack_result.js";

/**
 * Port of server/src/Event/AttackEvent.php
 * @implements {Attackable}
 */
export class AttackEvent {
    constructor(world, origin, item, angleHorizontal, angleVertical, playerId, playingOnAttackerSide) {
        /** @type {World} PHP private World $world */
        this.world = world;
        /** @type {Point} PHP private Point $origin */
        this.origin = origin;
        /** @type {object} PHP private AttackEnable $item */
        this.item = item;
        /** @type {number} PHP private float $angleHorizontal */
        this.angleHorizontal = angleHorizontal;
        /** @type {number} PHP private float $angleVertical */
        this.angleVertical = angleVertical;
        /** @type {number} PHP private int $playerId */
        this.playerId = playerId;
        /** @type {boolean} PHP private bool $playingOnAttackerSide */
        this.playingOnAttackerSide = playingOnAttackerSide;
    }

    fire() {
        const bullet = this.item.createBullet();
        bullet.setOriginPlayer(this.playerId, this.playingOnAttackerSide, this.origin.clone());
        const result = new AttackResult(bullet);

        const maxDestination = bullet
            .getOrigin()
            .clone()
            .addPart(...movementXYZ(this.angleHorizontal, this.angleVertical, bullet.distanceMax));
        this.world.optimizeBulletHitCheck(bullet, maxDestination);

        // OPTIMIZATION_1: Precalculate sin/cos
        const sinV = Math.sin((this.angleVertical * Math.PI) / 180);
        const sinH = Math.sin((this.angleHorizontal * Math.PI) / 180);
        const cosH = Math.cos((this.angleHorizontal * Math.PI) / 180);

        const newPos = this.origin.clone();
        const prevPos = newPos.clone();
        this.world.getBacktrack().saveState();
        while (bullet.isActive()) {
            const distance = bullet.incrementDistance();

            // OPTIMIZATION_1: Inline Util::movementXYZ() here
            const y = distance * sinV;
            const z = nearbyInt(Math.sqrt(distance * distance - y * y));
            newPos.set(
                this.origin.x + nearbyInt(sinH * z),
                this.origin.y + nearbyInt(y),
                this.origin.z + nearbyInt(cosH * z),
            );
            if (newPos.equals(prevPos)) {
                continue;
            }

            prevPos.setFrom(newPos);
            bullet.move(newPos);

            for (const hit of this.world.calculateHits(bullet, newPos)) {
                bullet.lowerDamage(hit.getHitAntiForce(newPos));
                result.addHit(hit);
                this.world.bulletHit(hit, bullet, hit.wasHeadShot());
                if (!bullet.isActive()) {
                    break;
                }
            }
        }
        this.world.getBacktrack().restoreState();
        return result;
    }

    /** @infection-ignore-all */
    applyRecoil(offsetHorizontal, offsetVertical) {
        this.angleHorizontal += offsetHorizontal;
        this.angleVertical += offsetVertical;
    }

    getTickId() {
        return this.world.getTickId();
    }
}
