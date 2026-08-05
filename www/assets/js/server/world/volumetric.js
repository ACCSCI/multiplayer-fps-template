import { assert } from "../assert.js";
import { boxWithBox, circleWithRect, pointWithBoxBoundary, pointWithCylinder } from "../collision.js";
import { ArmorType, SoundType } from "../enums.js";
import { Grenade } from "../equipment/grenade.js";
import { HighExplosive } from "../equipment/high_explosive.js";
import { Incendiary } from "../equipment/incendiary.js";
import { Molotov } from "../equipment/molotov.js";
import { Smoke } from "../equipment/smoke.js";
import { GrillEvent } from "../events/grill_event.js";
import { SmokeEvent } from "../events/smoke_event.js";
import { GameException } from "../game_exception.js";
import { Item } from "../item.js";
import { PathFinder } from "../path_finder.js";
import { distanceSquared, worldAngle } from "../util.js";

/**
 * Smoke, flame and explosive logic of the World (port of the related methods
 * in server/src/Core/World.php). The methods are mounted on World.prototype
 * via installVolumetric() called from world/index.js.
 */

/** PHP "instanceof Flammable": only Molotov and Incendiary implement it. */
function isFlammable(item) {
    return item instanceof Molotov || item instanceof Incendiary;
}

function throwEvent(event) {
    event.onComplete.push((completed) => {
        if (completed.item instanceof HighExplosive) {
            this.processHighExplosiveBlast(completed.getPlayer(), completed.getPositionClone(), completed.item);
        }
        if (isFlammable(completed.item)) {
            const start = this.getVolumetricStartPoint(
                completed.getPositionClone(),
                completed.item.getBoundingRadius(),
            );
            if (start) {
                this.processFlammableExplosion(completed.getPlayer(), start, completed.item);
            }
        }
        if (completed.item instanceof Smoke) {
            const start = this.getVolumetricStartPoint(
                completed.getPositionClone(),
                completed.item.getBoundingRadius(),
            );
            if (start) {
                this.processSmokeExpansion(completed.getPlayer(), start, completed.item);
            }
        }
    });
    this.game.addThrowEvent(event);
}

function getVolumetricStartPoint(epicentre, radius) {
    if (this.grenadeNavigationMesh === null) {
        this.regenerateNavigationMeshes();
    }
    this.grenadePathFinder ??= new PathFinder(this, this.getGrenadeNavigationMesh());

    const epicentreFloor = epicentre.clone().addY(-radius);
    const floorNavmeshPoint = this.grenadePathFinder.findTile(epicentreFloor, radius);
    if (floorNavmeshPoint && !this.getGrenadeNavigationMesh().has(floorNavmeshPoint.hash())) {
        throw new GameException(`No node for start point: ${floorNavmeshPoint}`);
    }

    return floorNavmeshPoint;
}

function processSmokeExpansion(initiator, start, item) {
    const event = new SmokeEvent(initiator, item, this, this.getGrenadeNavigationMesh(), start);
    event.onComplete.push((completed) => {
        delete this.activeSmokes[completed.id];
    });
    this.activeSmokes[event.id] = event;
    this.game.addSmokeEvent(event);
}

function processFlammableExplosion(thrower, start, item) {
    const event = new GrillEvent(thrower, item, this, this.getGrenadeNavigationMesh(), start);
    event.onComplete.push((completed) => {
        delete this.activeMolotovs[completed.id];
    });
    this.activeMolotovs[event.id] = event;
    this.game.addGrillEvent(event);
}

function smokeTryToExtinguishFlames(smoke) {
    for (const fire of Object.values(this.activeMolotovs)) {
        if (!boxWithBox(smoke.boundaryMin, smoke.boundaryMax, fire.boundaryMin, fire.boundaryMax)) {
            continue;
        }

        for (const flame of fire.parts) {
            if (
                flame.active &&
                boxWithBox(smoke.boundaryMin, smoke.boundaryMax, flame.boundaryMin, flame.boundaryMax)
            ) {
                fire.extinguish(flame);
            }
        }
    }
}

function flameCanIgnite(flame) {
    for (const smoke of Object.values(this.activeSmokes)) {
        if (!boxWithBox(smoke.boundaryMin, smoke.boundaryMax, flame.boundaryMin, flame.boundaryMax)) {
            continue;
        }

        for (const smokePart of smoke.parts) {
            if (boxWithBox(smokePart.boundaryMin, smokePart.boundaryMax, flame.boundaryMin, flame.boundaryMax)) {
                return false;
            }
        }
    }

    return true;
}

