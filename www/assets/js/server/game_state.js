/**
 * Port of server/src/Core/GameState.php
 * PHP readonly class: wraps a Game with a reduced read-only API.
 */
export class GameState {
    constructor(game) {
        /** @type {object} PHP private Game $game */
        this.game = game;
    }

    getPlayer(id) {
        return this.game.getPlayer(id);
    }

    getTickId() {
        return this.game.getTickId();
    }

    isPaused() {
        return this.game.isPaused();
    }
}
