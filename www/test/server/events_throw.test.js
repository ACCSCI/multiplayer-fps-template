import { expect, test } from "bun:test";
import { SoundType } from "../../assets/js/server/enums.js";
import { Flashbang } from "../../assets/js/server/equipment/flashbang.js";
import { Molotov } from "../../assets/js/server/equipment/molotov.js";
import { Smoke } from "../../assets/js/server/equipment/smoke.js";
import { AttackResult } from "../../assets/js/server/events/attack_result.js";
import { ThrowEvent } from "../../assets/js/server/events/throw_event.js";
import { GameException } from "../../assets/js/server/game_exception.js";
import { Point } from "../../assets/js/server/point.js";
import { setTickRate } from "../../assets/js/server/util.js";

// ThrowEvent physics: deterministic ballistic trajectory with fixed inputs,
// floor bounce, landing and serialization (PHP server/src/Event/ThrowEvent.php).

function makeThrowWorld(overrides = {}) {
    const sounds = [];
    const world = {
        getTickId: () => 0,
        makeSound: (sound) => sounds.push(sound),
        findFloorSquare: () => null,
        isCollisionWithMolotov: () => false,
        checkXSideWallCollision: () => null,
        checkZSideWallCollision: () => null,
        ...overrides,
    };
    return { world, sounds };
}

const fakeFloor = {
    getNormal: () => [0, 90],
    getNormalizedNormal: () => [0, 1, 0],
};

const fakeItem = { toArray: () => ({ id: 35, slot: 5 }), getSpeedMultiplier: () => 1.0 };

test("ThrowEvent code and serialize", () => {
    const { world } = makeThrowWorld();
    const event = new ThrowEvent({ getId: () => 1 }, world, new Point(1, 2, 3), fakeItem, 45, 0, 10, 30);
    expect(event.getCode()).toBe(11);
    expect(event.id).toMatch(/^id-\d+$/);
    expect(event.serialize()).toEqual({
        id: event.id,
        radius: 10,
        item: { id: 35, slot: 5 },
        position: { x: 1, y: 2, z: 3 },
    });
    expect(event.getPositionClone().equals(new Point(1, 2, 3))).toBe(true);
    expect(event.getPlayer().getId()).toBe(1);
    expect(event.needsToLandOnFloor).toBe(true);
});

test("ThrowEvent rejects non-positive velocity", () => {
    const { world } = makeThrowWorld();
    expect(() => new ThrowEvent({}, world, new Point(), fakeItem, 45, 0, 10, 0)).toThrow(GameException);
    expect(() => new ThrowEvent({}, world, new Point(), fakeItem, 45, 0, 10, -5)).toThrow(
        "Velocity needs to be positive",
    );
});

test("ThrowEvent ballistic trajectory", () => {
    setTickRate(20);
    const { world, sounds } = makeThrowWorld();
    const event = new ThrowEvent({ getId: () => 1 }, world, new Point(0, 100, 0), fakeItem, 45, 0, 10, 30);
    // PHP trajectory: targetX/targetY are relative to the current position, so
    // the grenade accelerates horizontally while falling.
    const expected = [
        [3, 100, 3],
        [9, 100, 9],
        [17, 99, 17],
        [28, 98, 28],
        [41, 96, 41],
        [57, 93, 57],
        [75, 89, 75],
        [96, 84, 96],
    ];
    for (let tick = 1; tick <= 8; tick++) {
        event.process(tick);
        const pos = event.getPositionClone();
        expect([pos.x, pos.y, pos.z]).toEqual(expected[tick - 1], `tick ${tick}`);
    }
    expect(sounds).toHaveLength(8);
    for (const sound of sounds) {
        expect(sound.type).toBe(SoundType.GRENADE_AIR);
        expect(sound.getPlayerId()).toBe(1);
        expect(sound.serialize().extra).toEqual({ id: event.id });
    }
});

test("ThrowEvent bounces off floor", () => {
    setTickRate(20);
    const { world, sounds } = makeThrowWorld({
        findFloorSquare: (point) => (point.y <= 100 ? fakeFloor : null),
    });
    const event = new ThrowEvent({ getId: () => 1 }, world, new Point(0, 100, 0), fakeItem, 0, -90, 10, 30);
    event.process(1);
    expect(sounds).toHaveLength(1);
    expect(sounds[0].type).toBe(SoundType.GRENADE_BOUNCE);
    expect(event.angleVertical).toBe(90);
    expect(event.angleHorizontal).toBe(0);
    expect(event.bounceCount).toBe(1);
    expect(event.velocity).toBe(20); // 30 / 1.5
    expect(event.lastBounce).toBe(true);
    expect(event.getPositionClone().equals(new Point(0, 100, 0))).toBe(true);

    event.process(2); // bounces back up
    expect(event.getPositionClone().equals(new Point(0, 102, 0))).toBe(true);
    expect(sounds).toHaveLength(2);
    expect(sounds[1].type).toBe(SoundType.GRENADE_AIR);
});

