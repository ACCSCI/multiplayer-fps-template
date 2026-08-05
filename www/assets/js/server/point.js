import { GameException } from "./game_exception.js";
import { Point2D } from "./point2d.js";

/**
 * Port of server/src/Core/Point.php
 */
export class Point {
    constructor(x = 0, y = 0, z = 0) {
        this.x = x;
        this.y = y;
        this.z = z;
    }

    static fromHash(hash) {
        const [x, y, z] = hash.split(",");
        return new Point(Number(x), Number(y), Number(z));
    }

    equals(point) {
        return this.x === point.x && this.y === point.y && this.z === point.z;
    }

    addX(amount) {
        this.x += amount;
        return this;
    }

    setX(int) {
        this.x = int;
        return this;
    }

    addY(amount) {
        this.y += amount;
        return this;
    }

    setY(int) {
        this.y = int;
        return this;
    }

    addZ(amount) {
        this.z += amount;
        return this;
    }

    setZ(int) {
        this.z = int;
        return this;
    }

    add(other) {
        this.x += other.x;
        this.y += other.y;
        this.z += other.z;
        return this;
    }

    addPart(x, y, z) {
        this.x += x;
        this.y += y;
        this.z += z;
        return this;
    }

    set(x, y, z) {
        this.x = x;
        this.y = y;
        this.z = z;
        return this;
    }

    setScalar(xyz) {
        this.x = xyz;
        this.y = xyz;
        this.z = xyz;
        return this;
    }

    toString() {
        return `Point(${this.x}, ${this.y}, ${this.z})`;
    }

    clone() {
        return new Point(this.x, this.y, this.z);
    }

    setFrom(point) {
        this.x = point.x;
        this.y = point.y;
        this.z = point.z;
    }

    setFromArray(xyz) {
        this.x = xyz[0];
        this.y = xyz[1];
        this.z = xyz[2];
    }

    addFromArray(xyz) {
        this.x += xyz[0];
        this.y += xyz[1];
        this.z += xyz[2];
    }

    hash() {
        return `${this.x},${this.y},${this.z}`;
    }

    // @deprecated
    to2D(XYaxis) {
        if (XYaxis === "xz") {
            return new Point2D(this.x, this.z);
        }
        if (XYaxis === "xy") {
            return new Point2D(this.x, this.y);
        }
        if (XYaxis === "zy") {
            return new Point2D(this.z, this.y);
        }

        GameException.notImplementedYet(`New axis '${XYaxis}'?`);
    }

    static fromArray(data) {
        return new Point(data.x, data.y, data.z);
    }

    toArray() {
        return {
            x: this.x,
            y: this.y,
            z: this.z,
        };
    }

    toFlatArray() {
        return [this.x, this.y, this.z];
    }
}
