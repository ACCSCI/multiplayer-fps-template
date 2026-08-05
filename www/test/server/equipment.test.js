import { expect, test } from "bun:test";
import { ArmorType, HitBoxType, InventorySlot, ItemType } from "../../assets/js/server/enums.js";
import { Bomb } from "../../assets/js/server/equipment/bomb.js";
import { Decoy } from "../../assets/js/server/equipment/decoy.js";
import { DefuseKit } from "../../assets/js/server/equipment/defuse_kit.js";
import { Flashbang } from "../../assets/js/server/equipment/flashbang.js";
import { HighExplosive } from "../../assets/js/server/equipment/high_explosive.js";
import { Incendiary } from "../../assets/js/server/equipment/incendiary.js";
import { Kevlar } from "../../assets/js/server/equipment/kevlar.js";
import { Molotov } from "../../assets/js/server/equipment/molotov.js";
import { Smoke } from "../../assets/js/server/equipment/smoke.js";
import { GameException } from "../../assets/js/server/game_exception.js";
import { AttackEnable, Flammable, hasContract, Volumetric } from "../../assets/js/server/interfaces.js";
import { Point } from "../../assets/js/server/point.js";
import { setTickRate } from "../../assets/js/server/util.js";

// Equipment behavior tests; PHP integration tests (test/og/Shooting/*) need the
// full Game stack ported by other slices, so this file asserts the
// equipment-level behavior directly against the PHP sources.

/** Minimal stand-in for cs\Core\Player used by Bomb::tryPlant/tryDefuse/explodeDamageToPlayer. */
class MockBombPlayer {
    constructor(id, position = new Point(), hasKit = false) {
        this.playerId = id;
        this.position = position;
        this.hasKit = hasKit;
        this.stopped = false;
        this.health = 100;
        this.armor = 100;
        this.healthDamage = 0;
        this.armorDamage = 0;
    }

    getId() {
        return this.playerId;
    }

    stop() {
        this.stopped = true;
    }

    getReferenceToPosition() {
        return this.position;
    }

    hasDefuseKit() {
        return this.hasKit;
    }

    getPositionClone() {
        return this.position.clone();
    }

    lowerHealth(damage) {
        this.healthDamage += damage;
        this.health -= damage;
    }

    lowerArmor(damage) {
        this.armorDamage += damage;
        this.armor -= damage;
    }
}

// Grenade family parameters (Grenade.php, HighExplosive.php, Smoke.php, Molotov.php, Incendiary.php, Decoy.php)

test("Grenade base behavior", () => {
    const decoy = new Decoy();
    expect(decoy.getType()).toBe(ItemType.TYPE_GRENADE);
    expect(decoy.getSlot()).toBe(InventorySlot.SLOT_GRENADE_DECOY);
    expect(decoy.getPrice()).toBe(50);
    expect(decoy.getKillAward()).toBe(300);
    expect(decoy.getBoundingRadius()).toBe(10);
    expect(decoy.getSpeedMultiplier()).toBe(1.0);
    expect(decoy.getMaxBuyCount()).toBe(1);
    expect(Decoy.equipReadyTimeMs).toBe(100);
});

test("Grenade attack/attackSecondary switch primary attack", () => {
    const decoy = new Decoy();
    const event = {
        fireCount: 0,
        fire() {
            this.fireCount++;
            return { fired: this.fireCount };
        },
    };
    expect(decoy.attack(event)).toEqual({ fired: 1 });
    expect(decoy.getSpeedMultiplier()).toBe(1.0);
    expect(decoy.attackSecondary(event)).toEqual({ fired: 2 });
    expect(decoy.getSpeedMultiplier()).toBe(0.5);
    expect(decoy.attack(event)).toEqual({ fired: 3 });
    expect(decoy.getSpeedMultiplier()).toBe(1.0);
});

