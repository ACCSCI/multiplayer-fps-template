import { EventList } from "../enums.js";
import { millisecondsToFrames } from "../util.js";

/**
 * Port of server/src/Event/Event.php
 * Shared base for all game events. PHP interface NetSerializable is expressed
 * here as the serialize()/getCode() methods (see server/interfaces.js).
 */
export class Event {
    tickCount = 0;
    customId = 0;
    /** @type {Array<function(Event):void>} PHP list<Closure(static):void> */
    onComplete = [];

    // abstract in PHP
    process(_tick) {
        throw new Error("Not implemented: abstract method");
    }

    timeMsToTick(timeMs) {
        return millisecondsToFrames(timeMs);
    }

    reset() {
        this.tickCount = 0;
        this.onComplete = [];
    }

    runOnCompleteHooks() {
        for (const func of this.onComplete) {
            func(this);
        }
    }

    /** PHP EventList::$map[get_class($this)] ?? 0 */
    getCode() {
        return EventList[this.constructor.name] ?? 0;
    }

    /** @returns {Record<string, unknown>} */
    serialize() {
        return {};
    }
}
