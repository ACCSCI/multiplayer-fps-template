import { expect, test } from "bun:test";
import { Bullet } from "../../assets/js/server/bullet.js";
import { Column } from "../../assets/js/server/column.js";
import { DropItem } from "../../assets/js/server/drop_item.js";
import { ItemType, SoundType } from "../../assets/js/server/enums.js";
import { Smoke } from "../../assets/js/server/equipment/smoke.js";
import { AttackEvent } from "../../assets/js/server/events/attack_event.js";
import { AttackResult } from "../../assets/js/server/events/attack_result.js";
import { DropEvent } from "../../assets/js/server/events/drop_event.js";
import { GrillEvent } from "../../assets/js/server/events/grill_event.js";
import { SmokeEvent } from "../../assets/js/server/events/smoke_event.js";
import { GameException } from "../../assets/js/server/game_exception.js";
import { Point } from "../../assets/js/server/point.js";
import { setTickRate } from "../../assets/js/server/util.js";

// Events slice physics tests: DropEvent ballistics, AttackEvent bullets,
// volumetric (GrillEvent/SmokeEvent) expansion - all with fixed inputs and
// deterministic expectations (PHP server/src/Event/*.php).

function makeFakePlayer(overrides = {}) {
    return {
        getId: () => 1,
        getSightPositionClone: () => new Point(0, 100, 0),
        getSight: () => ({ getRotationHorizontal: () => 45, getRotationVertical: () => 0 }),
        isMoving: () => false,
        isJumping: () => false,
        isAlive: () => true,
        ...overrides,
    };
}

function makeFakeItem(overrides = {}) {
    return {
        getId: () => 5,
        getType: () => ItemType.TYPE_WEAPON_PRIMARY,
        toArray: () => ({ id: 5, slot: 1 }),
        ...overrides,
    };
}

function makeNavmesh(overrides = {}) {
    return { tileSizeHalf: 50, colliderHeight: 190, getGeneratedNeighbors: () => [], ...overrides };
}

function makeVolumetricItem(overrides = {}) {
    return {
        getMaxTimeMs: () => 7000,
        getSpawnAreaMetersSquared: () => 100,
        getMaxAreaMetersSquared: () => 450000,
        ...overrides,
    };
}

function makeVolumetricWorld(overrides = {}) {
    const sounds = [];
    const world = {
        getTickId: () => 100,
        makeSound: (sound) => sounds.push(sound),
        flameCanIgnite: () => true,
        checkFlameDamage: () => {},
        findFloorSquare: () => null,
        smokeTryToExtinguishFlames: () => {},
        ...overrides,
    };
    return { world, sounds };
}

test("DropEvent free fall trajectory", () => {
    setTickRate(20);
    const sounds = [];
    const world = {
        isCollisionWithOtherPlayers: () => null,
        isWallOrFloorCollision: () => false,
        findFloorSquare: () => null,
        makeSound: (sound) => sounds.push(sound),
    };
    const event = new DropEvent(makeFakePlayer(), makeFakeItem(), world);
    // PHP trajectory: targetX/targetY are relative to the current position, so
    // the drop accelerates horizontally while falling.
    const expected = [
        [3, 100, 3],
        [9, 99, 9],
        [17, 97, 17],
        [28, 94, 28],
        [42, 89, 42],
    ];
    for (let tick = 1; tick <= 5; tick++) {
        event.process(tick);
        const pos = event.dropPosition;
        expect([pos.x, pos.y, pos.z]).toEqual(expected[tick - 1], `tick ${tick}`);
    }
    expect(sounds).toHaveLength(5);
    for (const sound of sounds) {
        expect(sound.type).toBe(SoundType.ITEM_DROP_AIR);
        expect(sound.getItem()).toBe(event.item);
        expect(sound.getPlayerId()).toBe(1);
    }
    expect(sounds[4].serialize()).toEqual({
        position: { x: 42, y: 89, z: 42 },
        item: { id: 5, slot: 1 },
        player: 1,
        type: SoundType.ITEM_DROP_AIR,
        extra: { id: event.id },
    });
});

