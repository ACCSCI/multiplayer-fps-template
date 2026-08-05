import { Game } from "./game.js";
import { GameProperty } from "./game_property.js";

/**
 * Port of server/src/Core/GameFactory.php
 * NOTE: like the PHP source, this factory does not call Setting::loadConstants();
 * callers (tests/sim) load the constants they need, matching PHP semantics.
 */
export class GameFactory {
    static createDefaultCompetitive() {
        const properties = new GameProperty();
        properties.backtrack_history_tick_count = 1;

        return new Game(properties);
    }

    static createDebug() {
        const properties = new GameProperty();
        properties.start_money = 16000;
        properties.max_rounds = 22;
        properties.freeze_time_sec = 0;
        properties.half_time_freeze_sec = 0;
        properties.round_time_ms = 982123;
        properties.round_end_cool_down_sec = 0;
        properties.randomize_spawn_position = false;

        return new Game(properties);
    }
}