test("Grenade getDamageValue and createBullet are invalid", () => {
    const decoy = new Decoy();
    expect(() => decoy.getDamageValue(HitBoxType.HEAD, ArmorType.NONE)).toThrow(GameException);
    expect(() => decoy.createBullet()).toThrow(GameException);
});

test("HighExplosive parameters and damage falloff", () => {
    const he = new HighExplosive();
    expect(he.getSlot()).toBe(InventorySlot.SLOT_GRENADE_HE);
    expect(he.getPrice()).toBe(300);
    expect(he.getMaxBlastRadius()).toBe(400);
    expect(HighExplosive.MAX_BLAST_RADIUS_SQUARED).toBe(160000);
    expect(he.calculateDamage(0, false)).toBe(20);
    expect(he.calculateDamage(1, false)).toBe(20);
    expect(he.calculateDamage(10000, false)).toBe(19);
    expect(he.calculateDamage(40000, false)).toBe(15);
    expect(he.calculateDamage(80000, false)).toBe(10);
    expect(he.calculateDamage(160000, false)).toBe(0);
    expect(he.calculateDamage(160001, false)).toBe(0);
    expect(he.calculateDamage(40000, true)).toBe(5);
    expect(he.calculateDamage(16000, true)).toBe(6); // 20 * 0.9 * 0.3 = 5.4 -> ceil
});

test("Smoke volumetric parameters", () => {
    const smoke = new Smoke();
    expect(smoke.getSlot()).toBe(InventorySlot.SLOT_GRENADE_SMOKE);
    expect(smoke.getPrice()).toBe(300);
    expect(Smoke.MAX_HEIGHT).toBe(350);
    expect(Smoke.MAX_CORNER_HEIGHT).toBe(270);
    expect(Smoke.MAX_TIME_MS).toBe(18000);
    expect(smoke.getMaxTimeMs()).toBe(18000);
    expect(smoke.getSpawnAreaMetersSquared()).toBe(120);
    expect(smoke.getMaxAreaMetersSquared()).toBe(550000);
    expect(hasContract(smoke, Volumetric)).toBe(true);
});

test("Molotov flammable parameters", () => {
    const molotov = new Molotov();
    expect(molotov.getSlot()).toBe(InventorySlot.SLOT_GRENADE_MOLOTOV);
    expect(molotov.getPrice()).toBe(400);
    expect(Molotov.MAX_TIME_MS).toBe(7000);
    expect(molotov.getMaxTimeMs()).toBe(7000);
    expect(molotov.getSpawnAreaMetersSquared()).toBe(100);
    expect(molotov.getMaxAreaMetersSquared()).toBe(450000);
    expect(molotov.calculateDamage(false)).toBe(4);
    expect(molotov.calculateDamage(true)).toBe(8);
    expect(hasContract(molotov, Flammable)).toBe(true);
});

test("Incendiary flammable parameters", () => {
    const incendiary = new Incendiary();
    expect(incendiary.getSlot()).toBe(InventorySlot.SLOT_GRENADE_MOLOTOV);
    expect(incendiary.getPrice()).toBe(600);
    expect(Incendiary.MAX_TIME_MS).toBe(7000);
    expect(incendiary.getMaxTimeMs()).toBe(7000);
    expect(incendiary.getSpawnAreaMetersSquared()).toBe(90);
    expect(incendiary.getMaxAreaMetersSquared()).toBe(200000);
    expect(incendiary.calculateDamage(false)).toBe(3);
    expect(incendiary.calculateDamage(true)).toBe(7);
    expect(hasContract(incendiary, Flammable)).toBe(true);
});

test("Decoy parameters", () => {
    const decoy = new Decoy();
    expect(decoy.getSlot()).toBe(InventorySlot.SLOT_GRENADE_DECOY);
    expect(decoy.getPrice()).toBe(50);
    expect(hasContract(decoy, AttackEnable)).toBe(true);
    expect(hasContract(decoy, Volumetric)).toBe(false);
});

