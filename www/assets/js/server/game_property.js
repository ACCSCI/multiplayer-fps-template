import { GameException } from "./game_exception.js";

/**
 * Port of server/src/Core/GameProperty.php
 * PHP magic __get/__set reject unknown fields. JS has no such magic, so the
 * guard is implemented as a Proxy created by create()/fromArray() - the
 * config-input paths where the PHP guard actually fires. Plain
 * `new GameProperty()` instances are unguarded, matching JS norms.
 */
const guardHandler = {
    get(target, prop, receiver) {
        if (typeof prop === "symbol" || prop in target) {
            return Reflect.get(target, prop, receiver);
        }
        GameException.invalid(`Invalid field '${String(prop)}' given`);
    },
    set(target, prop, value, _receiver) {
        if (typeof prop === "symbol" || prop in target) {
            target[prop] = value;
            return true;
        }
        GameException.invalid(`Invalid field '${String(prop)}' given`);
    },
};

export class GameProperty {
    static START_MONEY = "start_money";
    static RANDOMIZE_SPAWN_POSITION = "randomize_spawn_position";
    static MAX_ROUNDS = "max_rounds";
    static ROUND_TIME_MS = "round_time_ms";
    static BOMB_EXPLODE_TIME_MS = "bomb_explode_time_ms";
    static BOMB_PLANT_TIME_MS = "bomb_plant_time_ms";
    static BOMB_DEFUSE_TIME_MS = "bomb_defuse_time_ms";
    static HALF_TIME_FREEZE_SEC = "half_time_freeze_sec";
    static FREEZE_TIME_SEC = "freeze_time_sec";
    static BUY_TIME_SEC = "buy_time_sec";
    static ROUND_END_COOL_DOWN_SEC = "round_end_cool_down_sec";
    static BACKTRACK_HISTORY_TICK_COUNT = "backtrack_history_tick_count";

    constructor() {
        /** @type {number} PHP public int $start_money */
        this.start_money = 800;
        /** @type {boolean} PHP public bool $randomize_spawn_position */
        this.randomize_spawn_position = true;
        /** @type {number} PHP public int $max_rounds */
        this.max_rounds = 24;
        /** @type {number} PHP public int $round_time_ms */
        this.round_time_ms = 115000; // 1:55 min
        /** @type {number} PHP public int $bomb_explode_time_ms */
        this.bomb_explode_time_ms = 40000;
        /** @type {number} PHP public int $bomb_plant_time_ms */
        this.bomb_plant_time_ms = 3200;
        /** @type {number} PHP public int $bomb_defuse_time_ms */
        this.bomb_defuse_time_ms = 9960;
        /** @type {number} PHP public int $half_time_freeze_sec */
        this.half_time_freeze_sec = 15;
        /** @type {number} PHP public int $freeze_time_sec */
        this.freeze_time_sec = 10;
        /** @type {number} PHP public int $buy_time_sec */
        this.buy_time_sec = 20;
        /** @type {number} PHP public int $round_end_cool_down_sec */
        this.round_end_cool_down_sec = 4;
        /** @type {number} PHP public int $backtrack_history_tick_count */
        this.backtrack_history_tick_count = 0;
        /** @type {number[]} PHP public int[] $loss_bonuses */
        this.loss_bonuses = [1400, 1900, 2400, 2900, 3400];
    }

    /** Guarded instance: unknown field reads/writes throw GameException (PHP __get/__set). */
    static create() {
        return new Proxy(new GameProperty(), guardHandler);
    }

    /**
     * @param {Record<string, string|number|boolean>} params PHP array<string,string|int|bool>
     * @returns {GameProperty}
     */
    static fromArray(params) {
        const gp = GameProperty.create();
        for (const [paramName, value] of Object.entries(params)) {
            gp[paramName] = value;
        }

        return gp;
    }

    /** @returns {Record<string, string|number|boolean|number[]>} PHP array<string,string|int|bool|int[]> */
    toArray() {
        return { ...this };
    }
}
