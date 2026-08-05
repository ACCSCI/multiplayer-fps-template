/**
 * Port of server/src/Core/PlayerStat.php
 */
export class PlayerStat {
    /** @type {number} PHP private int $kills */
    kills = 0;
    /** @type {number} PHP private int $killsHeadshot */
    killsHeadshot = 0;
    /** @type {number} PHP private int $deaths */
    deaths = 0;
    /** @type {number} PHP private int $damage */
    damage = 0;

    constructor(player) {
        /** @type {object} PHP private Player $player */
        this.player = player;
    }

    addKill(wasHeadshot) {
        this.kills++;
        if (wasHeadshot) {
            this.killsHeadshot++;
        }
    }

    addDeath() {
        this.deaths++;
    }

    addDamage(damage) {
        this.damage += Math.min(damage, 100);
    }

    removeKill() {
        this.kills--;
    }

    getKills() {
        return this.kills;
    }

    getHeadshotKills() {
        return this.killsHeadshot;
    }

    getDeaths() {
        return this.deaths;
    }

    getDamage() {
        return this.damage;
    }

    isAttacker() {
        return this.player.isPlayingOnAttackerSide();
    }

    /** @returns {Record<string, number>} PHP array<string,int> */
    toArray() {
        return {
            id: this.player.getId(),
            kills: this.kills,
            deaths: this.deaths,
            damage: this.damage,
        };
    }
}