test("Grenade static fields are inherited", () => {
    expect(Flashbang.equipReadyTimeMs).toBe(100);
    expect(HighExplosive.equipReadyTimeMs).toBe(100);
    expect(HighExplosive.boundingRadius).toBe(10);
    expect(Flashbang.boundingRadius).toBe(10);
});

// Flashbang quantity state machine (Flashbang.php)

test("Flashbang quantity state machine", () => {
    const flash = new Flashbang();
    expect(flash.getSlot()).toBe(InventorySlot.SLOT_GRENADE_FLASH);
    expect(flash.getPrice()).toBe(200);
    expect(flash.getQuantity()).toBe(1);
    expect(flash.getMaxQuantity()).toBe(2);
    expect(flash.getMaxBuyCount()).toBe(2);
    expect(flash.canPurchaseMultipleTime(new Flashbang())).toBe(true);

    flash.incrementQuantity();
    expect(flash.getQuantity()).toBe(2);
    expect(flash.canPurchaseMultipleTime(new Flashbang())).toBe(false);

    flash.decrementQuantity();
    expect(flash.getQuantity()).toBe(1);
    expect(() => flash.decrementQuantity()).toThrow(); // PHP assert($this->quantity > 1)
});

test("Flashbang clone resets quantity", () => {
    const flash = new Flashbang();
    flash.incrementQuantity();
    const clone = flash.clone();
    expect(clone).not.toBe(flash);
    expect(clone.getQuantity()).toBe(1);
    expect(clone.getSlot()).toBe(InventorySlot.SLOT_GRENADE_FLASH);
    expect(clone.canPurchaseMultipleTime(new Flashbang())).toBe(true);
});

// Kevlar (Kevlar.php)

test("Kevlar armor state machine", () => {
    const kevlar = new Kevlar(true);
    expect(kevlar.getArmor()).toBe(100);
    expect(kevlar.getArmorType()).toBe(ArmorType.BODY_AND_HEAD);
    expect(kevlar.getType()).toBe(ItemType.TYPE_KEVLAR);
    expect(kevlar.getSlot()).toBe(InventorySlot.SLOT_KEVLAR);
    expect(kevlar.canBeEquipped()).toBe(false);
    expect(kevlar.isUserDroppable()).toBe(false);
    expect(kevlar.getMaxBuyCount()).toBe(5);

    kevlar.lowerArmor(30);
    expect(kevlar.getArmor()).toBe(70);
    expect(kevlar.getArmorType()).toBe(ArmorType.BODY_AND_HEAD);

    kevlar.repairArmor();
    expect(kevlar.getArmor()).toBe(100);

    kevlar.lowerArmor(200);
    expect(kevlar.getArmor()).toBe(0);
    expect(kevlar.getArmorType()).toBe(ArmorType.NONE);
    expect(() => kevlar.lowerArmor(-1)).toThrow(); // PHP assert($armorDamage >= 0)
});

test("Kevlar price upgrades", () => {
    const helmet = new Kevlar(true);
    const body = new Kevlar(false);
    expect(helmet.getPrice()).toBe(1000);
    expect(body.getPrice()).toBe(650);

    expect(body.getPrice(helmet)).toBe(650); // already have helmet
    expect(helmet.getPrice(body)).toBe(350); // upgrade body with full armor to helmet

    const damagedBody = new Kevlar(false);
    damagedBody.lowerArmor(10);
    expect(helmet.getPrice(damagedBody)).toBe(1000); // damaged body: full price
});

test("Kevlar canPurchaseMultipleTime", () => {
    const helmet = new Kevlar(true);
    const body = new Kevlar(false);
    expect(body.canPurchaseMultipleTime(helmet)).toBe(true); // body -> upgrade to helmet
    expect(body.canPurchaseMultipleTime(new Kevlar(false))).toBe(false);
    expect(helmet.canPurchaseMultipleTime(helmet)).toBe(false);

    const damagedHelmet = new Kevlar(true);
    damagedHelmet.lowerArmor(1);
    expect(damagedHelmet.canPurchaseMultipleTime(helmet)).toBe(true); // armor < 100

    const destroyedBody = new Kevlar(false);
    destroyedBody.lowerArmor(200);
    expect(destroyedBody.canPurchaseMultipleTime(new Kevlar(false))).toBe(true); // type NONE, armor 0 < 100
});