test("DropEvent lands on floor", () => {
    setTickRate(20);
    const sounds = [];
    let landed = null;
    let completed = 0;
    const world = {
        isCollisionWithOtherPlayers: () => null,
        isWallOrFloorCollision: () => true,
        findFloorSquare: () => ({}),
        makeSound: (sound) => sounds.push(sound),
    };
    const event = new DropEvent(makeFakePlayer(), makeFakeItem(), world);
    event.onFloorLand((dropItem) => {
        landed = dropItem;
    });
    event.onComplete.push(() => completed++);
    event.process(1);
    expect(landed).toBeInstanceOf(DropItem);
    expect(landed.getItem()).toBe(event.item);
    expect(completed).toBe(1);
    expect(sounds).toHaveLength(1);
    expect(sounds[0].type).toBe(SoundType.ITEM_DROP_LAND);
    expect(event.angleVertical).toBe(-90);
    expect(event.dropPosition.equals(new Point(1, 100, 1))).toBe(true);
});

test("DropEvent is picked up by another player", () => {
    setTickRate(20);
    const sounds = [];
    let completed = 0;
    const picker = { getId: () => 2, getInventory: () => ({ pickup: () => true }) };
    const world = {
        isCollisionWithOtherPlayers: () => picker,
        isWallOrFloorCollision: () => false,
        findFloorSquare: () => null,
        makeSound: (sound) => sounds.push(sound),
    };
    const event = new DropEvent(makeFakePlayer(), makeFakeItem(), world);
    event.onComplete.push(() => completed++);
    event.process(1);
    expect(completed).toBe(1);
    expect(sounds).toHaveLength(1);
    expect(sounds[0].type).toBe(SoundType.ITEM_PICKUP);
    expect(sounds[0].getPlayerId()).toBe(2);
    expect(sounds[0].serialize().extra).toEqual({ id: event.id });
});

test("AttackEvent fire without hits", () => {
    setTickRate(20);
    const bullet = new Bullet({}, 100);
    const item = { createBullet: () => bullet };
    const optimizeCalls = [];
    const saveCalls = [];
    const world = {
        getTickId: () => 42,
        optimizeBulletHitCheck: (b, maxDestination) => optimizeCalls.push([b, maxDestination]),
        calculateHits: () => [],
        bulletHit: () => {},
        getBacktrack: () => ({
            saveState: () => saveCalls.push("save"),
            restoreState: () => saveCalls.push("restore"),
        }),
    };
    const origin = new Point(0, 100, 0);
    const event = new AttackEvent(world, origin, item, 0, 0, 1, true);
    const result = event.fire();
    expect(optimizeCalls).toHaveLength(1);
    expect(optimizeCalls[0][0]).toBe(bullet);
    expect(optimizeCalls[0][1].equals(new Point(0, 100, 100))).toBe(true);
    expect(result).toBeInstanceOf(AttackResult);
    expect(result.getBullet()).toBe(bullet);
    expect(result.getHits()).toEqual([]);
    expect(result.getMoneyAward()).toBe(0);
    expect(result.somePlayersWasHit()).toBe(false);
    expect(bullet.getDistanceTraveled()).toBe(100);
    expect(bullet.isActive()).toBe(false);
    expect(bullet.getPosition().equals(new Point(0, 100, 100))).toBe(true);
    expect(saveCalls).toEqual(["save", "restore"]);
    expect(event.getTickId()).toBe(42);
});

