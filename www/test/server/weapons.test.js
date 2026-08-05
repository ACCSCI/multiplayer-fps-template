import { expect, test } from "bun:test";
import { Bullet } from "../../assets/js/server/bullet.js";
import { ArmorType, HitBoxType, InventorySlot, ItemType } from "../../assets/js/server/enums.js";
import { setTickRate } from "../../assets/js/server/util.js";
import { BaseWeapon } from "../../assets/js/server/weapon/base_weapon.js";
import { Knife } from "../../assets/js/server/weapon/knife.js";
import { PistolGlock } from "../../assets/js/server/weapon/pistol_glock.js";
import { PistolP250 } from "../../assets/js/server/weapon/pistol_p250.js";
import { PistolUsp } from "../../assets/js/server/weapon/pistol_usp.js";
import { RifleAk } from "../../assets/js/server/weapon/rifle_ak.js";
import { RifleAWP } from "../../assets/js/server/weapon/rifle_awp.js";
import { RifleM4A4 } from "../../assets/js/server/weapon/rifle_m4a4.js";

// Behavior tests for the Weapon layer (server/src/Weapon/*.php).
// tick rate 20 matches the PHP test suite default.

setTickRate(20);

/** PHP Attackable mock: fire(), applyRecoil(), getTickId(). */
function createAttackable(state) {
    return {
        getTickId() {
            return state.tick;
        },
        applyRecoil(offsetHorizontal, offsetVertical) {
            state.recoils.push([offsetHorizontal, offsetVertical]);
        },
        fire() {
            state.fireCount++;
            return "result";
        },
    };
}

/** TimeoutEvent fires on the (timeoutTicks + 1)th process() call (tickCount starts at 0). */
function processTimeout(event, timeoutMs) {
    const calls = Math.ceil(timeoutMs / 20) + 1;
    for (let tick = 0; tick < calls; tick++) {
        event.process(tick);
    }
}

const weaponParams = [
    [
        PistolGlock,
        {
            reloadTimeMs: 2300,
            equipReadyTimeMs: 400,
            magazineCapacity: 12,
            reserveAmmo: 120,
            killAward: 300,
            fireRateMs: 150,
            damage: 110,
            rangeMaxDamage: 8123,
            recoilResetMs: 300,
            price: 200,
        },
    ],
    [
        PistolP250,
        {
            reloadTimeMs: 2200,
            equipReadyTimeMs: 400,
            magazineCapacity: 13,
            reserveAmmo: 26,
            killAward: 300,
            fireRateMs: 150,
            damage: 130,
            rangeMaxDamage: 13123,
            recoilResetMs: 400,
            price: 300,
        },
    ],
    [
        PistolUsp,
        {
            reloadTimeMs: 2200,
            equipReadyTimeMs: 400,
            magazineCapacity: 12,
            reserveAmmo: 24,
            killAward: 300,
            fireRateMs: 170,
            damage: 116,
            rangeMaxDamage: 11123,
            recoilResetMs: 300,
            price: 200,
        },
    ],
    [
        RifleAk,
        {
            reloadTimeMs: 2400,
            equipReadyTimeMs: 800,
            magazineCapacity: 30,
            reserveAmmo: 90,
            killAward: 300,
            runningSpeed: 215,
            fireRateMs: 100,
            damage: 190,
            armorPenetration: 77,
            recoilResetMs: 330,
            price: 2700,
        },
    ],
    [
        RifleM4A4,
        {
            reloadTimeMs: 3100,
            equipReadyTimeMs: 800,
            magazineCapacity: 30,
            reserveAmmo: 90,
            killAward: 300,
            runningSpeed: 215,
            fireRateMs: 90,
            damage: 170,
            armorPenetration: 67,
            recoilResetMs: 310,
            price: 3100,
        },
    ],
    [
        RifleAWP,
        {
            reloadTimeMs: 3700,
            equipReadyTimeMs: 1100,
            magazineCapacity: 5,
            reserveAmmo: 30,
            killAward: 100,
            fireRateMs: 1463,
            damage: 350,
            armorPenetration: 90,
            price: 4750,
        },
    ],
];