// DefuseKit (DefuseKit.php)

test("DefuseKit parameters", () => {
    const kit = new DefuseKit();
    expect(kit.getType()).toBe(ItemType.TYPE_DEFUSE_KIT);
    expect(kit.getSlot()).toBe(InventorySlot.SLOT_KIT);
    expect(kit.getPrice()).toBe(400);
    expect(kit.canBeEquipped()).toBe(false);
    expect(kit.isUserDroppable()).toBe(false);
    expect(kit.canPurchaseMultipleTime(new DefuseKit())).toBe(false);
    expect(kit.getMaxBuyCount()).toBe(1);
});

// Item integration (Item.php + BaseEquipment.php)

test("Item ids and toArray match PHP ItemId map", () => {
    expect(new Decoy().getId()).toBe(30);
    expect(new Flashbang().getId()).toBe(31);
    expect(new HighExplosive().getId()).toBe(32);
    expect(new Incendiary().getId()).toBe(33);
    expect(new Kevlar(true).getId()).toBe(34);
    expect(new Molotov().getId()).toBe(35);
    expect(new Smoke().getId()).toBe(36);
    expect(new Bomb(3000, 5000).getId()).toBe(50);
    expect(new DefuseKit().getId()).toBe(51);

    expect(new Decoy().toArray()).toEqual({ id: 30, slot: InventorySlot.SLOT_GRENADE_DECOY });
    expect(new Bomb(3000, 5000).toArray()).toEqual({ id: 50, slot: InventorySlot.SLOT_BOMB });
});

test("Item equip state machine via EquipEvent", () => {
    const decoy = new Decoy();
    expect(decoy.isEquipped()).toBe(false);
    expect(decoy.canAttack(0)).toBe(false);

    const event = decoy.equip();
    expect(event).not.toBeNull();
    expect(decoy.isEquipped()).toBe(false);
    // Decoy::equipReadyTimeMs = 100ms, tick rate 20ms -> fires on the 6th process() call
    for (let tick = 0; tick < 6; tick++) {
        event.process(tick);
    }
    expect(decoy.isEquipped()).toBe(true);
    expect(decoy.canAttack(0)).toBe(true);

    decoy.unEquip();
    expect(decoy.isEquipped()).toBe(false);
    expect(decoy.canAttack(0)).toBe(false);

    // re-equip restarts the timer (EquipEvent::reset)
    const event2 = decoy.equip();
    expect(decoy.isEquipped()).toBe(false);
    for (let tick = 0; tick < 5; tick++) {
        event2.process(tick);
    }
    expect(decoy.isEquipped()).toBe(false);
    event2.process(6);
    expect(decoy.isEquipped()).toBe(true);
});

test("Non-equippable items return null from equip()", () => {
    expect(new Kevlar(true).equip()).toBeNull();
    expect(new DefuseKit().equip()).toBeNull();
    expect(new Bomb(3000, 5000).equip()).not.toBeNull();
});

test("Item skin id and scope level", () => {
    const decoy = new Decoy();
    expect(decoy.getSkinId()).toBe(0);
    decoy.setSkinId(7);
    expect(decoy.getSkinId()).toBe(7);
    expect(decoy.getScopeLevel()).toBe(0);
    decoy.reset();
    expect(decoy.getScopeLevel()).toBe(0);
});

test("Item default price and quantities", () => {
    const bomb = new Bomb(3000, 5000);
    expect(bomb.getPrice()).toBe(9999); // PHP Item::$price default
    expect(bomb.getMaxQuantity()).toBe(1);
    expect(bomb.getMaxBuyCount()).toBe(1);
    expect(bomb.getQuantity()).toBe(1);
});

