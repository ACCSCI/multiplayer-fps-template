import { Event } from "./event.js";

/**
 * Port of server/src/Event/TimeoutEvent.php
 */
export class TimeoutEvent extends Event {
    constructor(callback, timeoutMs) {
        super();
        this.callback = callback;
        this.timeoutMs = timeoutMs;
        this.tickCountTimeout = this.timeMsToTick(timeoutMs);
    }

    /** PHP final; process() is called once per game tick. */
    process(tick) {
        if (this.tickCountTimeout > 0 && this.tickCount++ !== this.tickCountTimeout) {
            return;
        }

        if (this.callback) {
            this.callback(this, tick);
        }
        if (this.onComplete.length !== 0) {
            this.runOnCompleteHooks();
        }
    }
}
