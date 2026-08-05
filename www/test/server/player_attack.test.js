import { afterAll, beforeAll, expect, test } from "bun:test";
import { BuyMenuItem, SoundType } from "../../assets/js/server/enums.js";
import { HighExplosive } from "../../assets/js/server/equipment/high_explosive.js";
import { ThrowEvent } from "../../assets/js/server/events/throw_event.js";
import { Point } from "../../assets/js/server/point.js";
import { movementXYZ } from "../../assets/js/server/util.js";
import { PistolGlock } from "../../assets/js/server/weapon/pistol_glock.js";
import {
    createPlayer,
    createTicker,
    loadTestSettings,
    restoreDefaultSettings,
    standOnGround,
} from "./player_test_utils.js";

beforeAll(() => {
    loadTestSettings();
});

afterAll(() => {
    restoreDefaultSettings();
});

/** Player stands on the ground looking at 180 with the starting glock equipped (PistolGlock(true)). */
function createShooter() {
    const { player, world } = createPlayer(1, true);
    standOnGround(player, world);
    player.getSight().look(180, 0);
    return { player, world };
}

function hasSound(world, type) {
    return world.sounds.some((event) => event.type === type);
}

test("player attack fires bullet and decrements ammo", () => {
    const { player, world } = createShooter();
    world.tickId = 1;
    const result = player.attack();
    expect(result).not.toBeNull();
    expect(player.getEquippedItem()).toBeInstanceOf(PistolGlock);
    expect(player.getEquippedItem().getAmmo()).toBe(11);
    const origin = new Point(0, 180, 0);
    const expected = origin.clone().addPart(...movementXYZ(180, 0, 20123));
    expect(result.getBullet().getPosition().toArray()).toEqual(expected.toArray());
    expect(hasSound(world, SoundType.ITEM_ATTACK)).toBe(true);
});

test("player attack twice in same tick is blocked", () => {
    const { player, world } = createShooter();
    world.tickId = 1;
    expect(player.attack()).not.toBeNull();
    expect(player.attack()).toBeNull(); // isAttacking guard
});

test("player attack is rate limited by weapon fire rate", () => {
    const { player, world } = createShooter();
    world.tickId = 1;
    expect(player.attack()).not.toBeNull();
    player.onTick(2); // resetTickStates
    world.tickId = 10;
    expect(player.attack()).toBeNull(); // 1 + 15 fire rate ticks > 10
    player.onTick(11);
    world.tickId = 16;
    expect(player.attack()).not.toBeNull();
});

test("player attack empty magazine triggers reload", () => {
    const { player, world } = createShooter();
    let tickId = 1;
    for (let i = 0; i < 12; i++) {
        world.tickId = tickId;
        expect(player.attack()).not.toBeNull();
        for (let k = 0; k < 15; k++) {
            player.onTick(tickId++);
        }
    }
    expect(player.getEquippedItem().getAmmo()).toBe(0);
    world.tickId = tickId;
    expect(player.attack()).toBeNull(); // no ammo -> auto reload
    expect(hasSound(world, SoundType.ATTACK_NO_AMMO)).toBe(true);
    expect(hasSound(world, SoundType.ITEM_RELOAD)).toBe(true);
    expect(player.getEquippedItem().isReloading()).toBe(true);
    expect(player.events[0]).toBeDefined();
    // reloadTimeMs 2300 @ 10ms = 230 ticks (fires on the 231st process)
    for (let i = 0; i < 231; i++) {
        player.onTick(tickId++);
    }
    expect(player.getEquippedItem().getAmmo()).toBe(12);
    expect(player.getEquippedItem().getAmmoReserve()).toBe(108);
    expect(player.getEquippedItem().isReloading()).toBe(false);
});

test("player standing attack has no movement recoil", () => {
    const { player, world } = createShooter();
    world.tickId = 1;
    const result = player.attack();
    const origin = new Point(0, 180, 0);
    const expected = origin.clone().addPart(...movementXYZ(180, 0, 20123));
    expect(result.getBullet().getPosition().toArray()).toEqual(expected.toArray());
});

test("player flying attack applies recoil offsets (deterministic random)", () => {
    const { player, world } = createShooter();
    const originalRandom = Math.random;
    Math.random = () => 0.5;
    try {
        player.setPosition(new Point(100, 200, 100));
        expect(player.isFlying()).toBe(true);
        world.tickId = 1;
        const result = player.attack();
        const origin = new Point(100, 380, 100);
        // glock offsets: rand(10,11)=11, rand(6,12)=9, signs both -1
        const expected = origin.clone().addPart(...movementXYZ(169, -9, 20123));
        expect(result.getBullet().getPosition().toArray()).toEqual(expected.toArray());
    } finally {
        Math.random = originalRandom;
    }
});