for (const [weaponClass, values] of weaponParams) {
    test(`${weaponClass.name} parameters`, () => {
        for (const [key, value] of Object.entries(values)) {
            if (key === "price") {
                // PHP protected int $price is an instance property, not a class constant
                expect(new weaponClass().getPrice()).toBe(value);
                continue;
            }
            expect(weaponClass[key]).toBe(value);
        }

        const weapon = new weaponClass();
        expect(weapon.getAmmo()).toBe(weaponClass.magazineCapacity);
        expect(weapon.getAmmoReserve()).toBe(weaponClass.reserveAmmo);
        expect(weapon.isReloading()).toBe(false);
        expect(weapon.getKillAward()).toBe(weaponClass.killAward);
        if (weaponClass !== RifleAWP) {
            expect(weapon.getSpreadOffsets()).toEqual([0.0, 0.0]);
        }
        expect(weapon.attackSecondary(createAttackable({ tick: 0, recoils: [], fireCount: 0 }))).toBeNull();
    });
}

test("base weapon defaults", () => {
    expect(BaseWeapon.magazineCapacity).toBe(0);
    expect(BaseWeapon.reserveAmmo).toBe(0);
    expect(BaseWeapon.killAward).toBe(0);
    expect(BaseWeapon.runningSpeed).toBe(0);
    expect(BaseWeapon.reloadTimeMs).toBe(0);
    expect(BaseWeapon.fireRateMs).toBe(0);
    expect(BaseWeapon.recoilResetMs).toBe(0);
    expect(BaseWeapon.damage).toBe(0);
    expect(BaseWeapon.armorPenetration).toBe(0);
    expect(BaseWeapon.range).toBe(20123);
    expect(BaseWeapon.rangeMaxDamage).toBe(20123);
    expect(BaseWeapon.recoilPattern).toEqual([]);
    expect(RifleAk.range).toBe(20123); // inherited
    expect(RifleAWP.range).toBe(20123);
    expect(RifleAWP.recoilPattern).toEqual([]);
    expect(RifleAWP.recoilResetMs).toBe(0);
});

test("weapon type and slot", () => {
    expect(new PistolGlock().getType()).toBe(ItemType.TYPE_WEAPON_SECONDARY);
    expect(new PistolGlock().getSlot()).toBe(InventorySlot.SLOT_SECONDARY);
    expect(new PistolP250().getSlot()).toBe(InventorySlot.SLOT_SECONDARY);
    expect(new PistolUsp().getSlot()).toBe(InventorySlot.SLOT_SECONDARY);
    expect(new RifleAk().getType()).toBe(ItemType.TYPE_WEAPON_PRIMARY);
    expect(new RifleAk().getSlot()).toBe(InventorySlot.SLOT_PRIMARY);
    expect(new RifleM4A4().getSlot()).toBe(InventorySlot.SLOT_PRIMARY);
    expect(new RifleAWP().getSlot()).toBe(InventorySlot.SLOT_PRIMARY);
});

test("weapon toArray slots", () => {
    expect(new RifleAk().toArray()).toEqual({ id: 5, slot: InventorySlot.SLOT_PRIMARY });
    expect(new PistolGlock().toArray()).toEqual({ id: 2, slot: InventorySlot.SLOT_SECONDARY });
    expect(new RifleAWP().toArray()).toEqual({ id: 7, slot: InventorySlot.SLOT_PRIMARY });
});

test("weapon damage values", () => {
    // [noArmor, withArmor] per hitbox (body hits check BODY armor, head checks BODY_AND_HEAD)
    const damages = {
        PistolGlock: { head: [119, 56], chest: [29, 14], back: [29, 14], stomach: [37, 17], leg: [22, 22] },
        PistolP250: { head: [151, 96], chest: [37, 24], back: [37, 24], stomach: [47, 30], leg: [28, 28] },
        PistolUsp: { head: [140, 70], chest: [34, 17], back: [34, 17], stomach: [43, 22], leg: [26, 26] },
        RifleAk: { head: [143, 111], chest: [35, 27], back: [35, 27], stomach: [44, 34], leg: [26, 26] },
        RifleM4A4: { head: [131, 92], chest: [32, 23], back: [32, 23], stomach: [41, 28], leg: [24, 24] },
        RifleAWP: { head: [459, 448], chest: [115, 112], back: [115, 112], stomach: [143, 140], leg: [85, 85] },
    };
    const classes = { PistolGlock, PistolP250, PistolUsp, RifleAk, RifleM4A4, RifleAWP };
    for (const [name, values] of Object.entries(damages)) {
        const weapon = new classes[name]();
        expect(weapon.getDamageValue(HitBoxType.HEAD, ArmorType.NONE)).toBe(values.head[0]);
        expect(weapon.getDamageValue(HitBoxType.HEAD, ArmorType.BODY_AND_HEAD)).toBe(values.head[1]);
        expect(weapon.getDamageValue(HitBoxType.CHEST, ArmorType.NONE)).toBe(values.chest[0]);
        expect(weapon.getDamageValue(HitBoxType.CHEST, ArmorType.BODY)).toBe(values.chest[1]);
        expect(weapon.getDamageValue(HitBoxType.BACK, ArmorType.NONE)).toBe(values.back[0]);
        expect(weapon.getDamageValue(HitBoxType.BACK, ArmorType.BODY)).toBe(values.back[1]);
        expect(weapon.getDamageValue(HitBoxType.STOMACH, ArmorType.NONE)).toBe(values.stomach[0]);
        expect(weapon.getDamageValue(HitBoxType.STOMACH, ArmorType.BODY)).toBe(values.stomach[1]);
        expect(weapon.getDamageValue(HitBoxType.LEG, ArmorType.NONE)).toBe(values.leg[0]);
    }
});

