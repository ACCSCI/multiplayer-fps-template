import { GameException } from "../game_exception.js";
import { Event } from "./event.js";

/**
 * Port of server/src/Event/NoTickEvent.php
 */
export class NoTickEvent extends Event {
    /** PHP final; NoTick events must never be processed by the tick loop. */
    process(_tick) {
        GameException.invalid(this.constructor.name);
    }
}
