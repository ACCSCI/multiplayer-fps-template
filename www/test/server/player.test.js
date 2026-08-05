import { afterAll, beforeAll, expect, test } from "bun:test";
import { DynamicFloor } from "../../assets/js/server/dynamic_floor.js";
import { ArmorType, BuyMenuItem } from "../../assets/js/server/enums.js";
import { TimeoutEvent } from "../../assets/js/server/events/timeout_event.js";
import { Inventory } from "../../assets/js/server/inventory.js";
import { Player } from "../../assets/js/server/player.js";
import { Point } from "../../assets/js/server/point.js";
import { playerBoundingRadius, playerHeadHeightStand } from "../../assets/js/server/setting.js";
import { PistolGlock } from "../../assets/js/server/weapon/pistol_glock.js";
import { PistolUsp } from "../../assets/js/server/weapon/pistol_usp.js";
import { createPlayer, loadTestSettings, restoreDefaultSettings, standOnGround } from "./player_test_utils.js";

beforeAll(() => {
    loadTestSettings();
});

afterAll(() => {
    restoreDefaultSettings();
});

test("player construction", () => {
    const { player } = createPlayer(7, true);
    expect(player.getId()).toBe(7);
    expect(player.isPlayingOnAttackerSide()).toBe(true);
    expect(player.getHealth()).toBe(100);
    expect(player.isAlive()).toBe(true);
    expect(player.getHeadHeight()).toBe(playerHeadHeightStand());
    expect(player.getBoundingRadius()).toBe(playerBoundingRadius());
    expect(player.getPositionClone().toArray()).toEqual({ x: 0, y: 0, z: 0 });
    expect(player.getSightHeight()).toBe(playerHeadHeightStand() - 10);
    expect(player.getSight().toArray()).toEqual({ horizontal: 0, vertical: 0 });
    expect(player.hasDefuseKit()).toBe(false);
    expect(player.isWalking()).toBe(false);
    expect(player.isRunning()).toBe(true);
    expect(player.isMoving()).toBe(false);
});

test("player serialize structure (network snapshot protocol)", () => {
    const { player, world } = createPlayer(1, true);
    expect(player.serialize()).toEqual({
        id: 1,
        color: 1,
        money: 0,
        item: { id: 2, slot: 2 },
        canAttack: true,
        canBuy: true,
        canPlant: false,
        slots: {
            0: { id: 1, slot: 0 },
            2: { id: 2, slot: 2 },
        },
        health: 100,
        position: { x: 0, y: 0, z: 0 },
        look: { horizontal: 0, vertical: 0 },
        isAttacker: true,
        sight: 180,
        armor: 0,
        armorType: 0,
        ammo: 12,
        ammoReserve: 120,
        isReloading: false,
        scopeLevel: 0,
    });
    expect(world).toBeDefined();
});

test("player serialize defender side (usp)", () => {
    const { player } = createPlayer(2, false);
    const data = player.serialize();
    expect(data.item).toEqual({ id: 4, slot: 2 });
    expect(data.ammo).toBe(12);
    expect(data.ammoReserve).toBe(24);
    expect(data.isAttacker).toBe(false);
});

test("player serialize reflects health and shot slowdown", () => {
    const { player } = createPlayer(1, true);
    player.lowerHealth(25);
    expect(player.serialize().health).toBe(75);
    expect(player.events[3]).toBeInstanceOf(TimeoutEvent);
});

test("player serialize with armor", () => {
    const { player } = createPlayer(1, true);
    player.getInventory().earnMoney(16000);
    player.getInventory().purchase(player, BuyMenuItem.KEVLAR_BODY);
    expect(player.getArmorValue()).toBe(100);
    expect(player.getArmorType()).toBe(ArmorType.BODY);
    const data = player.serialize();
    expect(data.armor).toBe(100);
    expect(data.armorType).toBe(1);
    expect(data.money).toBe(15350);
    expect(data.slots[10]).toEqual({ id: 34, slot: 10 });
});

test("player lowerHealth and death drops items", () => {
    const { player, world } = createPlayer(1, true);
    player.lowerHealth(30);
    expect(player.getHealth()).toBe(70);
    player.lowerHealth(100);
    expect(player.getHealth()).toBe(0);
    expect(player.isAlive()).toBe(false);
    expect(world.droppedItems).toHaveLength(1);
    expect(world.droppedItems[0]).toBeInstanceOf(PistolGlock);
    expect(player.getSight().getRotationVertical()).toBe(-64);
});

test("player lowerHealth negative throws", () => {
    const { player } = createPlayer(1, true);
    expect(() => player.lowerHealth(-1)).toThrow();
});

