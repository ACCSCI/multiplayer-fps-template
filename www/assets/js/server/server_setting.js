import { setTickRate } from "./util.js";

/**
 * Port of server/src/Net/ServerSetting.php
 * NOTE: the constructor sets the global tick rate as a side effect
 * (PHP: Util::$TICK_RATE = ($tickMs > 0 ? $tickMs : Util::$TICK_RATE)).
 */
export class ServerSetting {
    constructor(
        playersMax,
        tickMs = 10,
        attackerCode = "acode",
        defenderCode = "dcode",
        warmupInstantStart = true,
        warmupWaitSec = 60,
    ) {
        /** @type {number} PHP public readonly int $playersMax */
        this.playersMax = playersMax;
        /** @type {number} PHP public readonly int $tickMs */
        this.tickMs = tickMs;
        /** @type {string} PHP public readonly string $attackerCode */
        this.attackerCode = attackerCode;
        /** @type {string} PHP public readonly string $defenderCode */
        this.defenderCode = defenderCode;
        /** @type {boolean} PHP public readonly bool $warmupInstantStart */
        this.warmupInstantStart = warmupInstantStart;
        /** @type {number} PHP public readonly int $warmupWaitSec */
        this.warmupWaitSec = warmupWaitSec;

        if (tickMs > 0) {
            setTickRate(tickMs);
        }

        /** @type {number} PHP public int $warmupWaitSecRemains */
        this.warmupWaitSecRemains = this.warmupWaitSec;
    }
}
