/**
 * Port of server/src/Core/Point2D.php
 */
export class Point2D {
    constructor(x = 0, y = 0) {
        this.x = x;
        this.y = y;
    }

    add(xAmount, yAmount) {
        this.x += xAmount;
        this.y += yAmount;
        return this;
    }

    toString() {
        return `Point2D(${this.x},${this.y})`;
    }

    toArray() {
        return {
            x: this.x,
            y: this.y,
        };
    }
}
