import { Floor } from "./floor.js";
import { GameException } from "./game_exception.js";
import { Point } from "./point.js";
import { Wall } from "./wall.js";

/**
 * Port of server/src/Core/Box.php
 */
export class Box {
    static SIDE_FRONT = 0xf00000;
    static SIDE_BACK = 0x0f0000;
    static SIDE_LEFT = 0x00f000;
    static SIDE_RIGHT = 0x000f00;
    static SIDE_TOP = 0x0000f0;
    static SIDE_BOTTOM = 0x00000f;
    static SIDE_ALL = 0xffffff;

    constructor(lowerLeftPoint, widthX, heightY, depthZ, sides = Box.SIDE_ALL, penetrable = true) {
        this.floors = [];
        this.walls = [];
        this.lowerLeftPoint = lowerLeftPoint;
        this.widthX = widthX;
        this.heightY = heightY;
        this.depthZ = depthZ;

        if (sides & Box.SIDE_BOTTOM) {
            this.floors.push(new Floor(lowerLeftPoint.clone(), widthX, depthZ));
        }
        if (sides & Box.SIDE_TOP) {
            this.floors.push(new Floor(lowerLeftPoint.clone().addY(heightY), widthX, depthZ));
        }

        if (sides & Box.SIDE_FRONT) {
            this.walls.push(new Wall(lowerLeftPoint.clone(), true, widthX, heightY));
        }
        if (sides & Box.SIDE_BACK) {
            this.walls.push(new Wall(lowerLeftPoint.clone().addZ(depthZ), true, widthX, heightY));
        }

        if (sides & Box.SIDE_LEFT) {
            this.walls.push(new Wall(lowerLeftPoint.clone(), false, depthZ, heightY));
        }
        if (sides & Box.SIDE_RIGHT) {
            this.walls.push(new Wall(lowerLeftPoint.clone().addX(widthX), false, depthZ, heightY));
        }

        if (this.floors.length === 0 && this.walls.length === 0) {
            throw new GameException("Choose at least one box side");
        }

        for (const plane of this.floors) {
            plane.setPenetrable(penetrable);
        }
        for (const plane of this.walls) {
            plane.setPenetrable(penetrable);
        }
    }

    getFloors() {
        return this.floors;
    }

    getWalls() {
        return this.walls;
    }

    getBase() {
        return this.lowerLeftPoint;
    }

    toArray() {
        return {
            width: this.widthX,
            height: this.heightY,
            depth: this.depthZ,
            x: this.lowerLeftPoint.x,
            y: this.lowerLeftPoint.y,
            z: this.lowerLeftPoint.z,
        };
    }

    static fromArray(data) {
        return new Box(new Point(data.x, data.y, data.z), data.width, data.height, data.depth);
    }
}
