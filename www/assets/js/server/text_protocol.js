import { GameStartEvent } from "./events/game_start_event.js";
import { Protocol } from "./protocol.js";

/**
 * Port of server/src/Net/Protocol/TextProtocol.php
 * Wire format: '|' separated commands, JSON snapshot of {players, events}.
 */
export class TextProtocol extends Protocol {
    static separator = "|";

    getRequestMaxSizeBytes() {
        return 960;
    }

    /** @param {object} player PHP Player */
    serializeGameSetting(player, setting, game) {
        const gameStartEvent = new GameStartEvent(player, setting, game.getProperties());
        return this.serialize([], [gameStartEvent]);
    }

    /**
     * @param {object[]} players PHP Player[]
     * @param {object[]} events PHP Event[]
     */
    serialize(players, events) {
        return JSON.stringify({
            players: players.map((player) => player.serialize()),
            events: events.map((event) => ({ code: event.getCode(), data: event.serialize() })),
        });
    }

    /** @param {object} game PHP Game */
    serializeGameState(game) {
        return this.serialize(game.getPlayers(), game.consumeTickEvents());
    }

    /** @returns {Array<Array<string|number>>} PHP array<int,array<string|int|float>> */
    parsePlayerControlCommands(msg) {
        const commands = [];
        const poll = { ...Protocol.playerControlMethods };

        for (const line of msg.split(TextProtocol.separator)) {
            const parts = line.split(" ");
            const method = parts[0];
            if (!Object.hasOwn(poll, method)) {
                return [];
            }

            const command = [method];
            if (parts[1] !== undefined) {
                if (!isNumeric(parts[1])) {
                    return [];
                }
                if (Protocol.methodParamFloat[method]?.[1]) {
                    command.push(parseFloat(parts[1]));
                } else {
                    command.push(parseInt(parts[1], 10));
                }
            }
            if (parts[2] !== undefined) {
                if (!isNumeric(parts[2])) {
                    return [];
                }
                if (Protocol.methodParamFloat[method]?.[2]) {
                    command.push(parseFloat(parts[2]));
                } else {
                    command.push(parseInt(parts[2], 10));
                }
            }

            if (command.length !== Protocol.playerControlMethodParamCount[method] + 1) {
                return [];
            }

            commands.push(command);
            poll[method]--;
            if (poll[method] === 0) {
                delete poll[method];
            }
        }

        return commands;
    }
}

/** PHP is_numeric() for the numeric args accepted by the protocol. */
function isNumeric(value) {
    if (value === "") {
        return false;
    }
    return Number.isFinite(Number(value));
}
