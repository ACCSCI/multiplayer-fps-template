import { assert } from "./assert.js";

/**
 * Port of server/src/Core/Bullet.php
 */
export class Bullet {
    constructor(item, distanceMax = 1) {
        this.item = item;
        this.distanceMax = distanceMax;
        this.origin = null;
        this.position = null;
        this.originPlayerId = 0;
        this.originPlayerIsAttacker = false;
        this.distanceTraveled = 1;
        this.damage = 1;
        /** @type {Record<number, true>} [playerId => true] */
        this.playerSkipIds = {};
    }

    setProperties(damage) {
        this.damage = damage;
    }

    setOriginPlayer(playerId, attackerSide, origin) {
        this.originPlayerId = playerId;
        this.originPlayerIsAttacker = attackerSide;
        this.origin = origin;
        this.position = origin.clone();
        this.addPlayerIdSkip(playerId);
    }

    getPosition() {
        return this.position;
    }

    getOrigin() {
        return this.origin;
    }

    lowerDamage(amount) {
        assert(amount >= 0);
        this.damage -= amount;
    }

    getDamage() {
        return this.damage;
    }

    isActive() {
        return this.damage > 0 && this.distanceTraveled < this.distanceMax;
    }

    move(point) {
        this.position.setFrom(point);
    }

    incrementDistance() {
        return ++this.distanceTraveled;
    }

    getDistanceTraveled() {
        return this.distanceTraveled;
    }

    getOriginPlayerId() {
        return this.originPlayerId;
    }

    isOriginPlayerAttackerSide() {
        return this.originPlayerIsAttacker;
    }

    getShootItem() {
        return this.item;
    }

    /** @returns {Record<number, true>} [playerId => true] */
    getPlayerSkipIds() {
        return this.playerSkipIds;
    }

    addPlayerIdSkip(playerId) {
        this.playerSkipIds[playerId] = true;
    }
}
