import { expect, test } from "bun:test";
import { Bullet } from "../../assets/js/server/bullet.js";
import { DropItem } from "../../assets/js/server/drop_item.js";
import {
    EventList,
    GameOverReason,
    ItemId,
    ItemType,
    PauseReason,
    RoundEndReason,
    SoundType,
} from "../../assets/js/server/enums.js";
import { CallbackEvent } from "../../assets/js/server/events/callback_event.js";
import { CrouchEvent } from "../../assets/js/server/events/crouch_event.js";
import { DropEvent } from "../../assets/js/server/events/drop_event.js";
import { EquipEvent } from "../../assets/js/server/events/equip_event.js";
import { Event } from "../../assets/js/server/events/event.js";
import { GameOverEvent } from "../../assets/js/server/events/game_over_event.js";
import { GameStartEvent } from "../../assets/js/server/events/game_start_event.js";
import { JumpEvent } from "../../assets/js/server/events/jump_event.js";
import { KillEvent } from "../../assets/js/server/events/kill_event.js";
import { NoTickEvent } from "../../assets/js/server/events/no_tick_event.js";
import { PauseEndEvent } from "../../assets/js/server/events/pause_end_event.js";
import { PauseStartEvent } from "../../assets/js/server/events/pause_start_event.js";
import { PlantEvent } from "../../assets/js/server/events/plant_event.js";
import { ReloadEvent } from "../../assets/js/server/events/reload_event.js";
import { RoundEndCoolDownEvent } from "../../assets/js/server/events/round_end_cooldown_event.js";
import { RoundEndEvent } from "../../assets/js/server/events/round_end_event.js";
import { RoundStartEvent } from "../../assets/js/server/events/round_start_event.js";
import { SoundEvent } from "../../assets/js/server/events/sound_event.js";
import { TickEvent } from "../../assets/js/server/events/tick_event.js";
import { TimeoutEvent } from "../../assets/js/server/events/timeout_event.js";
import { GameException } from "../../assets/js/server/game_exception.js";
import { GameProperty } from "../../assets/js/server/game_property.js";
import { Point } from "../../assets/js/server/point.js";
import { Sequence } from "../../assets/js/server/sequence.js";
import { crouchDistancePerTick, tickCountCrouch } from "../../assets/js/server/setting.js";
import { setTickRate } from "../../assets/js/server/util.js";

// Events slice tests: base Event lifecycle, event codes vs EventList, and
// serialize() wire structures (PHP server/src/Event/*.php). Physics tests
// (DropEvent ballistics, AttackEvent, volumetric events) live in
// events_physics.test.js; ThrowEvent physics in events_throw.test.js.

