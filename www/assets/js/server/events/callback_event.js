import { Event } from "./event.js";

/**
 * Port of server/src/Event/CallbackEvent.php
 */
export class CallbackEvent extends Event {
    /** @type {function(object, number):void} PHP Closure(static,int):void */
    callback;

    constructor(callback) {
        super();
        this.callback = callback;
    }

    /** PHP final */
    process(tick) {
        this.callback(this, tick);
    }
}
