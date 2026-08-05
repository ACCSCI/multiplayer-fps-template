import { afterAll, beforeAll, expect, test } from "bun:test";
import { SoundType } from "../../assets/js/server/enums.js";
import { Point } from "../../assets/js/server/point.js";
import {
    moveDistanceCrouchPerTick,
    moveDistancePerTick,
    moveDistanceWalkPerTick,
    playerFallDamageThreshold,
    playerJumpHeight,
    tickCountCrouch,
    tickCountJump,
} from "../../assets/js/server/setting.js";
import { createPlayer, loadTestSettings, restoreDefaultSettings, standOnGround } from "./player_test_utils.js";

beforeAll(() => {
    loadTestSettings();
});

afterAll(() => {
    restoreDefaultSettings();
});

test("player moves forward full speed per tick (knife equipped)", () => {
    const { player, world } = createPlayer(1, true);
    player.equipKnife();
    const ticker = standOnGround(player, world);
    for (let i = 0; i < 20; i++) {
        player.moveForward();
        ticker.tick();
    }
    expect(player.getPositionClone().toArray()).toEqual({ x: 0, y: 0, z: 20 * moveDistancePerTick() });
});

test("player moves right", () => {
    const { player, world } = createPlayer(1, true);
    player.equipKnife();
    const ticker = standOnGround(player, world);
    for (let i = 0; i < 20; i++) {
        player.moveRight();
        ticker.tick();
    }
    expect(player.getPositionClone().toArray()).toEqual({ x: 20 * moveDistancePerTick(), y: 0, z: 0 });
});

test("player diagonal movement stays in half-open interval", () => {
    const { player, world } = createPlayer(1, true);
    player.equipKnife();
    const ticker = standOnGround(player, world);
    player.moveForward();
    player.moveRight();
    ticker.tick();
    const position = player.getPositionClone();
    expect(position.x).toBeGreaterThan(moveDistancePerTick() / 2);
    expect(position.x).toBeLessThan(moveDistancePerTick());
    expect(position.z).toBeGreaterThan(moveDistancePerTick() / 2);
    expect(position.z).toBeLessThan(moveDistancePerTick());
});

test("player counter strafing stops movement instantly", () => {
    const { player, world } = createPlayer(1, true);
    player.equipKnife();
    const ticker = standOnGround(player, world);
    player.moveRight();
    ticker.tick();
    expect(player.getPositionClone().x).toBe(moveDistancePerTick());
    player.moveLeft();
    ticker.tick();
    expect(player.getPositionClone().x).toBe(moveDistancePerTick()); // counter strafe - no move
    player.moveLeft();
    ticker.tick();
    expect(player.getPositionClone().x).toBe(0);
});

test("player reversing direction after counter strafe accelerates next tick", () => {
    const { player, world } = createPlayer(1, true);
    player.equipKnife();
    const ticker = standOnGround(player, world);
    player.moveRight();
    ticker.tick();
    player.moveLeft();
    ticker.tick();
    player.moveLeft();
    ticker.tick();
    expect(player.getPositionClone().x).toBe(0);
    player.moveRight();
    ticker.tick(); // counter strafe again
    expect(player.getPositionClone().x).toBe(0);
    player.moveRight();
    ticker.tick();
    expect(player.getPositionClone().x).toBe(moveDistancePerTick());
});

test("player walk speed", () => {
    const { player, world } = createPlayer(1, true);
    player.equipKnife();
    const ticker = standOnGround(player, world);
    for (let i = 0; i < 20; i++) {
        player.speedWalk();
        player.moveForward();
        ticker.tick();
    }
    expect(player.getPositionClone().toArray()).toEqual({ x: 0, y: 0, z: 20 * moveDistanceWalkPerTick() });
});

test("player crouch speed", () => {
    const { player, world } = createPlayer(1, true);
    player.equipKnife();
    const ticker = standOnGround(player, world);
    player.crouch();
    for (let i = 0; i < tickCountCrouch(); i++) {
        ticker.tick();
    }
    expect(player.isCrouching()).toBe(true);
    player.moveForward();
    ticker.tick();
    expect(player.getPositionClone().z).toBe(moveDistanceCrouchPerTick());
});

test("player crouch and stand transitions head height", () => {
    const { player, world } = createPlayer(1, true);
    player.equipKnife();
    const ticker = standOnGround(player, world);
    expect(player.isCrouching()).toBe(false);
    player.crouch();
    for (let i = 0; i < tickCountCrouch(); i++) {
        ticker.tick();
    }
    expect(player.getHeadHeight()).toBe(140);
    expect(player.isCrouching()).toBe(true);
    player.stand();
    for (let i = 0; i < tickCountCrouch(); i++) {
        ticker.tick();
    }
    expect(player.getHeadHeight()).toBe(190);
    expect(player.isCrouching()).toBe(false);
    expect(player.canCrouch()).toBe(true);
});

test("player jump reaches jump height and falls back", () => {
    const { player, world } = createPlayer(1, true);
    player.equipKnife();
    const ticker = standOnGround(player, world);
    player.jump();
    expect(player.isJumping()).toBe(true);
    const ys = [30, 60, 90, 120, 150];
    for (let i = 0; i < ys.length; i++) {
        ticker.tick();
        expect(player.getPositionClone().y).toBe(ys[i]);
        expect(player.isJumping()).toBe(true);
    }
    ticker.tick();
    expect(player.isJumping()).toBe(false);
    expect(player.getPositionClone().y).toBe(90);
    ticker.tick();
    expect(player.getPositionClone().y).toBe(30);
    ticker.tick();
    expect(player.getPositionClone().y).toBe(0);
});

