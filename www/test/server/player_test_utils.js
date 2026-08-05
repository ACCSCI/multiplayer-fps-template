import { Floor } from "../../assets/js/server/floor.js";
import { GameException } from "../../assets/js/server/game_exception.js";
import { Player } from "../../assets/js/server/player.js";
import { Point } from "../../assets/js/server/point.js";
import { loadConstants } from "../../assets/js/server/setting.js";
import { setTickRate } from "../../assets/js/server/util.js";

/**
 * Test helpers shared by the player test files.
 * Mirrors the PHP test settings from test/og/BaseTestCase.php
 * (TEST_TICK_RATE = 10) so expected values match the PHP test suite.
 */
export const TEST_TICK_RATE = 10;

export function loadTestSettings() {
    setTickRate(TEST_TICK_RATE);
    loadConstants({
        moveOneMs: 5,
        moveWalkOneMs: 4,
        moveCrouchOneMs: 3,
        fallAmountOneMs: 6,
        crouchDurationMs: 40,
        jumpDurationMs: 50,
        throwSpeed: 20,
        playerVelocity: 0,
        playerHeadRadius: 10,
        playerBoundingRadius: 44,
        playerJumpHeight: 150,
        playerHeadHeightStand: 190,
        playerHeadHeightCrouch: 140,
        playerObstacleOvercomeHeight: 20,
        playerFallDamageThreshold: 500,
    });
}

/** Restores the pristine module defaults (tick rate 20 + Setting defaults). */
export function restoreDefaultSettings() {
    setTickRate(20);
    loadConstants({
        moveOneMs: 0.6,
        moveWalkOneMs: 0.34,
        moveCrouchOneMs: 0.2,
        fallAmountOneMs: 1,
        crouchDurationMs: 250,
        jumpDurationMs: 420,
        jumpMovementSpeedMultiplier: 1.0,
        flyingMovementSpeedMultiplier: 0.8,
        throwSpeed: 40,
        playerVelocity: 100,
        playerHeadRadius: 10,
        playerBoundingRadius: 60,
        playerJumpHeight: 170,
        playerHeadHeightStand: 190,
        playerHeadHeightCrouch: 140,
        playerObstacleOvercomeHeight: 30,
        playerFallDamageThreshold: 500,
    });
}

/** Duck-typed World implementing the contract methods the Player slice uses. */
export class MockWorld {
    constructor() {
        this.floorsByY = {};
        this.tickId = 0;
        this.paused = false;
        this.sounds = [];
        this.droppedItems = [];
        this.thrownEvents = [];
        this.deadByFallDamage = null;
        this.backtrack = {
            saveState() {},
            restoreState() {},
        };
    }

    addFloor(floor) {
        const y = floor.getY();
        if (!this.floorsByY[y]) {
            this.floorsByY[y] = [];
        }
        this.floorsByY[y].push(floor);
    }

    findFloorSquare(point, radius) {
        if (point.y < 0) {
            throw new GameException("Y value cannot be lower than zero");
        }
        const floors = this.floorsByY[point.y] ?? [];
        for (const floor of floors) {
            if (floor.intersect(point, radius)) {
                return floor;
            }
        }
        return null;
    }

    findPlayersHeadFloor() {
        return null;
    }

    findHighestWall() {
        return 0;
    }

    checkXSideWallCollision() {
        return null;
    }

    checkZSideWallCollision() {
        return null;
    }

    isCollisionWithOtherPlayers() {
        return null;
    }

    canAttack() {
        return true;
    }

    canBuy() {
        return true;
    }

    canPlant() {
        return false;
    }

    isPlantingOrDefusing() {
        return false;
    }

    getTickId() {
        return this.tickId;
    }

    isPaused() {
        return this.paused;
    }

    makeSound(event) {
        this.sounds.push(event);
    }

    dropItem(_player, item) {
        this.droppedItems.push(item);
    }

    playerDiedToFallDamage(player) {
        this.deadByFallDamage = player;
    }

    playerUse(player) {
        this.usedPlayer = player;
    }

    tryPickDropItems() {}

    tryPlantBomb() {}

    throw(event) {
        this.thrownEvents.push(event);
    }

    isCollisionWithMolotov() {
        return false;
    }

    optimizeBulletHitCheck() {}

    calculateHits() {
        return [];
    }

    bulletHit() {}

    getBacktrack() {
        return this.backtrack;
    }
}

export function createPlayer(id = 1, isAttacker = true) {
    const world = new MockWorld();
    const player = new Player(id, 1, isAttacker);
    player.setWorld(world);
    return { player, world };
}

/** Adds a big floor at y=0 and ticks once so gravity pins the player to it. */
export function standOnGround(player, world) {
    world.addFloor(new Floor(new Point(0, 0, 0), 1000, 1000));
    const ticker = createTicker(player);
    ticker.tick();
    return ticker;
}

export function createTicker(player) {
    let tickId = 0;
    return {
        tick() {
            player.onTick(tickId++);
        },
        getTickId() {
            return tickId;
        },
    };
}