test("AttackEvent fire with hits and recoil", () => {
    setTickRate(20);
    const bullet = new Bullet({}, 100);
    const hit = {
        getHitAntiForce: () => 5,
        getMoneyAward: () => 300,
        getPlayer: () => null,
        wasHeadShot: () => false,
    };
    const bulletHitCalls = [];
    const world = {
        getTickId: () => 42,
        optimizeBulletHitCheck: () => {},
        calculateHits: () => [hit],
        bulletHit: (h, b, headshot) => bulletHitCalls.push([h, b, headshot]),
        getBacktrack: () => ({ saveState: () => {}, restoreState: () => {} }),
    };
    const event = new AttackEvent(world, new Point(0, 100, 0), { createBullet: () => bullet }, 0, 0, 1, true);
    const result = event.fire();
    expect(result.getHits()).toEqual([hit]);
    expect(result.getMoneyAward()).toBe(300);
    expect(result.somePlayersWasHit()).toBe(false);
    expect(bulletHitCalls).toHaveLength(1);
    expect(bulletHitCalls[0][2]).toBe(false);
    expect(bullet.getDamage()).toBe(-4);
    expect(bullet.isActive()).toBe(false);

    event.applyRecoil(1.5, -2.5);
    expect(event.angleHorizontal).toBe(1.5);
    expect(event.angleVertical).toBe(-2.5);
});

test("AttackResult somePlayersWasHit", () => {
    const bullet = new Bullet({}, 100);
    const result = new AttackResult(bullet);
    const hit = { getMoneyAward: () => 0, getPlayer: () => ({}) };
    result.addHit(hit);
    expect(result.somePlayersWasHit()).toBe(true);
    expect(result.getHits()).toEqual([hit]);
});

test("GrillEvent volumetric lifecycle", () => {
    setTickRate(20);
    const flameChecks = [];
    const { world, sounds } = makeVolumetricWorld({
        checkFlameDamage: (_fire, tickId) => flameChecks.push(tickId),
    });
    const event = new GrillEvent({}, makeVolumetricItem(), world, makeNavmesh(), new Point(10, 20, 30));
    expect(event.partRadius).toBe(50);
    expect(event.partSize).toBe(101);
    expect(event.partHeight).toBe(190);
    expect(event.spawnPartCount).toBe(1);
    expect(event.maxPartCount).toBe(45);
    expect(event.serialize()).toEqual({
        id: event.id,
        size: 101,
        position: { x: 10, y: 20, z: 30 },
        time: 7000,
        count: 45,
    });

    let completed = 0;
    event.onComplete.push(() => completed++);

    event.process(101); // initial expand
    expect(event.parts).toHaveLength(1);
    expect(event.parts[0].height).toBe(190);
    expect(event.boundaryMin.equals(new Point(-40, 20, -20))).toBe(true);
    expect(event.boundaryMax.equals(new Point(60, 210, 80))).toBe(true);
    expect(flameChecks).toEqual([101]);
    expect(sounds).toHaveLength(1);
    expect(sounds[0].type).toBe(SoundType.FLAME_SPAWN);
    expect(sounds[0].extra).toEqual({ id: event.id, height: 190 });

    event.process(102); // spawn tick count reached, no more candidates
    expect(flameChecks).toEqual([101, 102]);

    event.process(450); // maxTicksCount reached -> shrink
    expect(flameChecks).toEqual([101, 102, 450]);
    expect(sounds).toHaveLength(2);
    expect(sounds[1].type).toBe(SoundType.FLAME_EXTINGUISH);
    expect(sounds[1].extra).toEqual({ id: event.id });

    event.process(451); // parts empty -> complete
    expect(completed).toBe(1);
});

test("GrillEvent flame cooldown and extinguish", () => {
    const { world, sounds } = makeVolumetricWorld();
    const event = new GrillEvent({}, makeVolumetricItem(), world, makeNavmesh(), new Point());
    expect(event.damageCoolDownTickCount).toBe(5);
    expect(event.canHitPlayer(1, 10)).toBe(true);
    event.playerHit(1, 10);
    expect(event.canHitPlayer(1, 14)).toBe(false);
    expect(event.canHitPlayer(1, 15)).toBe(true);

    const flame = new Column(new Point(), 50, 190);
    event.extinguish(flame);
    expect(flame.active).toBe(false);
    expect(sounds).toHaveLength(1);
    expect(sounds[0].type).toBe(SoundType.FLAME_EXTINGUISH);
});