test("player lowerArmor", () => {
    const { player } = createPlayer(1, true);
    player.lowerArmor(10); // no armor yet - no-op
    expect(player.getArmorValue()).toBe(0);
    player.getInventory().earnMoney(16000);
    player.getInventory().purchase(player, BuyMenuItem.KEVLAR_BODY);
    player.lowerArmor(30);
    expect(player.getArmorValue()).toBe(70);
    player.lowerArmor(100);
    expect(player.getArmorValue()).toBe(0);
    expect(player.getArmorType()).toBe(ArmorType.NONE);
});

test("player money", () => {
    const { player } = createPlayer(1, true);
    expect(player.getMoney()).toBe(0);
    player.getInventory().earnMoney(500);
    expect(player.getMoney()).toBe(500);
    player.getInventory().earnMoney(-1000);
    expect(player.getMoney()).toBe(0);
    player.getInventory().earnMoney(20000);
    expect(player.getMoney()).toBe(16000);
});

test("player inventory and equip", () => {
    const { player } = createPlayer(1, true);
    expect(player.getInventory()).toBeInstanceOf(Inventory);
    expect(player.getEquippedItem()).toBeInstanceOf(PistolGlock);
    expect(player.equip(10)).toBe(false); // SLOT_KEVLAR
    expect(player.equip(11)).toBe(false); // SLOT_KIT
    expect(player.equipKnife()).toBeUndefined();
    expect(player.getEquippedItem().getSlot()).toBe(0);
});

test("player equipKeepsTrackOfSecondaryWeapon", () => {
    const { player } = createPlayer(1, true);
    player.equipSecondaryWeapon();
    expect(player.getEquippedItem()).toBeInstanceOf(PistolGlock);
});

test("player roundReset restores health", () => {
    const { player } = createPlayer(1, true);
    player.lowerHealth(40);
    expect(player.getHealth()).toBe(60);
    player.roundReset();
    expect(player.getHealth()).toBe(100);
    expect(player.isAlive()).toBe(true);
});

test("player roundReset after death respawns loadout", () => {
    const { player, world } = createPlayer(1, true);
    player.lowerHealth(100);
    expect(world.droppedItems).toHaveLength(1);
    player.roundReset();
    expect(player.getHealth()).toBe(100);
    expect(player.getEquippedItem()).toBeInstanceOf(PistolGlock);
});

test("player swapTeam", () => {
    const { player } = createPlayer(1, true);
    expect(player.isPlayingOnAttackerSide()).toBe(true);
    player.swapTeam();
    expect(player.isPlayingOnAttackerSide()).toBe(false);
});

test("player suicide", () => {
    const { player, world } = createPlayer(1, true);
    player.suicide();
    expect(player.isAlive()).toBe(false);
    expect(world.deadByFallDamage).toBe(player);
    expect(world.droppedItems).toHaveLength(1);
});

test("player use", () => {
    const { player, world } = createPlayer(1, true);
    player.use();
    expect(world.usedPlayer).toBe(player);
});

test("player isPlantingOrDefusing", () => {
    const { player } = createPlayer(1, true);
    expect(player.isPlantingOrDefusing()).toBe(false);
});

test("player toArray and fromArray", () => {
    const { player } = createPlayer(5, false);
    expect(player.toArray()).toEqual({ id: 5, color: 1, isAttacker: false });
    const restored = Player.fromArray(player.toArray());
    expect(restored.getId()).toBe(5);
    expect(restored.isPlayingOnAttackerSide()).toBe(false);
    expect(restored.getHealth()).toBe(100);
});

test("player getPlayerGrenadeHitPoints", () => {
    const { player } = createPlayer(1, true);
    const points = player.getPlayerGrenadeHitPoints();
    expect(points).toHaveLength(5);
    const ys = points.map((p) => p.y);
    expect(ys).toEqual([4, 49, 94, 139, 184]);
    for (const p of points) {
        expect([p.x, p.z]).toEqual([0, 0]);
    }
});

test("player head floor and boost floor", () => {
    const { player } = createPlayer(1, true);
    expect(player.getHeadFloor()).toBeInstanceOf(DynamicFloor);
    expect(player.getBoostFloor()).toBeNull();
    const { player: other } = createPlayer(2, true);
    expect(other.getBoostFloor()).toBeNull();
});

test("player setPosition snaps to floor", () => {
    const { player, world } = createPlayer(1, true);
    standOnGround(player, world);
    player.setPosition(new Point(100, 0, 100));
    expect(player.getPositionClone().toArray()).toEqual({ x: 100, y: 0, z: 100 });
    expect(player.isFlying()).toBe(false);
});

test("player defender has usp in loadout", () => {
    const { player } = createPlayer(3, false);
    expect(player.getEquippedItem()).toBeInstanceOf(PistolUsp);
});