test("ammo based weapon attack and fire rate ticks", () => {
    const ak = new RifleAk(true);
    const state = { tick: 1, recoils: [], fireCount: 0 };
    const attackable = createAttackable(state);

    expect(ak.canAttack(1)).toBe(true);
    expect(ak.attack(attackable)).toBe("result");
    expect(ak.getAmmo()).toBe(RifleAk.magazineCapacity - 1);
    expect(ak.getAmmoReserve()).toBe(RifleAk.reserveAmmo);

    expect(ak.canAttack(1)).toBe(false); // fireRateMs 100 -> 5 ticks
    state.tick = 5;
    expect(ak.canAttack(5)).toBe(false); // 1 + 5 <= 5 is false
    state.tick = 6;
    expect(ak.canAttack(6)).toBe(true);
    expect(ak.attack(attackable)).toBe("result");
    expect(ak.getAmmo()).toBe(RifleAk.magazineCapacity - 2);

    expect(state.fireCount).toBe(2);
    expect(state.recoils).toEqual([
        [0, 0],
        [0, 0],
        [0.1, 0.19],
        [0, 0],
    ]);
});

test("ammo based weapon cannot attack while reloading", () => {
    const ak = new RifleAk(true);
    const state = { tick: 1, recoils: [], fireCount: 0 };
    const attackable = createAttackable(state);
    ak.attack(attackable);

    const event = ak.reload();
    expect(event).not.toBeNull();
    expect(ak.isReloading()).toBe(true);
    state.tick = 100;
    expect(ak.canAttack(100)).toBe(false);
    expect(ak.reload()).toBeNull(); // cannot reload while reloading

    processTimeout(event, RifleAk.reloadTimeMs);
    expect(ak.isReloading()).toBe(false);
    expect(ak.canAttack(100)).toBe(true);
    expect(ak.getAmmo()).toBe(RifleAk.magazineCapacity);
    expect(ak.getAmmoReserve()).toBe(RifleAk.reserveAmmo - 1);
});

test("reload refills magazine from reserve", () => {
    const glock = new PistolGlock(true);
    const state = { tick: 1, recoils: [], fireCount: 0 };
    const attackable = createAttackable(state);
    for (let i = 0; i < 3; i++) {
        glock.attack(attackable);
    }
    expect(glock.getAmmo()).toBe(9);

    processTimeout(glock.reload(), PistolGlock.reloadTimeMs);
    expect(glock.getAmmo()).toBe(PistolGlock.magazineCapacity);
    expect(glock.getAmmoReserve()).toBe(PistolGlock.reserveAmmo - 3);
});

test("reload with insufficient reserve", () => {
    const p250 = new PistolP250(true);
    const state = { tick: 1, recoils: [], fireCount: 0 };
    const attackable = createAttackable(state);

    for (let i = 0; i < 13; i++) {
        p250.attack(attackable);
    }
    expect(p250.getAmmo()).toBe(0);
    expect(p250.getAmmoReserve()).toBe(26);
    processTimeout(p250.reload(), PistolP250.reloadTimeMs);
    expect(p250.getAmmo()).toBe(13);
    expect(p250.getAmmoReserve()).toBe(13);

    for (let i = 0; i < 13; i++) {
        p250.attack(attackable);
    }
    processTimeout(p250.reload(), PistolP250.reloadTimeMs);
    expect(p250.getAmmo()).toBe(13);
    expect(p250.getAmmoReserve()).toBe(0);

    for (let i = 0; i < 13; i++) {
        p250.attack(attackable);
    }
    expect(p250.getAmmo()).toBe(0);
    expect(p250.reload()).toBeNull(); // no reserve
    expect(p250.attack(attackable)).toBeNull(); // no ammo
});