// Bomb plant/defuse state machine (Bomb.php)

test("Bomb plant state machine", () => {
    setTickRate(20);
    const bomb = new Bomb(3000, 5000); // 150 plant frames, 250 defuse frames
    expect(Bomb.equipReadyTimeMs).toBe(80);
    expect(bomb.getSlot()).toBe(InventorySlot.SLOT_BOMB);
    expect(bomb.getType()).toBe(ItemType.TYPE_BOMB);
    expect(bomb.getPosition()).toEqual(new Point());

    const player = new MockBombPlayer(7, new Point(10, 0, 20));
    let result = bomb.tryPlant(player, 0); // planting started
    expect(result).toBeNull();
    expect(player.stopped).toBe(true);
    for (let tick = 1; tick <= 149; tick++) {
        result = bomb.tryPlant(player, tick); // still planting
        expect(result).toBe(false);
    }
    expect(bomb.tryPlant(player, 150)).toBe(true); // planted
    expect(bomb.getPosition()).toEqual(new Point(10, 0, 20));

    // planting done: a new action restarts the planting
    player.position.set(99, 0, 99);
    expect(bomb.tryPlant(player, 200)).toBeNull();
    expect(bomb.getPosition()).toEqual(new Point(10, 0, 20)); // position not touched while planting
});

test("Bomb plant same tick returns false without restart", () => {
    const bomb = new Bomb(3000, 5000);
    const player = new MockBombPlayer(1, new Point());
    expect(bomb.tryPlant(player, 0)).toBeNull();
    expect(bomb.tryPlant(player, 0)).toBe(false);
});

test("Bomb plant action tick buffer", () => {
    const bomb = new Bomb(3000, 5000, 1000, 2);
    const player = new MockBombPlayer(1, new Point());
    expect(bomb.tryPlant(player, 0)).toBeNull();
    expect(bomb.tryPlant(player, 2)).toBe(false); // gap == buffer: continues
    expect(bomb.tryPlant(player, 5)).toBeNull(); // gap > buffer: restarts
    for (let tick = 6; tick <= 154; tick++) {
        expect(bomb.tryPlant(player, tick)).toBe(false);
    }
    expect(bomb.tryPlant(player, 155)).toBe(true); // 155 - 5 = 150 frames
});

test("Bomb defuse state machine without kit", () => {
    const bomb = new Bomb(3000, 5000);
    const player = new MockBombPlayer(3, new Point(), false);
    let result = bomb.tryDefuse(player, 0);
    expect(result).toBeNull();
    for (let tick = 1; tick <= 249; tick++) {
        result = bomb.tryDefuse(player, tick);
        expect(result).toBe(false);
    }
    expect(bomb.tryDefuse(player, 250)).toBe(true); // full 250 frames
});

test("Bomb defuse with kit halves the time", () => {
    const bomb = new Bomb(3000, 5000);
    const player = new MockBombPlayer(3, new Point(), true);
    let result = bomb.tryDefuse(player, 0);
    expect(result).toBeNull();
    for (let tick = 1; tick <= 124; tick++) {
        result = bomb.tryDefuse(player, tick);
        expect(result).toBe(false);
    }
    expect(bomb.tryDefuse(player, 125)).toBe(true); // ceil(250 / 2) = 125 frames
});

test("Bomb isPlantingOrDefusing", () => {
    const bomb = new Bomb(3000, 5000);
    const player = new MockBombPlayer(2, new Point());
    bomb.tryPlant(player, 10);
    expect(bomb.isPlantingOrDefusing(2, 11)).toBe(true);
    expect(bomb.isPlantingOrDefusing(2, 12)).toBe(false); // buffer 1 exceeded
    expect(bomb.isPlantingOrDefusing(1, 11)).toBe(false);
});