function checkFlameDamage(fire, tickId) {
    for (const [playerIdKey, collider] of Object.entries(this.playersColliders)) {
        const playerId = Number(playerIdKey);
        const player = collider.getPlayer();
        if (!player.isAlive() || !fire.canHitPlayer(playerId, tickId)) {
            continue;
        }

        const pp = player.getReferenceToPosition();
        const playerHeight = player.getHeadHeight();
        const playerRadius = player.getBoundingRadius();
        if (
            pp.y > fire.boundaryMax.y ||
            pp.y + playerHeight < fire.boundaryMin.y ||
            !circleWithRect(
                pp.x,
                pp.z,
                playerRadius,
                fire.boundaryMin.x,
                fire.boundaryMax.x,
                fire.boundaryMin.z,
                fire.boundaryMax.z,
            )
        ) {
            continue;
        }

        for (const flame of fire.parts) {
            if (!flame.active || !pointWithCylinder(flame.highestPoint, pp, playerRadius, playerHeight)) {
                continue;
            }

            fire.playerHit(playerId, tickId);
            const flammableItem = fire.getItem();
            assert(isFlammable(flammableItem));
            const damage = flammableItem.calculateDamage(player.getArmorType() !== ArmorType.NONE);
            assert(fire.item instanceof Item);
            this.playerHit(
                player.getCentrePointClone(),
                player,
                fire.initiator,
                SoundType.FLAME_PLAYER_HIT,
                fire.item,
                flame.center,
                damage,
            );
            player.lowerHealth(damage);
            if (!player.isAlive()) {
                this.playerDiedToFlame(fire.initiator, player, flammableItem);
            }

            break;
        }
    }
}

function isCollisionWithMolotov(pos) {
    for (const molotov of Object.values(this.activeMolotovs)) {
        if (!pointWithBoxBoundary(pos, molotov.boundaryMin, molotov.boundaryMax)) {
            continue;
        }

        for (const flame of molotov.parts) {
            if (flame.active && pointWithBoxBoundary(pos, flame.boundaryMin, flame.boundaryMax)) {
                return true;
            }
        }
    }

    return false;
}

function processHighExplosiveBlast(thrower, epicentre, item) {
    const maxBlastDistance = item.getMaxBlastRadius();
    const maxBlastDistanceSquared = maxBlastDistance * maxBlastDistance;
    for (const playerIdKey of Object.keys(this.playersColliders)) {
        const player = this.game.getPlayer(Number(playerIdKey));
        if (!player.isAlive()) {
            continue;
        }
        if (distanceSquared(epicentre, player.getCentrePointClone()) > maxBlastDistanceSquared) {
            continue;
        }

        let damage = 0;
        for (const point of player.getPlayerGrenadeHitPoints()) {
            const distanceSquaredValue = distanceSquared(epicentre, point);
            if (distanceSquaredValue > maxBlastDistanceSquared) {
                continue;
            }
            const [angleHorizontal, angleVertical] = worldAngle(point, epicentre);
            if (!this.pointCanSeePoint(epicentre, point, angleHorizontal ?? 0, angleVertical, maxBlastDistance, null)) {
                continue;
            }

            damage += item.calculateDamage(distanceSquaredValue, player.getArmorType() !== ArmorType.NONE);
        }

        player.lowerHealth(damage);
        if (!player.isAlive()) {
            this.game.playerGrenadeKilledEvent(thrower, player, item);
        }
    }
}

function playerDiedToFlame(playerCulprit, playerDead, item) {
    assert(item instanceof Grenade, "New flammable non grenade type?");
    this.game.playerGrenadeKilledEvent(playerCulprit, playerDead, item);
}

export function installVolumetric(proto) {
    proto.throw = throwEvent;
    proto.getVolumetricStartPoint = getVolumetricStartPoint;
    proto.processSmokeExpansion = processSmokeExpansion;
    proto.processFlammableExplosion = processFlammableExplosion;
    proto.smokeTryToExtinguishFlames = smokeTryToExtinguishFlames;
    proto.flameCanIgnite = flameCanIgnite;
    proto.checkFlameDamage = checkFlameDamage;
    proto.isCollisionWithMolotov = isCollisionWithMolotov;
    proto.processHighExplosiveBlast = processHighExplosiveBlast;
    proto.playerDiedToFlame = playerDiedToFlame;
}
