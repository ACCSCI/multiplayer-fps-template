import { assert } from "../assert.js";
import { boxWithSegment, pointWithSphere } from "../collision.js";
import { SoundType } from "../enums.js";
import { SoundEvent } from "../events/sound_event.js";
import { Item } from "../item.js";
import { Point } from "../point.js";
import { playerHeadHeightStand } from "../setting.js";
import { SolidSurface } from "../solid_surface.js";
import { distanceSquared, movementXYZ } from "../util.js";

/**
 * Line-of-sight and bullet-hit resolution for the World (port of the related
 * methods in server/src/Core/World.php). The methods are mounted on
 * World.prototype via installLos() called from world/index.js.
 */

function canBeSeen(observer, targetCenter, targetRadius, maximumDistance, checkForOtherPlayersAlso = false) {
    const start = observer.getSightPositionClone();
    if (distanceSquared(start, targetCenter) > maximumDistance * maximumDistance) {
        return false;
    }

    return this.pointCanSeePoint(
        start,
        targetCenter,
        observer.getSight().getRotationHorizontal(),
        observer.getSight().getRotationVertical(),
        maximumDistance,
        checkForOtherPlayersAlso ? observer.getId() : null,
        targetRadius,
        observer.getBoundingRadius(),
    );
}

function pointCanSeePoint(
    observer,
    targetCenter,
    angleHorizontal,
    angleVertical,
    maximumDistance,
    playerIdSkip = -1,
    targetRadius = 1,
    startDistance = 0,
) {
    const prevPos = observer.clone();
    const candidate = observer.clone();
    for (let distance = startDistance; distance <= maximumDistance; distance++) {
        const [x, y, z] = movementXYZ(angleHorizontal, angleVertical, distance);
        candidate.set(observer.x + x, observer.y + y, observer.z + z);
        if (candidate.equals(prevPos)) {
            continue;
        }
        prevPos.setFrom(candidate);

        if (pointWithSphere(candidate, targetCenter, targetRadius)) {
            return true;
        }
        if (this.isFloorAt(candidate)) {
            return false;
        }
        if (this.isWallAt(candidate)) {
            return false;
        }
        if (playerIdSkip !== null && this.isCollisionWithOtherPlayers(playerIdSkip, candidate, 0, 0)) {
            return false;
        }
    }

    return false;
}

function optimizeBulletHitCheck(bullet, maxDestination) {
    const boxMin = new Point();
    const boxMax = new Point();
    for (const player of this.game.getPlayers()) {
        const playerId = player.getId();
        if (!player.isAlive()) {
            bullet.addPlayerIdSkip(playerId);
            continue;
        }

        const playerRadius = player.getBoundingRadius();
        boxMin.setFrom(player.getReferenceToPosition());
        boxMax.setFrom(boxMin);
        for (const xyz of this.getBacktrack().getAllPlayerPositions(playerId)) {
            boxMin.set(Math.min(boxMin.x, xyz[0]), Math.min(boxMin.y, xyz[1]), Math.min(boxMin.z, xyz[2]));
            boxMax.set(Math.max(boxMax.x, xyz[0]), Math.max(boxMax.y, xyz[1]), Math.max(boxMax.z, xyz[2]));
        }
        boxMin.addPart(-playerRadius, 0, -playerRadius);
        boxMax.addPart(playerRadius, playerHeadHeightStand(), playerRadius);

        if (!boxWithSegment(boxMin, boxMax, bullet.getOrigin(), maxDestination)) {
            bullet.addPlayerIdSkip(playerId);
        }
    }
}

function bulletHasSkip(skipPlayerIds, playerId) {
    if (skipPlayerIds instanceof Map) {
        return skipPlayerIds.has(playerId);
    }
    return skipPlayerIds[playerId] === true;
}

function calculateHits(bullet, bulletPosition) {
    const hits = [];
    const skipPlayerIds = bullet.getPlayerSkipIds();
    for (const [playerId, playerCollider] of Object.entries(this.playersColliders)) {
        if (bulletHasSkip(skipPlayerIds, Number(playerId))) {
            continue;
        }

        const hitBox = playerCollider.tryHitPlayer(bullet, bulletPosition, this.game.getBacktrack());
        if (!hitBox) {
            continue;
        }

        hits.push(hitBox);
        const player = hitBox.getPlayer();
        if (player) {
            bullet.addPlayerIdSkip(player.getId());
            if (hitBox.playerWasKilled()) {
                this.game.playerAttackKilledEvent(player, bullet, hitBox.wasHeadShot());
            }
        }
    }

    const floor = this.isFloorAt(bulletPosition);
    if (floor) {
        hits.push(floor);
    }

    const wall = this.isWallAt(bulletPosition);
    if (wall) {
        hits.push(wall);
    }

    return hits;
}

function bulletHit(hit, bullet, wasHeadshot) {
    const item = bullet.getShootItem();
    assert(item instanceof Item);

    if (hit.getPlayer()) {
        this.playerHit(
            bullet.getPosition().clone(),
            hit.getPlayer(),
            this.game.getPlayer(bullet.getOriginPlayerId()),
            wasHeadshot ? SoundType.BULLET_HIT_HEADSHOT : SoundType.BULLET_HIT,
            item,
            bullet.getOrigin(),
            hit.getDamage(),
        );
    }

    if (hit instanceof SolidSurface) {
        this.surfaceHit(bullet.getOrigin(), bullet.getPosition().clone(), bullet.getOriginPlayerId(), item);
    }
}

function surfaceHit(origin, hitPoint, attackerId, item) {
    const soundEvent = new SoundEvent(hitPoint, SoundType.BULLET_HIT);
    soundEvent.setItem(item);
    soundEvent.addExtra("origin", origin.toArray());
    soundEvent.addExtra("shooter", attackerId);

    this.makeSound(soundEvent);
}

function playerHit(hitPoint, playerHitTarget, playerCulprit, soundType, item, origin, damage) {
    const attackerId = playerCulprit.getId();
    const soundEvent = new SoundEvent(hitPoint, soundType);
    soundEvent.setPlayer(playerHitTarget);
    soundEvent.setItem(item);
    soundEvent.addExtra("origin", origin.toArray());
    soundEvent.addExtra("damage", Math.min(100, damage));
    soundEvent.addExtra("shooter", attackerId);

    this.makeSound(soundEvent);
    if (playerHitTarget.isPlayingOnAttackerSide() !== playerCulprit.isPlayingOnAttackerSide()) {
        this.game.getScore().getPlayerStat(attackerId).addDamage(damage);
    }
}

export function installLos(proto) {
    proto.canBeSeen = canBeSeen;
    proto.pointCanSeePoint = pointCanSeePoint;
    proto.optimizeBulletHitCheck = optimizeBulletHitCheck;
    proto.calculateHits = calculateHits;
    proto.bulletHit = bulletHit;
    proto.surfaceHit = surfaceHit;
    proto.playerHit = playerHit;
}