test("GrillEvent flame cannot ignite near smoke", () => {
    const { world, sounds } = makeVolumetricWorld({ flameCanIgnite: () => false });
    const event = new GrillEvent({}, makeVolumetricItem(), world, makeNavmesh(), new Point());
    const flame = event.expandPart(new Point());
    expect(flame.active).toBe(false);
    expect(sounds).toHaveLength(0);
});

test("SmokeEvent setup, serialize and code", () => {
    const { world } = makeVolumetricWorld({ getTickId: () => 0, findFloorSquare: () => null });
    const event = new SmokeEvent({}, new Smoke(), world, makeNavmesh(), new Point(0, 0, 0));
    expect(event.getCode()).toBe(14);
    expect(event.partSize).toBe(101);
    expect(event.spawnPartCount).toBe(2);
    expect(event.maxPartCount).toBe(54);
    expect(event.maxHeight).toBe(Smoke.MAX_HEIGHT);
    expect(event.serialize()).toEqual({
        id: event.id,
        size: 101,
        position: { x: 0, y: 0, z: 0 },
        time: Smoke.MAX_TIME_MS,
        count: 54,
    });
});

test("SmokeEvent rejects part height above max", () => {
    const world = { getTickId: () => 0 };
    expect(() => new SmokeEvent({}, new Smoke(), world, makeNavmesh({ colliderHeight: 300 }), new Point())).toThrow(
        GameException,
    );
});

test("SmokeEvent expand grows column to max height", () => {
    const extinguishCalls = [];
    const { world, sounds } = makeVolumetricWorld({
        getTickId: () => 0,
        findFloorSquare: () => null,
        smokeTryToExtinguishFlames: (column) => extinguishCalls.push(column),
    });
    const event = new SmokeEvent({}, new Smoke(), world, makeNavmesh(), new Point());
    const column = event.expandPart(new Point(10, 20, 30));
    expect(column.height).toBe(351);
    expect(column.radius).toBe(50);
    expect(sounds).toHaveLength(1);
    expect(sounds[0].type).toBe(SoundType.SMOKE_SPAWN);
    expect(sounds[0].extra).toEqual({ id: event.id, height: 351 });
    expect(extinguishCalls).toEqual([column]);
});

test("SmokeEvent maxHeight shrinks with many parts and shrinkPart clears", () => {
    const { world, sounds } = makeVolumetricWorld({ getTickId: () => 0, findFloorSquare: () => null });
    const event = new SmokeEvent({}, new Smoke(), world, makeNavmesh(), new Point());
    event.parts = new Array(12);
    event.expandPart(new Point());
    expect(event.maxHeight).toBe(Math.max(Smoke.MAX_CORNER_HEIGHT, Smoke.MAX_HEIGHT - 1));

    const column = new Column(new Point(), 50, 190);
    event.parts = [column];
    event.shrinkPart(column);
    expect(event.parts).toEqual([]);
    expect(sounds[sounds.length - 1].type).toBe(SoundType.SMOKE_FADE);
    expect(sounds[sounds.length - 1].extra).toEqual({ id: event.id });
});

test("SmokeEvent process lifecycle", () => {
    const { world, sounds } = makeVolumetricWorld({
        getTickId: () => 0,
        findFloorSquare: () => null,
        smokeTryToExtinguishFlames: () => {},
    });
    const event = new SmokeEvent({}, new Smoke(), world, makeNavmesh(), new Point(5, 0, 5));
    let completed = 0;
    event.onComplete.push(() => completed++);
    event.process(1); // initial expand
    expect(event.parts).toHaveLength(1);
    expect(event.parts[0].height).toBe(351);
    event.process(2); // spawn tick count reached, no more candidates
    event.process(900); // maxTicksCount reached -> shrink
    expect(sounds.filter((sound) => sound.type === SoundType.SMOKE_SPAWN)).toHaveLength(1);
    expect(sounds.filter((sound) => sound.type === SoundType.SMOKE_FADE)).toHaveLength(1);
    event.process(901); // parts empty -> complete
    expect(completed).toBe(1);
});
