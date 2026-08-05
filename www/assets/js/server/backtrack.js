import { GameException } from "./game_exception.js";
import { Point } from "./point.js";

/**
 * Port of server/src/Core/Backtrack.php.
 * History buffer used for online anti-cheat: each tick's player state snapshot
 * ({a: position, b: horizontal rotation, c: vertical rotation, d: head height})
 * is kept so hit resolution can be validated against a past position.
 * The Game dependency is duck-typed (getPlayers / getPlayer).
 */
export class Backtrack {
    constructor(game, numberOfHistoryStates) {
        if (numberOfHistoryStates < 0) {
            throw new GameException(`Variable '${numberOfHistoryStates}' needs to be bigger or equal zero`);
        }
        this.game = game;
        this.numberOfHistoryStates = numberOfHistoryStates;
        // Underscore-prefixed: the PHP private $saveState property name
        // collides with the saveState() method in JS (instance field shadows
        // the prototype method).
        this._saveState = {};
        this.newestState = {};
        this.states = [];
        this.point = new Point();
    }

    reset() {
        this.states = [];
    }

    startState() {
        this.newestState = {};
    }

    addStateData(alivePlayer) {
        if (this.numberOfHistoryStates === 0) {
            return;
        }

        this.newestState[alivePlayer.getId()] = {
            a: alivePlayer.getReferenceToPosition().toFlatArray(),
            b: alivePlayer.getSight().getRotationHorizontal(),
            c: alivePlayer.getSight().getRotationVertical(),
            d: alivePlayer.getHeadHeight(),
        };
    }

    finishState() {
        if (this.numberOfHistoryStates === 0) {
            return;
        }

        this.states.unshift(this.newestState);
        if (this.states.length > this.numberOfHistoryStates + 1) {
            this.states.pop();
        }
    }

    saveState() {
        if (this.numberOfHistoryStates === 0) {
            return;
        }

        for (const player of this.game.getPlayers()) {
            this._saveState[player.getId()] = {
                a: player.getReferenceToPosition().toFlatArray(),
                b: player.getSight().getRotationHorizontal(),
                c: player.getSight().getRotationVertical(),
                d: player.getHeadHeight(),
            };
        }
    }

    restoreState() {
        if (this.numberOfHistoryStates === 0) {
            return;
        }

        for (const [playerId, playerData] of Object.entries(this._saveState)) {
            const player = this.game.getPlayer(Number(playerId));
            player.setPosition(this.point.set(...playerData.a));
            player.getSight().look(playerData.b, playerData.c);
            player.setHeadHeight(playerData.d);
        }
    }

    apply(state, playerId) {
        if (state === 0 || this.numberOfHistoryStates === 0) {
            return;
        }

        const playerData = this.states[state]?.[playerId];
        if (playerData === undefined) {
            return;
        }

        const player = this.game.getPlayer(playerId);
        player.setPosition(this.point.set(...playerData.a));
        player.getSight().look(playerData.b, playerData.c);
        player.setHeadHeight(playerData.d);
    }

    /** @returns {number[]} non-empty state indexes, [0] when empty */
    getStates() {
        const states = [];
        for (let i = 1; i < this.states.length; i++) {
            if (this.states[i] === undefined || Object.keys(this.states[i]).length === 0) {
                continue;
            }
            states.push(i);
        }
        if (states.length === 0) {
            return [0];
        }
        return states;
    }

    /** @returns {number[][]} list of [x, y, z] positions, newest first */
    getAllPlayerPositions(playerId) {
        const output = [];
        for (const state of this.states) {
            if (state[playerId] !== undefined) {
                output.push([...state[playerId].a]);
            }
        }

        return output;
    }
}
