import { ItemType } from "./enums.js";

/**
 * Port of server/src/Core/DropItem.php
 */
export class DropItem {
    constructor(id, item, position) {
        this.id = id;
        this.item = item;
        this.position = position;
        this.radius =
            item.getType() === ItemType.TYPE_WEAPON_PRIMARY
                ? 30
                : item.getType() === ItemType.TYPE_WEAPON_SECONDARY
                  ? 20
                  : 10;
        this.height = 6;
    }

    getPosition() {
        return this.position;
    }

    getItem() {
        return this.item;
    }

    getBoundingRadius() {
        return this.radius;
    }

    getHeight() {
        return this.height;
    }

    getId() {
        return this.id;
    }
}