test("player jump height is playerJumpHeight setting", () => {
    const { player, world } = createPlayer(1, true);
    player.equipKnife();
    const ticker = standOnGround(player, world);
    player.jump();
    for (let i = 0; i < tickCountJump(); i++) {
        ticker.tick();
    }
    expect(player.getPositionClone().y).toBe(playerJumpHeight());
});

test("player crouch jump bonus increases jump height", () => {
    const { player, world } = createPlayer(1, true);
    player.equipKnife();
    const ticker = standOnGround(player, world);
    player.crouch();
    for (let i = 0; i < tickCountCrouch(); i++) {
        ticker.tick();
    }
    player.jump();
    for (let i = 0; i < tickCountJump() + 1; i++) {
        ticker.tick();
    }
    expect(player.getPositionClone().y).toBe(playerJumpHeight() + 10);
});

test("player cannot jump while airborne", () => {
    const { player, world } = createPlayer(1, true);
    player.equipKnife();
    const ticker = standOnGround(player, world);
    player.jump();
    ticker.tick();
    expect(player.canJump()).toBe(false);
    player.jump(); // no-op
    ticker.tick();
    expect(player.isJumping()).toBe(true);
});

test("player makes step sound while running on ground", () => {
    const { player, world } = createPlayer(1, true);
    player.equipKnife();
    const ticker = standOnGround(player, world);
    world.sounds.length = 0;
    player.moveForward();
    ticker.tick();
    expect(world.sounds.some((event) => event.type === SoundType.PLAYER_STEP)).toBe(true);
    expect(world.sounds.find((event) => event.type === SoundType.PLAYER_STEP).getPlayerId()).toBe(1);
});

test("player fall damage on landing", () => {
    const { player, world } = createPlayer(1, true);
    player.equipKnife();
    standOnGround(player, world);
    player.setPosition(new Point(0, 600, 0)); // no floor at 600 -> starts falling
    expect(player.isFlying()).toBe(true);
    for (let i = 0; i < 10; i++) {
        player.onTick(i + 1);
    }
    expect(player.getPositionClone().y).toBe(0);
    expect(player.getHealth()).toBe(100 - 37);
    expect(world.sounds.some((event) => event.type === SoundType.PLAYER_GROUND_TOUCH)).toBe(true);
});

test("player fall damage below threshold is harmless", () => {
    const { player, world } = createPlayer(1, true);
    player.equipKnife();
    standOnGround(player, world);
    player.setPosition(new Point(0, 300, 0));
    for (let i = 0; i < 5; i++) {
        player.onTick(i + 1);
    }
    expect(player.getPositionClone().y).toBe(0);
    expect(player.getHealth()).toBe(100);
});

test("player lethal fall damage kills", () => {
    const { player, world } = createPlayer(1, true);
    player.equipKnife();
    standOnGround(player, world);
    player.setPosition(new Point(0, 1600, 0));
    for (let i = 0; i < 27; i++) {
        player.onTick(i + 1);
    }
    expect(player.getPositionClone().y).toBe(0);
    expect(player.getHealth()).toBe(0);
    expect(player.isAlive()).toBe(false);
    expect(world.deadByFallDamage).toBe(player);
    expect(world.droppedItems).toHaveLength(1);
});

test("player fall damage threshold equals setting", () => {
    expect(playerFallDamageThreshold()).toBe(500);
});

test("player shot slowdown reduces movement speed", () => {
    const { player, world } = createPlayer(1, true);
    player.equipKnife();
    const ticker = standOnGround(player, world);
    player.lowerHealth(25); // adds shot slowdown event (70ms -> 7 ticks)
    for (let i = 0; i < 8; i++) {
        player.moveForward();
        ticker.tick();
    }
    // 7 ticks slowed (50 * 0.4 = 20), 8th tick the timeout fires before movement -> full speed
    expect(player.getPositionClone().z).toBe(7 * 20 + moveDistancePerTick());
});

test("player last direction is kept for counter strafe", () => {
    const { player, world } = createPlayer(1, true);
    player.equipKnife();
    const ticker = standOnGround(player, world);
    player.moveForward();
    ticker.tick();
    expect(player.isMoving()).toBe(false);
    player.moveBackward();
    ticker.tick();
    expect(player.getPositionClone().z).toBe(moveDistancePerTick()); // counter strafe
});

test("player flying movement speed multiplier", () => {
    const { player, world } = createPlayer(1, true);
    player.equipKnife();
    standOnGround(player, world);
    player.setPosition(new Point(0, 500, 0));
    expect(player.isFlying()).toBe(true);
    player.moveForward();
    player.onTick(1);
    // flyingMovementSpeedMultiplier = 0.8
    expect(player.getPositionClone().z).toBe(Math.ceil(moveDistancePerTick() * 0.8));
});

test("player air direction change limit stops movement", () => {
    const { player, world } = createPlayer(1, true);
    player.equipKnife();
    standOnGround(player, world);
    player.setPosition(new Point(0, 500, 0));
    player.getSight().lookHorizontal(0);
    player.moveForward();
    player.onTick(1);
    const z = player.getPositionClone().z;
    expect(z).toBeGreaterThan(0);
    player.stop();
    player.getSight().lookHorizontal(180);
    player.moveForward();
    player.onTick(2);
    expect(player.getPositionClone().z).toBe(z); // drastic air direction change - stop
});
