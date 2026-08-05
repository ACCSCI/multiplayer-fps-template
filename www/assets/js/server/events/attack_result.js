/**
 * Port of server/src/Event/AttackResult.php
 */
export class AttackResult {
    /** @type {object[]} PHP Hittable[] $hits */
    hits = [];
    /** @type {number} PHP private int $moneyAward */
    moneyAward = 0;

    constructor(bullet) {
        /** @type {object} PHP private Bullet $bullet */
        this.bullet = bullet;
        /** @type {boolean} PHP private bool $somePlayersWasHit (renamed: JS class fields would shadow the method) */
        this.somePlayersWasHitFlag = false;
    }

    addHit(hit) {
        this.hits.push(hit);
        this.moneyAward += hit.getMoneyAward();
        if (hit.getPlayer() !== null) {
            this.somePlayersWasHitFlag = true;
        }
    }

    /** @returns {object[]} PHP Hittable[] */
    getHits() {
        return this.hits;
    }

    getBullet() {
        return this.bullet;
    }

    getMoneyAward() {
        return this.moneyAward;
    }

    somePlayersWasHit() {
        return this.somePlayersWasHitFlag;
    }
}
