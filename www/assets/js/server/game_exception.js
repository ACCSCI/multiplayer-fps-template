/**
 * Port of server/src/Core/GameException.php
 */
export class GameException extends Error {
    constructor(message = "") {
        super(message);
        this.name = "GameException";
    }

    static notImplementedYet(msg = "") {
        throw new GameException(`Not implemented yet! ${msg}`);
    }

    static invalid(msg = "") {
        throw new GameException(`This should not be called! ${msg}`);
    }
}