test("ThrowEvent molotov ignites on floor touch", () => {
    setTickRate(20);
    let completed = 0;
    const { world, sounds } = makeThrowWorld({
        findFloorSquare: (point) => (point.y <= 100 ? fakeFloor : null),
    });
    const event = new ThrowEvent({ getId: () => 1 }, world, new Point(0, 100, 0), new Molotov(), 0, -90, 10, 30);
    event.onComplete.push(() => completed++);
    event.process(1);
    expect(completed).toBe(1);
    expect(sounds).toHaveLength(1);
    expect(sounds[0].type).toBe(SoundType.GRENADE_LAND);
});

test("ThrowEvent smoke bounces on floor", () => {
    setTickRate(20);
    const { world, sounds } = makeThrowWorld({
        findFloorSquare: (point) => (point.y <= 100 ? fakeFloor : null),
    });
    const event = new ThrowEvent({ getId: () => 1 }, world, new Point(0, 100, 0), new Smoke(), 0, -90, 10, 30);
    event.process(1);
    expect(sounds).toHaveLength(1);
    expect(sounds[0].type).toBe(SoundType.GRENADE_BOUNCE);
    expect(event.bounceCount).toBe(1);
});

test("ThrowEvent lands when tick budget is exhausted", () => {
    setTickRate(20);
    let completed = 0;
    const { world, sounds } = makeThrowWorld({ findFloorSquare: () => fakeFloor });
    const event = new ThrowEvent({ getId: () => 1 }, world, new Point(0, 100, 0), fakeItem, 0, 0, 10, 30);
    expect(event.tickMax).toBe(1500); // getTickId() 0 + msToFrames(30000)
    event.onComplete.push(() => completed++);
    event.process(1501);
    expect(completed).toBe(1);
    expect(sounds).toHaveLength(1);
    expect(sounds[0].type).toBe(SoundType.GRENADE_LAND);
    expect(event.getPositionClone().equals(new Point(0, 100, 0))).toBe(true);
});

test("ThrowEvent flashbang lands without floor search", () => {
    setTickRate(20);
    let completed = 0;
    let floorSearches = 0;
    const { world, sounds } = makeThrowWorld({
        findFloorSquare: () => {
            floorSearches++;
            return fakeFloor;
        },
    });
    const event = new ThrowEvent({ getId: () => 1 }, world, new Point(0, 100, 0), new Flashbang(), 0, 0, 10, 30);
    expect(event.needsToLandOnFloor).toBe(false);
    expect(event.tickMax).toBe(60); // msToFrames(1200)
    event.onComplete.push(() => completed++);
    event.process(61);
    expect(completed).toBe(1);
    expect(sounds).toHaveLength(1);
    expect(sounds[0].type).toBe(SoundType.GRENADE_LAND);
    expect(floorSearches).toBe(0);
});

test("ThrowEvent fire", () => {
    const equipCalls = [];
    const player = {
        getInventory: () => ({ removeEquipped: () => equipCalls.push("remove") }),
        getEquippedItem: () => ({ getSlot: () => 5 }),
        equip: (slot) => equipCalls.push(slot),
    };
    const { world } = makeThrowWorld();
    const event = new ThrowEvent(player, world, new Point(), fakeItem, 45, 0, 10, 30);
    const result = event.fire();
    expect(equipCalls).toEqual(["remove", 5]);
    expect(event.velocity).toBe(30);
    expect(result).toBeInstanceOf(AttackResult);
    expect(result.getBullet().getShootItem()).toBe(fakeItem);
    expect(result.getHits()).toEqual([]);

    const eventSecondary = new ThrowEvent(player, world, new Point(), fakeItem, 45, 0, 10, 40);
    eventSecondary.fire();
    expect(eventSecondary.velocity).toBe(40);

    const slow = { toArray: () => ({ id: 35, slot: 5 }), getSpeedMultiplier: () => 0.5 };
    const eventSlow = new ThrowEvent(player, world, new Point(), slow, 45, 0, 10, 40);
    eventSlow.fire();
    expect(eventSlow.velocity).toBe(20);
});
