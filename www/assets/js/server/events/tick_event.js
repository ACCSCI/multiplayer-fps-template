import { Event } from "./event.js";

/**
 * Port of server/src/Event/TickEvent.php
 */
export class TickEvent extends Event {
    /** @type {?function(object, number):void} PHP ?Closure(static,int):void */
    callback;
    /** @type {number} PHP protected int $maxTickCount */
    maxTickCount;

    constructor(callback = null, maxTickCount = 1) {
        super();
        this.callback = callback;
        this.maxTickCount = maxTickCount;
    }

    /** PHP final */
    process(tick) {
        this.tickCount++;
        if (this.callback) {
            this.callback(this, tick);
        }
        if (this.onComplete.length !== 0 && (this.maxTickCount === 0 || this.tickCount >= this.maxTickCount)) {
            this.runOnCompleteHooks();
        }
    }
}
