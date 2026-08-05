import { NoTickEvent } from "./no_tick_event.js";

/**
 * Port of server/src/Event/GameStartEvent.php
 */
export class GameStartEvent extends NoTickEvent {
    constructor(player, setting, gameSetting) {
        super();
        /** @type {object} PHP private Player $player */
        this.player = player;
        /** @type {object} PHP private ServerSetting $setting */
        this.setting = setting;
        /** @type {object} PHP private GameProperty $gameSetting */
        this.gameSetting = gameSetting;
    }

    /** @returns {Record<string, unknown>} PHP array<string,mixed> */
    serialize() {
        return {
            playerId: this.player.getId(),
            warmupSec: this.setting.warmupWaitSecRemains,
            tickMs: this.setting.tickMs,
            playersCount: this.setting.playersMax,
            setting: this.gameSetting.toArray(),
            player: this.player.serialize(),
        };
    }
}
