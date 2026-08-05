import { Column } from "../column.js";
import { GameException } from "../game_exception.js";
import { Point } from "../point.js";
import { Sequence } from "../sequence.js";
import { Event } from "./event.js";

/**
 * Port of server/src/Event/VolumetricEvent.php
 * PHP SplQueue is expressed as a JS array used as a FIFO (push/shift).
 */
export class VolumetricEvent extends Event {
    constructor(initiator, item, world, navmesh, start) {
        super();
        /** @type {object} PHP public Player $initiator */
        this.initiator = initiator;
        /** @type {object} PHP public Volumetric $item */
        this.item = item;
        /** @type {object} PHP protected World $world */
        this.world = world;
        /** @type {object} PHP private NavigationMesh $navmesh */
        this.navmesh = navmesh;
        /** @type {Point} PHP private Point $start */
        this.start = start;
        /** @type {string} PHP public readonly string $id */
        this.id = Sequence.next();
        /** @type {number} PHP protected readonly int $partRadius */
        this.partRadius = navmesh.tileSizeHalf;
        /** @type {number} PHP private readonly int $partSize */
        this.partSize = this.partRadius * 2 + 1;
        /** @type {number} PHP protected readonly int $partHeight */
        this.partHeight = navmesh.colliderHeight;
        /** @type {number} PHP private readonly int $startedTickId */
        this.startedTickId = world.getTickId();
        /** @type {number} PHP private readonly int $spawnTickCount */
        this.spawnTickCount = this.timeMsToTick(20);
        /** @type {number} PHP private readonly int $maxTicksCount */
        this.maxTicksCount = this.timeMsToTick(item.getMaxTimeMs());

        const partArea = this.partSize ** 2;
        /** @type {number} PHP private readonly int $spawnPartCount */
        this.spawnPartCount = Math.ceil((item.getSpawnAreaMetersSquared() * 100) / partArea);
        /** @type {number} PHP private readonly int $maxPartCount */
        this.maxPartCount = Math.ceil(item.getMaxAreaMetersSquared() / partArea);

        this.setup();
        /** @type {Column[]} PHP Column[] $parts */
        this.parts = [];
        /** @type {string[]} PHP SplQueue<string> $queue */
        this.queue = [start.hash()];
        /** @type {Record<string, boolean>} PHP array<string,bool> $visited */
        this.visited = {};
        /** @type {number} PHP private int $lastPartSpawnTickId */
        this.lastPartSpawnTickId = 0;

        /** @type {Point} PHP public readonly Point $boundaryMin */
        this.boundaryMin = start.clone();
        /** @type {Point} PHP public readonly Point $boundaryMax */
        this.boundaryMax = start.clone().addPart(1, 1, 1);
    }

    /** PHP abstract protected */
    setup() {
        GameException.invalid(this.constructor.name);
    }

    /** PHP abstract protected */
    shrinkPart(_column) {
        GameException.invalid(this.constructor.name);
    }

    /** PHP abstract protected */
    expandPart(_center) {
        GameException.invalid(this.constructor.name);
    }

    onProcess(_tick) {
        // empty hook
    }

    shrink(tick) {
        for (let i = 1; i <= this.spawnPartCount; i++) {
            const part = this.parts.pop();
            if (part === undefined) {
                return;
            }

            if (part.active) {
                this.shrinkPart(part);
            }
        }

        this.onProcess(tick);
    }

    process(tick) {
        if (this.startedTickId + 1 === tick) {
            // initial expand on "first" tick so we get base event fired first (in constructor started tick)
            this.expand(tick);
        }
        if (this.parts.length === 0) {
            this.runOnCompleteHooks();
            return;
        }
        if (tick >= this.startedTickId + this.maxTicksCount) {
            this.shrink(tick);
            return;
        }

        if (tick >= this.lastPartSpawnTickId + this.spawnTickCount) {
            this.expand(tick);
        }

        this.onProcess(tick);
    }

    expand(tick) {
        const candidates = this.loadParts();
        if (candidates.length === 0) {
            this.lastPartSpawnTickId = tick + this.maxTicksCount;
            return;
        }

        for (const candidate of candidates) {
            const part = this.expandPart(candidate);

            this.boundaryMin.set(
                Math.min(this.boundaryMin.x, candidate.x - part.radius),
                Math.min(this.boundaryMin.y, candidate.y),
                Math.min(this.boundaryMin.z, candidate.z - part.radius),
            );
            this.boundaryMax.set(
                Math.max(this.boundaryMax.x, candidate.x + part.radius),
                Math.max(this.boundaryMax.y, candidate.y + part.height),
                Math.max(this.boundaryMax.z, candidate.z + part.radius),
            );

            this.parts.push(part);
        }
        this.lastPartSpawnTickId = tick;
    }

    /** @returns {Point[]} PHP Point[] */
    loadParts() {
        const loadCount = this.maxPartCount - this.parts.length;

        const output = [];
        while (this.queue.length > 0 && output.length < Math.min(this.spawnPartCount, loadCount)) {
            const currentKey = this.queue.shift();
            if (currentKey in this.visited) {
                continue;
            }

            this.visited[currentKey] = true;
            output.push(Point.fromHash(currentKey));

            for (const nodeKey of this.navmesh.getGeneratedNeighbors(currentKey)) {
                this.queue.push(nodeKey);
            }
        }

        return output;
    }

    getItem() {
        return this.item;
    }

    /** @codeCoverageIgnore */
    /** @returns {Record<string, unknown>} PHP array<string,mixed> */
    serialize() {
        return {
            id: this.id,
            size: this.partSize,
            position: this.start.toArray(),
            time: this.item.getMaxTimeMs(),
            count: this.maxPartCount,
        };
    }
}
