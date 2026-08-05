import { Box } from "./box.js";
import { pointWithBox, pointWithBoxBoundary } from "./collision.js";
import { Point } from "./point.js";

/**
 * Port of server/src/Core/BoxGroup.php
 */
export class BoxGroup {
    constructor(boxes = []) {
        // PHP arrays have value semantics: the constructor property is a copy
        // of the passed array, so add() pushes must not leak to the caller.
        this.boxes = [...boxes];
        // PHP_INT_MAX / PHP_INT_MIN are not exactly representable in JS; any
        // value large enough to be replaced by the first box boundaries works.
        this.boundaryMin = new Point(Number.MAX_SAFE_INTEGER, Number.MAX_SAFE_INTEGER, Number.MAX_SAFE_INTEGER);
        this.boundaryMax = new Point(Number.MIN_SAFE_INTEGER, Number.MIN_SAFE_INTEGER, Number.MIN_SAFE_INTEGER);

        // PHP foreach iterates a copy of the array, so add() pushing into
        // this.boxes mid-loop is safe there; iterate a snapshot here too.
        for (const box of [...this.boxes]) {
            this.add(box);
        }
    }

    add(box) {
        const boxMin = box.getBase();
        this.boundaryMin.set(
            Math.min(this.boundaryMin.x, boxMin.x),
            Math.min(this.boundaryMin.y, boxMin.y),
            Math.min(this.boundaryMin.z, boxMin.z),
        );
        this.boundaryMax.set(
            Math.max(this.boundaryMax.x, boxMin.x + box.widthX),
            Math.max(this.boundaryMax.y, boxMin.y + box.heightY),
            Math.max(this.boundaryMax.z, boxMin.z + box.depthZ),
        );
        this.boxes.push(box);
    }

    contains(point) {
        if (this.boxes.length === 0 || !pointWithBoxBoundary(point, this.boundaryMin, this.boundaryMax)) {
            return false;
        }

        for (const box of this.boxes) {
            if (pointWithBox(point, box)) {
                return true;
            }
        }

        return false;
    }

    toArray() {
        return this.boxes.map((box) => box.toArray());
    }

    static fromArray(data) {
        return new BoxGroup(data.map((boxData) => Box.fromArray(boxData)));
    }
}