test("reload canceled on unEquip", () => {
    const ak = new RifleAk(true);
    const state = { tick: 1, recoils: [], fireCount: 0 };
    ak.attack(createAttackable(state));
    expect(ak.reload()).not.toBeNull();
    expect(ak.isReloading()).toBe(true);

    ak.unEquip();
    expect(ak.isReloading()).toBe(false);
    expect(ak.isEquipped()).toBe(false);
    // unEquip() does not reset ammo (matches PHP: only reset() does)
    expect(ak.getAmmo()).toBe(RifleAk.magazineCapacity - 1);
    expect(ak.getAmmoReserve()).toBe(RifleAk.reserveAmmo);
});

test("recoil modifier full, partial and reset", () => {
    const ak = new RifleAk(true);
    const state = { tick: 1 };
    const recoils = [];
    const attackable = {
        getTickId() {
            return state.tick;
        },
        applyRecoil(offsetHorizontal, offsetVertical) {
            recoils.push([offsetHorizontal, offsetVertical]);
        },
        fire() {
            return "result";
        },
    };

    ak.attack(attackable); // tick 1: first bullet, pattern[0] = [0, 0]
    expect(recoils).toEqual([
        [0, 0],
        [0, 0],
    ]);
    recoils.length = 0;

    state.tick = 6; // 1 + fireRateTicks(5): full spray -> pattern[1]
    ak.attack(attackable);
    expect(recoils).toEqual([
        [0.1, 0.19],
        [0, 0],
    ]);
    recoils.length = 0;

    state.tick = 16; // 6 + 10 > fireRateTicks but < recoilResetTicks(17): partial -> pattern[2]
    ak.attack(attackable);
    const portion = 1 - Math.min(17, 16 - 6) / 17;
    expect(recoils).toEqual([
        [-0.01 * portion, 0.7 * portion],
        [0, 0],
    ]);
    recoils.length = 0;

    state.tick = 34; // 16 + 17 < 34: recoil fully reset -> pattern[0] again
    ak.attack(attackable);
    expect(recoils).toEqual([
        [0, 0],
        [0, 0],
    ]);
});

test("recoil patterns", () => {
    expect(PistolGlock.recoilPattern).toEqual([
        [0, 0],
        [0.12, 0.19],
        [0.13, 0.32],
        [0.24, 0.43],
        [0.21, 0.64],
        [0.24, 0.89],
        [0.12, 1.11],
        [-0.09, 1.25],
        [-0.12, 1.39],
        [0.16, 1.54],
        [0.33, 1.85],
        [-0.68, 2.09],
    ]);
    expect(PistolP250.recoilPattern).toHaveLength(13);
    expect(PistolUsp.recoilPattern).toHaveLength(12);
    expect(RifleAk.recoilPattern).toHaveLength(30);
    expect(RifleAk.recoilPattern[29]).toEqual([1.83, 5.23]);
    expect(RifleM4A4.recoilPattern).toHaveLength(30);
    expect(RifleM4A4.recoilPattern[0]).toEqual([0.0, 0.0]);
});

test("knife parameters and bullet", () => {
    expect(Knife.killAward).toBe(1500);
    expect(Knife.stabMaxDistance).toBe(140);
    expect(Knife.equipReadyTimeMs).toBe(500);

    const knife = new Knife();
    expect(knife.getType()).toBe(ItemType.TYPE_KNIFE);
    expect(knife.getSlot()).toBe(InventorySlot.SLOT_KNIFE);
    expect(knife.isUserDroppable()).toBe(false);
    expect(knife.getKillAward()).toBe(1500);
    expect(knife.canAttack(1)).toBe(false); // not equipped

    const bullet = knife.createBullet();
    expect(bullet).toBeInstanceOf(Bullet);
    expect(bullet.distanceMax).toBe(140);
    expect(bullet.getDamage()).toBe(1);
    expect(bullet.getShootItem()).toBe(knife);
});

