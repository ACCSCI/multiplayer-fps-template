import { Column } from "../column.js";
import { SoundType } from "../enums.js";
import { SoundEvent } from "./sound_event.js";
import { VolumetricEvent } from "./volumetric_event.js";

/**
 * Port of server/src/Event/GrillEvent.php
 */
export class GrillEvent extends VolumetricEvent {
    static DAMAGE_COOL_DOWN_TIME_MS = 100;

    constructor(initiator, item, world, navmesh, start) {
        super(initiator, item, world, navmesh, start);
        // NOTE: setup() (called inside super) initializes damageCoolDownTickCount,
        // so it must not be re-initialized here.
        /** @type {Record<number, number>} PHP array<int,int> [playerId => tick] */
        this.playerTickHits = {};
    }

    setup() {
        this.damageCoolDownTickCount = this.timeMsToTick(GrillEvent.DAMAGE_COOL_DOWN_TIME_MS);
    }

    onProcess(tick) {
        this.world.checkFlameDamage(this, tick);
    }

    shrinkPart(column) {
        const soundEvent = new SoundEvent(column.center, SoundType.FLAME_EXTINGUISH);
        soundEvent.addExtra("id", this.id);
        this.world.makeSound(soundEvent);
    }

    expandPart(center) {
        const flame = new Column(center, this.partRadius, this.partHeight);
        if (this.world.flameCanIgnite(flame)) {
            const soundEvent = new SoundEvent(flame.center, SoundType.FLAME_SPAWN);
            soundEvent.addExtra("id", this.id);
            soundEvent.addExtra("height", flame.height);
            this.world.makeSound(soundEvent);
        } else {
            flame.active = false;
        }

        return flame;
    }

    extinguish(flame) {
        flame.active = false;
        this.shrinkPart(flame);
    }

    canHitPlayer(playerId, tickId) {
        return (
            (this.playerTickHits[playerId] ?? -this.damageCoolDownTickCount) + this.damageCoolDownTickCount <= tickId
        );
    }

    playerHit(playerId, tickId) {
        this.playerTickHits[playerId] = tickId;
    }
}
