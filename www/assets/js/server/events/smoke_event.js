import { Column } from "../column.js";
import { SoundType } from "../enums.js";
import { Smoke } from "../equipment/smoke.js";
import { GameException } from "../game_exception.js";
import { SoundEvent } from "./sound_event.js";
import { VolumetricEvent } from "./volumetric_event.js";

/**
 * Port of server/src/Event/SmokeEvent.php
 */
export class SmokeEvent extends VolumetricEvent {
    constructor(initiator, item, world, navmesh, start) {
        super(initiator, item, world, navmesh, start);
        /** @type {number} PHP private int $maxHeight */
        this.maxHeight = Smoke.MAX_HEIGHT;
    }

    setup() {
        if (Math.min(Smoke.MAX_CORNER_HEIGHT, Smoke.MAX_HEIGHT) < this.partHeight) {
            throw new GameException("Part height is too high"); // @codeCoverageIgnore
        }
    }

    shrinkPart(column) {
        const soundEvent = new SoundEvent(column.center, SoundType.SMOKE_FADE);
        soundEvent.addExtra("id", this.id);
        this.world.makeSound(soundEvent);

        this.parts = []; // just do single shrink event
    }

    expandPart(center) {
        const count = this.parts.length;
        if (count > 10 && count % 2 === 0) {
            this.maxHeight = Math.max(Smoke.MAX_CORNER_HEIGHT, this.maxHeight - 1);
        }

        let height = this.partHeight;
        const candidate = center.clone().addY(height);
        for (let i = height; i <= this.maxHeight; i++) {
            candidate.addY(1);
            if (this.world.findFloorSquare(candidate, this.partRadius)) {
                break;
            }
            height++;
        }

        const column = new Column(center, this.partRadius, height);
        const soundEvent = new SoundEvent(column.center, SoundType.SMOKE_SPAWN);
        soundEvent.addExtra("id", this.id);
        soundEvent.addExtra("height", column.height);
        this.world.makeSound(soundEvent);

        this.world.smokeTryToExtinguishFlames(column);

        return column;
    }
}
