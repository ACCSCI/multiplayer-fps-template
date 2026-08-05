import { EventList, GameOverReason, PauseReason } from "./Enums.js";

export class EventProcessor {
    #callbacks;

    constructor(game) {
        this.#loadCallbacks(game);
    }

    process(event) {
        const callback = this.#callbacks[event.code];
        if (callback === undefined) {
            console.error(`Unknown event callback for event.code ${event.code}`);
            return false;
        }
        callback(event.data);
        return true;
    }

    #loadCallbacks(game) {
        const eventsCallback = {};

        eventsCallback[EventList.unknown] = (data) => {
            console.error("Common server, fix yourself, event 0 - unknown", data);
        };

        eventsCallback[EventList.GameOverEvent] = (data) => {
            const gameOverReason = data.reason;
            let msg = "";
            switch (gameOverReason) {
                case GameOverReason.REASON_NOT_ALL_PLAYERS_CONNECTED:
                    msg = "Not all players connected during warmup";
                    break;
                case GameOverReason.ATTACKERS_WINS:
                    msg = game.playerMe.isAttacker() ? "Your team won!" : "Your team lost!";
                    break;
                case GameOverReason.DEFENDERS_WINS:
                    msg = game.playerMe.isAttacker() ? "Your team lost!" : "Your team won!";
                    break;
                case GameOverReason.TIE:
                    msg = "Max round reached. Tie!";
                    break;
                case GameOverReason.SERVER_ERROR:
                    msg = "Server error!";
                    break;
            }
            game.end(msg);
        };

        eventsCallback[EventList.PauseStartEvent] = (data) => {
            const pauseReason = data.reason;
            let msg = "";
            switch (pauseReason) {
                case PauseReason.FREEZE_TIME:
                    msg = "Freeze time";
                    break;
                case PauseReason.TIMEOUT_ATTACKERS:
                    msg = "Timeout attackers";
                    break;
                case PauseReason.TIMEOUT_DEFENDERS:
                    msg = "Timeout defenders";
                    break;
                case PauseReason.HALF_TIME:
                    game.halfTime();
                    msg = "Half time";
                    break;
            }
            game.pause(msg, data.score, data.ms);
        };

        eventsCallback[EventList.PauseEndEvent] = () => {
            game.unpause();
        };

        eventsCallback[EventList.RoundStartEvent] = (data) => {
            game.roundStart(data.attackers, data.defenders);
        };

        eventsCallback[EventList.RoundEndEvent] = (data) => {
            game.roundEnd(data.attackersWins, data.newRoundNumber, data.score);
        };

        eventsCallback[EventList.GameStartEvent] = (options) => {
            game.gameStart(options);
        };

        eventsCallback[EventList.RoundEndCoolDownEvent] = () => {
            // do nothing, maybe show MVP and play music kit
        };

        eventsCallback[EventList.KillEvent] = (data) => {
            game.playerKilled(data.playerDead, data.playerCulprit, data.headshot, data.itemId);
        };

        eventsCallback[EventList.SoundEvent] = (data) => {
            game.processSound(data);
        };

        eventsCallback[EventList.PlantEvent] = (data) => {
            game.bombPlanted(data.timeMs, data.position);
        };

        eventsCallback[EventList.ThrowEvent] = (data) => {
            game.spawnGrenade(data.item, data.id, data.radius);
        };

        eventsCallback[EventList.DropEvent] = (data) => {
            game.itemDrop(data.item, data.id);
        };

        eventsCallback[EventList.GrillEvent] = (data) => {
            game.grillStart(data.id, data.position, data.size, data.time, data.count);
        };

        eventsCallback[EventList.SmokeEvent] = (data) => {
            game.smokeStart(data.id, data.position, data.size, data.time, data.count);
        };

        this.#callbacks = eventsCallback;
    }
}
