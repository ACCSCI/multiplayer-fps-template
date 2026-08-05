import { Box } from "./box.js";
import { growToPositive, isOnXAxis } from "./enums.js";

/**
 * Port of server/src/Core/Ramp.php
 */
export class Ramp {
    constructor(
        lowerLeftPoint,
        direction,
        stepCount,
        stepWidth,
        stairsGrowingUp = true,
        stepDepth = 20,
        stepHeight = 20,
    ) {
        this.stepCount = stepCount;
        this.stepWidth = stepWidth;
        this.stepDepth = stepDepth;
        this.stepHeight = stepHeight;
        this.boxes = [];

        let heightSum = stairsGrowingUp ? stepHeight : stepHeight * stepCount;
        let depth;
        let width;
        if (isOnXAxis(direction)) {
            depth = stepWidth;
            width = stepDepth;
        } else {
            depth = stepDepth;
            width = stepWidth;
        }

        const point = stairsGrowingUp ? lowerLeftPoint.clone() : lowerLeftPoint.clone().addY(-heightSum);
        for (let step = 0; step < stepCount; step++) {
            this.boxes.push(new Box(point.clone(), width, heightSum, depth)); // fixme: use smallest amount of just walls and floors instead of box

            heightSum = stairsGrowingUp ? heightSum + stepHeight : heightSum - stepHeight;
            const amount = (growToPositive(direction) ? 1 : -1) * stepDepth;
            if (isOnXAxis(direction)) {
                point.addX(amount);
            } else {
                point.addZ(amount);
            }
        }
    }

    // fixme: migrate to walls and floors
    getBoxes() {
        return this.boxes;
    }
}