function makeFakePlayer(overrides = {}) {
    return {
        getId: () => 1,
        serialize: () => ({ id: 1 }),
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

function makeFakeGame(overrides = {}) {
    return {
        getScore: () => ({ toArray: () => ({ score: [1, 0] }) }),
        getRoundNumber: () => 3,
        ...overrides,
    };
}

function makeFakeSetting(overrides = {}) {
    return {
        warmupWaitSecRemains: 30,
        tickMs: 20,
        playersMax: 9,
        ...overrides,
    };
}

test("Event base lifecycle", () => {
    const event = new Event();
    expect(event.tickCount).toBe(0);
    expect(event.customId).toBe(0);
    expect(event.onComplete).toEqual([]);
    expect(event.serialize()).toEqual({});
    expect(event.timeMsToTick(100)).toBe(5);
    expect(event.timeMsToTick(0)).toBe(0);
    expect(() => event.timeMsToTick(-1)).toThrow(GameException);
    expect(event.getCode()).toBe(0);
    expect(() => event.process(1)).toThrow();

    let called = null;
    event.onComplete.push((completed) => {
        called = completed;
    });
    event.runOnCompleteHooks();
    expect(called).toBe(event);

    event.reset();
    expect(event.tickCount).toBe(0);
    expect(event.onComplete).toEqual([]);
});

test("event codes match EventList", () => {
    const withCode = [
        [new GameOverEvent(GameOverReason.ATTACKERS_SURRENDER), "GameOverEvent"],
        [new PauseStartEvent(makeFakeGame(), PauseReason.FREEZE_TIME, () => {}, 1000), "PauseStartEvent"],
        [new PauseEndEvent(), "PauseEndEvent"],
        [new RoundStartEvent(0, 0, () => {}), "RoundStartEvent"],
        [new RoundEndEvent(makeFakeGame(), true, RoundEndReason.TIME_RUNS_OUT), "RoundEndEvent"],
        [new GameStartEvent(makeFakePlayer(), makeFakeSetting(), new GameProperty()), "GameStartEvent"],
        [new RoundEndCoolDownEvent(() => {}, 1000), "RoundEndCoolDownEvent"],
        [new KillEvent(makeFakePlayer(), makeFakePlayer(), 5, false), "KillEvent"],
        [new SoundEvent(new Point(), SoundType.GRENADE_BOUNCE), "SoundEvent"],
        [new PlantEvent(() => {}, 1000, new Point()), "PlantEvent"],
        [new DropEvent(makeFakePlayer(), makeFakeItem(), {}), "DropEvent"],
    ];
    for (const [instance, name] of withCode) {
        expect(instance.getCode()).toBe(EventList[name]);
        expect(instance.getCode()).toBeGreaterThan(0);
    }
    for (const [name, code] of Object.entries(EventList)) {
        expect(EventList[name]).toBe(code);
    }

    const withoutCode = [
        new Event(),
        new TickEvent(),
        new TimeoutEvent(() => {}, 100),
        new NoTickEvent(),
        new CallbackEvent(() => {}),
        new CrouchEvent(true, () => {}),
        new JumpEvent(),
        new EquipEvent(() => {}, 100),
        new ReloadEvent(() => {}, 100),
    ];
    for (const instance of withoutCode) {
        expect(instance.getCode()).toBe(0);
    }
});

test("TickEvent callback and completion", () => {
    const calls = [];
    const event = new TickEvent((self, tick) => calls.push([self, tick]), 2);
    const hooks = [];
    event.onComplete.push(() => hooks.push(event.tickCount));
    event.process(10);
    event.process(11);
    event.process(12);
    expect(calls).toEqual([
        [event, 10],
        [event, 11],
        [event, 12],
    ]);
    expect(hooks).toEqual([2, 3]);

    const always = new TickEvent(null, 0);
    let alwaysHooks = 0;
    always.onComplete.push(() => alwaysHooks++);
    always.process(1);
    expect(alwaysHooks).toBe(1);
});

test("TimeoutEvent fires after timeout ticks", () => {
    const calls = [];
    const event = new TimeoutEvent((_self, tick) => calls.push(tick), 100);
    expect(event.tickCountTimeout).toBe(5);
    for (let i = 1; i <= 5; i++) {
        event.process(i);
    }
    expect(calls).toEqual([]);
    event.process(6);
    expect(calls).toEqual([6]);

    let hooks = 0;
    const completed = new TimeoutEvent(null, 100);
    completed.onComplete.push(() => hooks++);
    for (let i = 1; i <= 6; i++) {
        completed.process(i);
    }
    expect(hooks).toBe(1);
});

test("TimeoutEvent zero timeout fires immediately", () => {
    const calls = [];
    const event = new TimeoutEvent((_self, tick) => calls.push(tick), 0);
    event.process(1);
    expect(calls).toEqual([1]);
});

test("NoTickEvent process throws", () => {
    const event = new GameOverEvent(GameOverReason.TIE);
    expect(() => event.process(1)).toThrow(GameException);
    const plain = new NoTickEvent();
    expect(() => plain.process(1)).toThrow(GameException);
});

test("CallbackEvent", () => {
    const calls = [];
    const event = new CallbackEvent((self, tick) => calls.push([self, tick]));
    event.process(42);
    expect(calls).toEqual([[event, 42]]);
});

test("CrouchEvent", () => {
    setTickRate(20);
    const event = new CrouchEvent(true, () => {});
    expect(event.directionDown).toBe(true);
    expect(event.moveOffset).toBe(crouchDistancePerTick());
    expect(event.maxTickCount).toBe(tickCountCrouch());
    expect(event).toBeInstanceOf(TickEvent);
    event.process(1);
    expect(event.tickCount).toBe(1);
    event.restartTimer();
    expect(event.tickCount).toBe(0);
    expect(new CrouchEvent(false, () => {}).directionDown).toBe(false);
});

test("JumpEvent", () => {
    const event = new JumpEvent();
    expect(event).toBeInstanceOf(TickEvent);
    expect(event.maxYPosition).toBe(0);
    event.maxYPosition = 5;
    expect(event.maxYPosition).toBe(5);
});

test("KillEvent serialize", () => {
    const dead = { getId: () => 3 };
    const culprit = { getId: () => 5 };
    const event = new KillEvent(dead, culprit, ItemId.RifleAk, true);
    expect(event.getPlayerDead()).toBe(dead);
    expect(event.getPlayerCulprit()).toBe(culprit);
    expect(event.wasHeadShot()).toBe(true);
    expect(event.getAttackItemId()).toBe(ItemId.RifleAk);
    expect(event.serialize()).toEqual({
        playerDead: 3,
        playerCulprit: 5,
        itemId: 5,
        headshot: true,
    });
});

test("GameOverEvent serialize", () => {
    const event = new GameOverEvent(GameOverReason.DEFENDERS_WINS);
    expect(event.serialize()).toEqual({ reason: 3 });
});

test("GameStartEvent serialize", () => {
    const player = makeFakePlayer({ getId: () => 7, serialize: () => ({ id: 7, health: 100 }) });
    const event = new GameStartEvent(player, makeFakeSetting(), new GameProperty());
    expect(event.serialize()).toEqual({
        playerId: 7,
        warmupSec: 30,
        tickMs: 20,
        playersCount: 9,
        setting: {
            start_money: 800,
            randomize_spawn_position: true,
            max_rounds: 24,
            round_time_ms: 115000,
            bomb_explode_time_ms: 40000,
            bomb_plant_time_ms: 3200,
            bomb_defuse_time_ms: 9960,
            half_time_freeze_sec: 15,
            freeze_time_sec: 10,
            buy_time_sec: 20,
            round_end_cool_down_sec: 4,
            backtrack_history_tick_count: 0,
            loss_bonuses: [1400, 1900, 2400, 2900, 3400],
        },
        player: { id: 7, health: 100 },
    });
});

test("PauseStartEvent serialize", () => {
    const game = { getScore: () => ({ toArray: () => ({ score: [4, 2] }) }) };
    const event = new PauseStartEvent(game, PauseReason.TIMEOUT_ATTACKERS, () => {}, 30000);
    expect(event.serialize()).toEqual({ score: { score: [4, 2] }, reason: 2, ms: 30000 });
});

test("PauseEndEvent", () => {
    const event = new PauseEndEvent();
    expect(event).toBeInstanceOf(TickEvent);
    expect(event.getCode()).toBe(EventList.PauseEndEvent);
});

test("PlantEvent serialize", () => {
    const event = new PlantEvent(() => {}, 3200, new Point(100, 200, 300));
    expect(event.serialize()).toEqual({
        timeMs: 3200,
        position: { x: 100, y: 200, z: 300 },
    });
});

test("RoundEndEvent serialize", () => {
    const event = new RoundEndEvent(makeFakeGame(), true, RoundEndReason.ALL_ENEMIES_ELIMINATED);
    expect(event.roundNumberEnded).toBe(3);
    expect(event.serialize()).toEqual({
        roundNumber: 3,
        newRoundNumber: 4,
        attackersWins: true,
        score: { score: [1, 0] },
    });
});

test("RoundStartEvent serialize", () => {
    const event = new RoundStartEvent(2, 1, () => {});
    expect(event.serialize()).toEqual({ attackers: 2, defenders: 1 });
});

test("RoundEndCoolDownEvent, ReloadEvent and EquipEvent", () => {
    expect(new RoundEndCoolDownEvent(() => {}, 1000)).toBeInstanceOf(TimeoutEvent);
    expect(new ReloadEvent(() => {}, 1000)).toBeInstanceOf(TimeoutEvent);
    expect(new EquipEvent(() => {}, 100)).toBeInstanceOf(TimeoutEvent);
});

test("SoundEvent serialize", () => {
    const sound = new SoundEvent(new Point(1, 2, 3), SoundType.PLAYER_STEP);
    expect(sound.serialize()).toEqual({
        position: { x: 1, y: 2, z: 3 },
        item: null,
        player: null,
        type: 1,
        extra: {},
    });
    expect(sound.getItem()).toBe(null);
    expect(sound.getPlayerId()).toBe(null);

    const item = { toArray: () => ({ id: 35, slot: 5 }) };
    const player = { getId: () => 7 };
    const result = sound.setItem(item).setPlayer(player).addExtra("origin", "x").addExtra("damage", 20);
    expect(result).toBe(sound);
    expect(sound.getItem()).toBe(item);
    expect(sound.getPlayerId()).toBe(7);
    expect(sound.serialize()).toEqual({
        position: { x: 1, y: 2, z: 3 },
        item: { id: 35, slot: 5 },
        player: 7,
        type: 1,
        extra: { origin: "x", damage: 20 },
    });
});

test("GameProperty defaults and toArray", () => {
    const gp = new GameProperty();
    expect(gp.start_money).toBe(800);
    expect(gp.randomize_spawn_position).toBe(true);
    expect(gp.max_rounds).toBe(24);
    expect(gp.round_time_ms).toBe(115000);
    expect(gp.bomb_explode_time_ms).toBe(40000);
    expect(gp.bomb_plant_time_ms).toBe(3200);
    expect(gp.bomb_defuse_time_ms).toBe(9960);
    expect(gp.half_time_freeze_sec).toBe(15);
    expect(gp.freeze_time_sec).toBe(10);
    expect(gp.buy_time_sec).toBe(20);
    expect(gp.round_end_cool_down_sec).toBe(4);
    expect(gp.backtrack_history_tick_count).toBe(0);
    expect(gp.loss_bonuses).toEqual([1400, 1900, 2400, 2900, 3400]);
    expect(gp.toArray()).toEqual({
        start_money: 800,
        randomize_spawn_position: true,
        max_rounds: 24,
        round_time_ms: 115000,
        bomb_explode_time_ms: 40000,
        bomb_plant_time_ms: 3200,
        bomb_defuse_time_ms: 9960,
        half_time_freeze_sec: 15,
        freeze_time_sec: 10,
        buy_time_sec: 20,
        round_end_cool_down_sec: 4,
        backtrack_history_tick_count: 0,
        loss_bonuses: [1400, 1900, 2400, 2900, 3400],
    });
    expect(gp).toBeInstanceOf(GameProperty);
});

test("GameProperty fromArray and invalid fields", () => {
    const gp = GameProperty.fromArray({ start_money: 100, max_rounds: 5 });
    expect(gp.start_money).toBe(100);
    expect(gp.max_rounds).toBe(5);
    expect(gp.round_time_ms).toBe(115000);
    expect(() => GameProperty.fromArray({ invalid_field: 1 })).toThrow(GameException);
    expect(() => GameProperty.fromArray({ invalid_field: 1 })).toThrow("Invalid field 'invalid_field' given");
    const guarded = GameProperty.create();
    expect(() => guarded.invalid_field).toThrow(GameException);
    expect(() => {
        guarded.invalid_field = 1;
    }).toThrow(GameException);
    expect(guarded).toBeInstanceOf(GameProperty);
});

test("Sequence increments", () => {
    const first = Sequence.next();
    const second = Sequence.next();
    expect(first).toMatch(/^id-\d+$/);
    expect(second).toBe(`id-${Number(first.slice(3)) + 1}`);
});

test("Bullet mechanics", () => {
    const item = {};
    const bullet = new Bullet(item, 100);
    expect(bullet.isActive()).toBe(true);
    bullet.setProperties(25);
    expect(bullet.getDamage()).toBe(25);
    bullet.lowerDamage(10);
    expect(bullet.getDamage()).toBe(15);
    expect(bullet.getShootItem()).toBe(item);
    bullet.setOriginPlayer(3, false, new Point(1, 2, 3));
    expect(bullet.getOriginPlayerId()).toBe(3);
    expect(bullet.isOriginPlayerAttackerSide()).toBe(false);
    expect(bullet.getOrigin().equals(new Point(1, 2, 3))).toBe(true);
    expect(bullet.getPlayerSkipIds()).toEqual({ 3: true });
    expect(bullet.getDistanceTraveled()).toBe(1);
    expect(bullet.incrementDistance()).toBe(2);
    bullet.move(new Point(4, 5, 6));
    expect(bullet.getPosition().equals(new Point(4, 5, 6))).toBe(true);
    bullet.lowerDamage(100);
    expect(bullet.isActive()).toBe(false);
    expect(() => bullet.lowerDamage(-1)).toThrow();
});

test("DropItem bounding radius by item type", () => {
    const position = new Point();
    const primary = new DropItem("id-1", { getType: () => ItemType.TYPE_WEAPON_PRIMARY }, position);
    expect(primary.getBoundingRadius()).toBe(30);
    expect(primary.getHeight()).toBe(6);
    expect(primary.getId()).toBe("id-1");
    expect(primary.getItem().getType()).toBe(ItemType.TYPE_WEAPON_PRIMARY);
    expect(primary.getPosition()).toBe(position);
    const secondary = new DropItem("id-2", { getType: () => ItemType.TYPE_WEAPON_SECONDARY }, position);
    expect(secondary.getBoundingRadius()).toBe(20);
    const grenade = new DropItem("id-3", { getType: () => ItemType.TYPE_GRENADE }, position);
    expect(grenade.getBoundingRadius()).toBe(10);
});

test("DropEvent constructor and serialize", () => {
    const player = makeFakePlayer();
    const item = makeFakeItem();
    const event = new DropEvent(player, item, {});
    expect(event.id).toMatch(/^id-\d+$/);
    expect(event.serialize()).toEqual({ id: event.id, item: { id: 5, slot: 1 } });
    expect(event.dropItem).toBeInstanceOf(DropItem);
    expect(event.dropItem.getBoundingRadius()).toBe(30);
    expect(event.velocity).toBe(20);
    expect(event.timeIncrement).toBe(1 / 5);
});

test("DropEvent constructor velocity states", () => {
    const moving = new DropEvent(makeFakePlayer({ isMoving: () => true }), makeFakeItem(), {});
    expect(moving.velocity).toBe(30);
    const jumping = new DropEvent(makeFakePlayer({ isJumping: () => true }), makeFakeItem(), {});
    expect(jumping.velocity).toBe(30);
    const dead = new DropEvent(makeFakePlayer({ isAlive: () => false }), makeFakeItem(), {});
    expect(dead.velocity).toBe(7);
    expect(dead.timeIncrement).toBe(7);
    const secondary = new DropEvent(
        makeFakePlayer(),
        makeFakeItem({ getType: () => ItemType.TYPE_WEAPON_SECONDARY }),
        {},
    );
    expect(secondary.dropItem.getBoundingRadius()).toBe(20);
});
