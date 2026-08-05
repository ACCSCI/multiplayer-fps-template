import { PlayerStat } from "./player_stat.js";

/**
 * Port of server/src/Core/Score.php
 */
export class Score {
    /** @type {number} PHP private int $roundNumber */
    roundNumber = 1;
    /** @type {number} PHP private int $scoreAttackers */
    scoreAttackers = 0;
    /** @type {number} PHP private int $scoreDefenders */
    scoreDefenders = 0;
    /** @type {number} PHP private int $lossBonusAttackers */
    lossBonusAttackers = 0;
    /** @type {number} PHP private int $lossBonusDefenders */
    lossBonusDefenders = 0;
    /** @type {?number} PHP private ?int $halfTimeRoundNumber */
    halfTimeRoundNumber = null;
    /** @type {?boolean} PHP private ?bool $lastRoundAttackerWins */
    lastRoundAttackerWins = null;
    /** @type {Record<number, object>} PHP private array<int,mixed> $roundsHistory */
    roundsHistory = {};
    /** @type {Record<number, PlayerStat>} PHP private array<int,PlayerStat> $playerStats */
    playerStats = {};
    /** @type {number[]} PHP private int[] $firstHalfScore */
    firstHalfScore = [];
    /** @type {number[]} PHP private int[] $secondHalfScore */
    secondHalfScore = [];

    /** @param {number[]} lossBonuses PHP int[] */
    constructor(lossBonuses) {
        this.lossBonuses = lossBonuses;
    }

    addPlayer(player) {
        this.playerStats[player.getId()] = new PlayerStat(player);
    }

    swapTeams() {
        this.firstHalfScore = [this.scoreDefenders, this.scoreAttackers];
        this.halfTimeRoundNumber = this.roundNumber;
        this.secondHalfScore = [0, 0];

        const attackerScore = this.scoreAttackers;
        this.scoreAttackers = this.scoreDefenders;
        this.scoreDefenders = attackerScore;

        this.lossBonusAttackers = 0;
        this.lossBonusDefenders = 0;
        this.lastRoundAttackerWins = null;
    }

    /** @param {object} event PHP RoundEndEvent */
    roundEnd(event) {
        this.roundNumber = event.roundNumberEnded;

        const attackersWins = event.attackersWins;
        if (attackersWins) {
            this.scoreAttackers++;
        } else {
            this.scoreDefenders++;
        }
        if (this.lastRoundAttackerWins === null) {
            if (attackersWins) {
                this.lossBonusDefenders++;
            } else {
                this.lossBonusAttackers++;
            }
        } else {
            const attackersOnStreak = attackersWins && this.lastRoundAttackerWins;
            this.lossBonusDefenders = attackersOnStreak ? this.lossBonusDefenders + 1 : 0;
            this.lossBonusAttackers = attackersOnStreak ? 0 : this.lossBonusAttackers + 1;
        }

        if (this.secondHalfScore.length !== 0) {
            this.secondHalfScore[attackersWins ? 1 : 0]++;
        }
        this.lastRoundAttackerWins = attackersWins;
        this.roundsHistory[this.roundNumber] = {
            attackersWins,
            reason: event.reason,
            scoreAttackers: this.scoreAttackers,
            scoreDefenders: this.scoreDefenders,
        };
    }

    attackersIsWinning() {
        if (this.isTie()) {
            return false;
        }
        return this.scoreAttackers > this.scoreDefenders;
    }

    defendersIsWinning() {
        if (this.isTie()) {
            return false;
        }
        return this.scoreDefenders > this.scoreAttackers;
    }

    isTie() {
        return this.scoreAttackers === this.scoreDefenders;
    }

    getScoreAttackers() {
        return this.scoreAttackers;
    }

    getScoreDefenders() {
        return this.scoreDefenders;
    }

    getMoneyLossBonus(isAttacker) {
        return this.lossBonuses[
            Math.min(this.lossBonuses.length - 1, Math.max(0, this.getNumberOfLossRoundsInRow(isAttacker) - 1))
        ];
    }

    getNumberOfLossRoundsInRow(isAttacker) {
        if (isAttacker) {
            return this.lossBonusAttackers;
        }

        return this.lossBonusDefenders;
    }

    getPlayerStat(playerId) {
        return this.playerStats[playerId];
    }

    /** @returns {Record<string, unknown>} PHP array<string,mixed> */
    toArray() {
        const scoreboard = [[], []];
        for (const [playerId, playerStat] of Object.entries(this.playerStats)) {
            const key = `${playerStat.getKills()}-${playerStat.getDamage()}-${playerId}`;
            scoreboard[playerStat.isAttacker() ? 1 : 0][key] = playerStat.toArray();
        }
        const teamDefenders = scoreboard[0];
        const teamAttackers = scoreboard[1];
        const defenderKeys = Object.keys(teamDefenders).sort((a, b) => naturalCompare(b, a));
        const attackerKeys = Object.keys(teamAttackers).sort((a, b) => naturalCompare(b, a));

        return {
            score: [this.scoreDefenders, this.scoreAttackers],
            lossBonus: [this.getMoneyLossBonus(false), this.getMoneyLossBonus(true)],
            history: this.roundsHistory,
            firstHalfScore:
                this.firstHalfScore.length === 0 ? [this.scoreDefenders, this.scoreAttackers] : this.firstHalfScore,
            secondHalfScore: this.secondHalfScore,
            halfTimeRoundNumber: this.halfTimeRoundNumber,
            scoreboard: [defenderKeys.map((key) => teamDefenders[key]), attackerKeys.map((key) => teamAttackers[key])],
        };
    }
}

/** PHP krsort(..., SORT_NATURAL) on 'kills-damage-id' keys. */
function naturalCompare(a, b) {
    const aParts = a.split("-").map(Number);
    const bParts = b.split("-").map(Number);
    const max = Math.max(aParts.length, bParts.length);
    for (let i = 0; i < max; i++) {
        const x = aParts[i] ?? 0;
        const y = bParts[i] ?? 0;
        if (x !== y) {
            return x < y ? -1 : 1;
        }
    }
    return 0;
}
