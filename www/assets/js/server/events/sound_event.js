import { TickEvent } from "./tick_event.js";

/**
 * Port of server/src/Event/SoundEvent.php
 */
export class SoundEvent extends TickEvent {
    /** @type {?object} PHP private ?Item $item */
    item = null;
    /** @type {?object} PHP private ?Player $player */
    player = null;
    /** @type {Record<string, unknown>} PHP private array<string,mixed> $extra */
    extra = {};

    constructor(position, type) {
        super();
        /** @type {Point} PHP public readonly Point $position */
        this.position = position;
        /** @type {number} PHP public readonly SoundType $type */
        this.type = type;
    }

    setItem(item) {
        this.item = item;
        return this;
    }

    setPlayer(player) {
        this.player = player;
        return this;
    }

    addExtra(key, value) {
        this.extra[key] = value;
        return this;
    }

    /** @returns {Record<string, unknown>} PHP array<string,mixed> */
    serialize() {
        return {
            position: this.position.toArray(),
            item: this.item === null ? null : this.item.toArray(),
            player: this.player === null ? null : this.player.getId(),
            type: this.type,
            extra: this.extra,
        };
    }

    getItem() {
        return this.item;
    }

    getPlayerId() {
        return this.player === null ? null : this.player.getId();
    }
}