test("knife attack and secondary attack tick windows", () => {
    const knife = new Knife(true);
    const state = { tick: 1, recoils: [], fireCount: 0 };
    const attackable = createAttackable(state);

    expect(knife.attack(attackable)).toBe("result");
    expect(knife.attack(attackable)).toBeNull(); // primary 400ms -> 20 ticks
    state.tick = 21; // 1 + 20
    expect(knife.attack(attackable)).toBe("result");
    expect(knife.attackSecondary(attackable)).toBeNull(); // secondary 1000ms -> 50 ticks
    state.tick = 71; // 21 + 50
    expect(knife.attackSecondary(attackable)).toBe("result");
    expect(knife.attack(attackable)).toBeNull();
    state.tick = 91; // 71 + 20
    expect(knife.attack(attackable)).toBe("result");
});

test("knife damage values", () => {
    const knife = new Knife();
    // primary
    expect(knife.getDamageValue(HitBoxType.BACK, ArmorType.NONE)).toBe(90);
    expect(knife.getDamageValue(HitBoxType.BACK, ArmorType.BODY)).toBe(76);
    expect(knife.getDamageValue(HitBoxType.HEAD, ArmorType.NONE)).toBe(40);
    expect(knife.getDamageValue(HitBoxType.HEAD, ArmorType.BODY_AND_HEAD)).toBe(34);
    expect(knife.getDamageValue(HitBoxType.CHEST, ArmorType.NONE)).toBe(40);
    expect(knife.getDamageValue(HitBoxType.CHEST, ArmorType.BODY)).toBe(34);
    expect(knife.getDamageValue(HitBoxType.STOMACH, ArmorType.BODY)).toBe(34);
    expect(knife.getDamageValue(HitBoxType.LEG, ArmorType.NONE)).toBe(40);

    // secondary (attackSecondary flips the attack mode even when it returns null)
    knife.attackSecondary(createAttackable({ tick: 0, recoils: [], fireCount: 0 }));
    expect(knife.getDamageValue(HitBoxType.BACK, ArmorType.NONE)).toBe(180);
    expect(knife.getDamageValue(HitBoxType.BACK, ArmorType.BODY)).toBe(153);
    expect(knife.getDamageValue(HitBoxType.HEAD, ArmorType.NONE)).toBe(65);
    expect(knife.getDamageValue(HitBoxType.HEAD, ArmorType.BODY_AND_HEAD)).toBe(55);
    expect(knife.getDamageValue(HitBoxType.CHEST, ArmorType.BODY)).toBe(55);
});

test("awp scope cycle and spread offsets", () => {
    const awp = new RifleAWP(true);
    expect(awp.isScopedIn()).toBe(false);
    awp.scope();
    expect(awp.isScopedIn()).toBe(true);
    expect(awp.getScopeLevel()).toBe(1);
    awp.scope();
    expect(awp.getScopeLevel()).toBe(2);
    awp.scope();
    expect(awp.isScopedIn()).toBe(false);
    expect(awp.getScopeLevel()).toBe(0);

    // unscoped: random non-zero spread offsets
    const state = { tick: 0, recoils: [], fireCount: 0 };
    const attackable = createAttackable(state);
    awp.attack(attackable);
    expect(state.recoils).toHaveLength(1);
    expect(Math.abs(state.recoils[0][0])).toBeGreaterThan(0);
    expect(Math.abs(state.recoils[0][1])).toBeGreaterThan(0);

    // scoped: no spread
    awp.scope();
    state.tick = 1;
    state.recoils.length = 0;
    awp.attack(attackable);
    expect(state.recoils).toEqual([[0, 0]]);
});

test("weapon createBullet", () => {
    const ak = new RifleAk(true);
    const bullet = ak.createBullet();
    expect(bullet).toBeInstanceOf(Bullet);
    expect(bullet.distanceMax).toBe(RifleAk.range);
    expect(bullet.getDamage()).toBe(RifleAk.damage);
    expect(bullet.getShootItem()).toBe(ak);

    const awp = new RifleAWP(true);
    const awpBullet = awp.createBullet();
    expect(awpBullet.distanceMax).toBe(20123);
    expect(awpBullet.getDamage()).toBe(350);

    const glock = new PistolGlock(true);
    const glockBullet = glock.createBullet();
    expect(glockBullet.distanceMax).toBe(20123);
    expect(glockBullet.getDamage()).toBe(110);
});
