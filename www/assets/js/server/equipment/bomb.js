import { InventorySlot, ItemType } from "../enums.js";
import { Point } from "../point.js";
import { distanceSquared, millisecondsToFrames } from "../util.js";
import { BaseEquipment } from "./base_equipment.js";

/**
 * Port of server/src/Equipment/Bomb.php
 */
export class Bomb extends BaseEquipment {
    static equipReadyTimeMs = 80;

    /** @type {Point} PHP private Point $position */
    position = new Point();
    /** @type {number} PHP private int $plantTickStart */
    plantTickStart = 0;
    /** @type {number} PHP private int $plantTickCountMax */
    plantTickCountMax = 0;
    /** @type {number} PHP private int $defuseTickStart */
    defuseTickStart = 0;
    /** @type {number} PHP private int $defuseTickCountMax */
    defuseTickCountMax = 0;
    /** @type {number} PHP private int $tickToDefuseCount */
    tickToDefuseCount = 0;
    lastBombActionTick = -1;
    lastBombPlayerId = -1;

    constructor(plantTimeMs, defuseTimeMs, maxBlastDistance = 1000, bombActionTickBuffer = 1) {
        super();
        this.maxBlastDistance = maxBlastDistance;
        this.bombActionTickBuffer = bombActionTickBuffer;
        this.plantTickCountMax = millisecondsToFrames(plantTimeMs);
        this.plantTickStart = -this.plantTickCountMax;
        this.defuseTickCountMax = millisecondsToFrames(defuseTimeMs);
        this.defuseTickStart = -this.defuseTickCountMax;
    }

    setMaxBlastDistance(maxBlastDistance) {
        this.maxBlastDistance = maxBlastDistance;
    }

    getType() {
        return ItemType.TYPE_BOMB;
    }

    getSlot() {
        return InventorySlot.SLOT_BOMB;
    }

    reset() {
        super.reset();
        this.plantTickStart = 0;
        this.defuseTickStart = 0;
    }

    unEquip() {
        super.unEquip();
        this.reset();
    }

    /**
     * @param {object} player PHP Player
     * @param {number} tickId
     * @returns {?boolean} null = planting in progress, true = planted, false = nothing
     */
    tryPlant(player, tickId) {
        let planted = false;
        const playerId = player.getId();
        if (playerId !== this.lastBombPlayerId || this.lastBombActionTick + this.bombActionTickBuffer < tickId) {
            player.stop();
            this.plantTickStart = tickId;
            planted = null;
        }
        this.lastBombActionTick = tickId;
        this.lastBombPlayerId = playerId;

        if (this.isPlanted(tickId)) {
            this.position.setFrom(player.getReferenceToPosition());
            this.lastBombActionTick = -1;
            this.lastBombPlayerId = -1;
            planted = true;
        }
        return planted;
    }

    /**
     * @param {object} player PHP Player
     * @param {number} tickId
     * @returns {?boolean} null = defusing in progress, true = defused, false = nothing
     */
    tryDefuse(player, tickId) {
        let defused = false;
        const playerId = player.getId();
        if (playerId !== this.lastBombPlayerId || this.lastBombActionTick + this.bombActionTickBuffer < tickId) {
            player.stop();
            this.defuseTickStart = tickId;
            this.tickToDefuseCount = player.hasDefuseKit()
                ? Math.ceil(this.defuseTickCountMax / 2)
                : this.defuseTickCountMax;
            defused = null;
        }
        this.lastBombActionTick = tickId;
        this.lastBombPlayerId = playerId;

        if (this.isDefused(tickId)) {
            this.lastBombActionTick = -1;
            this.lastBombPlayerId = -1;
            defused = true;
        }
        return defused;
    }

    isPlanted(tickId) {
        return tickId - this.plantTickStart >= this.plantTickCountMax;
    }

    isDefused(tickId) {
        return tickId - this.defuseTickStart >= this.tickToDefuseCount;
    }

    isPlantingOrDefusing(playerId, tickId) {
        return this.lastBombPlayerId === playerId && this.bombActionTickBuffer >= tickId - this.lastBombActionTick;
    }

    getPosition() {
        return this.position;
    }

    /** @codeCoverageIgnore **/
    explodeDamageToPlayer(player) {
        const distanceSquaredToPlayer = distanceSquared(player.getPositionClone(), this.position);
        const maxDistance = this.maxBlastDistance * this.maxBlastDistance;
        if (distanceSquaredToPlayer > maxDistance) {
            return;
        }

        if (distanceSquaredToPlayer > maxDistance * 0.9) {
            player.lowerHealth(4);
            player.lowerArmor(4);
        } else if (distanceSquaredToPlayer > maxDistance * 0.8) {
            player.lowerHealth(7);
            player.lowerArmor(7);
        } else if (distanceSquaredToPlayer > maxDistance * 0.7) {
            player.lowerHealth(12);
            player.lowerArmor(12);
        } else if (distanceSquaredToPlayer > maxDistance * 0.6) {
            player.lowerHealth(26);
            player.lowerArmor(26);
        } else if (distanceSquaredToPlayer > maxDistance * 0.5) {
            player.lowerHealth(49);
            player.lowerArmor(49);
        } else if (distanceSquaredToPlayer > maxDistance * 0.4) {
            player.lowerHealth(61);
            player.lowerArmor(61);
        } else if (distanceSquaredToPlayer > maxDistance * 0.3) {
            player.lowerHealth(74);
            player.lowerArmor(74);
        } else if (distanceSquaredToPlayer > maxDistance * 0.2) {
            player.lowerHealth(84);
            player.lowerArmor(84);
        } else if (distanceSquaredToPlayer > maxDistance * 0.1) {
            player.lowerHealth(92);
            player.lowerArmor(92);
        } else {
            player.lowerHealth(500);
            player.lowerArmor(500);
        }
    }
}