test("player running attack applies recoil offsets (deterministic random)", () => {
    const { player, world } = createShooter();
    const originalRandom = Math.random;
    Math.random = () => 0.5;
    try {
        player.moveRight();
        world.tickId = 1;
        const result = player.attack();
        const origin = new Point(0, 180, 0);
        // glock running offsets: rand(3,7)=5, rand(4,6)=5, signs both -1
        const expected = origin.clone().addPart(...movementXYZ(175, -5, 20123));
        expect(result.getBullet().getPosition().toArray()).toEqual(expected.toArray());
    } finally {
        Math.random = originalRandom;
    }
});

test("player primary weapon flying attack recoil (deterministic random)", () => {
    const { player, world } = createShooter();
    player.getInventory().earnMoney(16000);
    expect(player.buyItem(BuyMenuItem.RIFLE_AK)).toBe(true);
    const ticker = createTicker(player);
    for (let i = 0; i < 85; i++) {
        ticker.tick(); // equipReadyTimeMs 800 @ 10ms (fires on 81st process)
    }
    const originalRandom = Math.random;
    Math.random = () => 0.5;
    try {
        player.setPosition(new Point(100, 200, 100));
        world.tickId = 100;
        const result = player.attack();
        expect(result).not.toBeNull();
        const origin = new Point(100, 380, 100);
        // AK offsets: rand(15,25)=20, rand(8,16)=12, signs both -1
        const expected = origin.clone().addPart(...movementXYZ(160, -12, 20123));
        expect(result.getBullet().getPosition().toArray()).toEqual(expected.toArray());
    } finally {
        Math.random = originalRandom;
    }
});

test("player knife secondary attack", () => {
    const { player, world } = createShooter();
    player.equipKnife();
    const ticker = createTicker(player);
    for (let i = 0; i < 55; i++) {
        ticker.tick(); // equipReadyTimeMs 500 @ 10ms (fires on 51st process)
    }
    world.tickId = 60;
    const result = player.attackSecondary();
    expect(result).not.toBeNull();
    const origin = new Point(0, 180, 0);
    const expected = origin.clone().addPart(...movementXYZ(180, 0, 140));
    expect(result.getBullet().getPosition().toArray()).toEqual(expected.toArray());
    expect(hasSound(world, SoundType.ITEM_ATTACK2)).toBe(true);
});

test("player grenade throw", () => {
    const { player, world } = createShooter();
    player.getInventory().earnMoney(16000);
    expect(player.buyItem(BuyMenuItem.GRENADE_HE)).toBe(true);
    const ticker = createTicker(player);
    for (let i = 0; i < 12; i++) {
        ticker.tick(); // equipReadyTimeMs 100 @ 10ms (fires on 11th process)
    }
    world.tickId = 20;
    const result = player.attack();
    expect(result).not.toBeNull();
    expect(world.thrownEvents).toHaveLength(1);
    const thrown = world.thrownEvents[0];
    expect(thrown).toBeInstanceOf(ThrowEvent);
    expect(thrown.item).toBeInstanceOf(HighExplosive);
    expect(thrown.velocity).toBe(20); // throwSpeed setting, not moving
    expect(player.getEquippedItem().getSlot()).toBe(2); // back to secondary
    expect(player.getInventory().has(8)).toBe(false); // grenade consumed
});

test("player grenade throw moving speed bonus", () => {
    const { player, world } = createShooter();
    player.getInventory().earnMoney(16000);
    player.buyItem(BuyMenuItem.GRENADE_HE);
    const ticker = createTicker(player);
    for (let i = 0; i < 12; i++) {
        ticker.tick();
    }
    player.moveRight();
    world.tickId = 30;
    player.attack();
    expect(world.thrownEvents[0].velocity).toBe(Math.ceil(20 * 1.2));
});

test("player attack with knife is blocked by equip delay", () => {
    const { player, world } = createShooter();
    player.equipKnife();
    world.tickId = 1;
    // knife not equipped yet -> canAttack false
    expect(player.attack()).toBeNull();
    const ticker = createTicker(player);
    for (let i = 0; i < 55; i++) {
        ticker.tick();
    }
    world.tickId = 60;
    expect(player.attack()).not.toBeNull();
});

test("player attack award money on hit", () => {
    const { player, world } = createShooter();
    const fakeHit = {
        getMoneyAward() {
            return 300;
        },
        getPlayer() {
            return player;
        },
        getHitAntiForce() {
            return 110; // stops the bullet (glock damage 110)
        },
        wasHeadShot() {
            return false;
        },
    };
    world.calculateHits = () => [fakeHit];
    world.tickId = 1;
    const result = player.attack();
    expect(result.somePlayersWasHit()).toBe(true);
    expect(result.getMoneyAward()).toBe(300);
    expect(player.getMoney()).toBe(300);
});