test("Bomb reset and unEquip clear plant state", () => {
    const bomb = new Bomb(3000, 5000);
    const player = new MockBombPlayer(1, new Point());
    expect(bomb.tryPlant(player, 0)).toBeNull();
    bomb.unEquip(); // parent unEquip + reset (plantTickStart = 0)

    // same player keeps acting within the tick buffer: countdown continues from 0
    let result = null;
    for (let tick = 1; tick <= 150; tick++) {
        result = bomb.tryPlant(player, tick);
    }
    expect(result).toBe(true); // 150 - 0 = 150 frames after reset
});

test("Bomb explodeDamageToPlayer falloff ladder", () => {
    const bomb = new Bomb(3000, 5000);
    bomb.setMaxBlastDistance(1000); // maxSquared = 1000 * 1000

    const far = new MockBombPlayer(1, new Point(1001, 0, 0)); // 1002001 > maxSquared
    bomb.explodeDamageToPlayer(far);
    expect(far.healthDamage).toBe(0);
    expect(far.armorDamage).toBe(0);

    const tier09 = new MockBombPlayer(2, new Point(950, 0, 0)); // 902500 > 0.9 * maxSquared
    bomb.explodeDamageToPlayer(tier09);
    expect(tier09.healthDamage).toBe(4);

    const tier08 = new MockBombPlayer(3, new Point(900, 0, 0)); // 810000 > 0.8 * maxSquared
    bomb.explodeDamageToPlayer(tier08);
    expect(tier08.healthDamage).toBe(7);

    const tier07 = new MockBombPlayer(4, new Point(850, 0, 0)); // 722500 > 0.7 * maxSquared
    bomb.explodeDamageToPlayer(tier07);
    expect(tier07.healthDamage).toBe(12);

    const tier06 = new MockBombPlayer(5, new Point(800, 0, 0)); // 640000 > 0.6 * maxSquared
    bomb.explodeDamageToPlayer(tier06);
    expect(tier06.healthDamage).toBe(26);

    const tier05 = new MockBombPlayer(6, new Point(750, 0, 0)); // 562500 > 0.5 * maxSquared
    bomb.explodeDamageToPlayer(tier05);
    expect(tier05.healthDamage).toBe(49);

    const tier04 = new MockBombPlayer(7, new Point(700, 0, 0)); // 490000 > 0.4 * maxSquared
    bomb.explodeDamageToPlayer(tier04);
    expect(tier04.healthDamage).toBe(61);

    const tier03 = new MockBombPlayer(8, new Point(600, 0, 0)); // 360000 > 0.3 * maxSquared
    bomb.explodeDamageToPlayer(tier03);
    expect(tier03.healthDamage).toBe(74);

    const tier02 = new MockBombPlayer(9, new Point(500, 0, 0)); // 250000 > 0.2 * maxSquared
    bomb.explodeDamageToPlayer(tier02);
    expect(tier02.healthDamage).toBe(84);

    const tier01 = new MockBombPlayer(10, new Point(350, 0, 0)); // 122500 > 0.1 * maxSquared
    bomb.explodeDamageToPlayer(tier01);
    expect(tier01.healthDamage).toBe(92);

    const center = new MockBombPlayer(11, new Point(100, 0, 0));
    bomb.explodeDamageToPlayer(center);
    expect(center.healthDamage).toBe(500);
    expect(center.armorDamage).toBe(500);
});

test("Bomb setMaxBlastDistance", () => {
    const bomb = new Bomb(3000, 5000, 1000);
    bomb.setMaxBlastDistance(500);
    const far = new MockBombPlayer(1, new Point(600, 0, 0)); // 360000 > 250000
    bomb.explodeDamageToPlayer(far);
    expect(far.healthDamage).toBe(0);

    const close = new MockBombPlayer(2, new Point(160, 0, 0)); // 25600 > 0.1 * 250000 -> 92
    bomb.explodeDamageToPlayer(close);
    expect(close.healthDamage).toBe(92);
});
