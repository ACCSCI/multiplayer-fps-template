import { GameException } from "./game_exception.js";

/**
 * Port of server/src/Core/NavigationMesh.php
 */
export class NavigationMesh {
    constructor(tileSize, colliderHeight) {
        if (tileSize < 3 || tileSize % 2 !== 1) {
            throw new GameException("Tile size should be odd and greater than 1.");
        }

        this.tileSize = tileSize;
        this.colliderHeight = colliderHeight;
        this.tileSizeHalf = Math.ceil((tileSize - 1) / 2);
        this.data = {};
    }

    convertToNavMeshNode(point) {
        if (point.x < 1 || point.z < 1) {
            throw new GameException("World start from 1");
        }

        const fmodX = point.x % this.tileSize;
        const fmodZ = point.z % this.tileSize;

        const x =
            Math.floor((point.x + (fmodX === 0 ? -1 : 0)) / this.tileSize) * this.tileSize + 1 + this.tileSizeHalf;
        point.x = x;
        const z =
            Math.floor((point.z + (fmodZ === 0 ? -1 : 0)) / this.tileSize) * this.tileSize + 1 + this.tileSizeHalf;
        point.z = z;
    }

    /** @returns {string[]} */
    getGeneratedNeighbors(key) {
        return this.data[key] ?? [];
    }

    has(key) {
        return this.data[key] !== undefined;
    }

    /** @param {Record<string, string[]>} data */
    setData(data) {
        this.data = data;
    }

    /** @returns {Record<string, string[]>} */
    getData() {
        return this.data;
    }

    /** @codeCoverageIgnore */
    serialize() {
        return JSON.stringify({
            a: this.tileSize,
            b: this.colliderHeight,
            data: this.data,
        });
    }

    /** @codeCoverageIgnore */
    static unserialize(data) {
        const parsed = JSON.parse(data);
        const self = new NavigationMesh(parsed.a, parsed.b);
        self.data = parsed.data;
        return self;
    }
}
