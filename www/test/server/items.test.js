import { expect, test } from "bun:test";
import { BuyMenu } from "../../assets/js/server/buy_menu.js";
import { DropItem } from "../../assets/js/server/drop_item.js";
import {
    ArmorType,
    BuyMenuItem,
    getGrenadeSlotIds,
    InventorySlot,
    ItemId,
    ItemType,
} from "../../assets/js/server/enums.js";
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
import { Inventory } from "../../assets/js/server/inventory.js";
import { Point } from "../../assets/js/server/point.js";
import { setTickRate } from "../../assets/js/server/util.js";
import { Knife } from "../../assets/js/server/weapon/knife.js";
import { PistolGlock } from "../../assets/js/server/weapon/pistol_glock.js";
import { PistolP250 } from "../../assets/js/server/weapon/pistol_p250.js";
import { PistolUsp } from "../../assets/js/server/weapon/pistol_usp.js";
import { RifleAk } from "../../assets/js/server/weapon/rifle_ak.js";
import { RifleAWP } from "../../assets/js/server/weapon/rifle_awp.js";
import { RifleM4A4 } from "../../assets/js/server/weapon/rifle_m4a4.js";

// Tests ported from test/og/Unit/InventoryTest.php and the Inventory-level
// behavior of test/og/Inventory/InventoryTest.php (game/player layer excluded).

setTickRate(20);

const stubPlayer = { dropEquippedItem() {} };

test("inventory respawn slots", () => {
    const defender = new Inventory(false);
    expect(defender.getEquipped()).toBeInstanceOf(PistolUsp);
    expect(defender.getEquipped().isEquipped()).toBe(true);
    expect(defender.getItemSlot(InventorySlot.SLOT_KNIFE)).toBeInstanceOf(Knife);
    expect(defender.has(InventorySlot.SLOT_SECONDARY)).toBe(true);
    expect(defender.has(InventorySlot.SLOT_PRIMARY)).toBe(false);
    expect(defender.getDollars()).toBe(0);
    expect(defender.getFilledSlots()).toEqual({
        [InventorySlot.SLOT_KNIFE]: { id: ItemId.Knife, slot: InventorySlot.SLOT_KNIFE },
        [InventorySlot.SLOT_SECONDARY]: { id: ItemId.PistolUsp, slot: InventorySlot.SLOT_SECONDARY },
    });

    const attacker = new Inventory(true);
    expect(attacker.getEquipped()).toBeInstanceOf(PistolGlock);
    expect(attacker.getItemSlot(InventorySlot.SLOT_SECONDARY).toArray()).toEqual({
        id: ItemId.PistolGlock,
        slot: InventorySlot.SLOT_SECONDARY,
    });
});

test("inventory grenade last equipped slots", () => {
    const inventory = new Inventory(false);
    expect(inventory.getLastEquippedGrenadeSlots()).toEqual(getGrenadeSlotIds());

    let lastGrenadeEquippedSlots = inventory.getLastEquippedGrenadeSlots();
    expect(lastGrenadeEquippedSlots.shift()).toBe(InventorySlot.SLOT_GRENADE_SMOKE);

    const incendiary = new Incendiary();
    expect(incendiary.getMaxQuantity()).toBe(1);
    expect(incendiary.getMaxBuyCount()).toBe(1);
    expect(incendiary.getQuantity()).toBe(1);

    expect(inventory.pickup(incendiary)).toBe(true);
    expect(inventory.equip(InventorySlot.SLOT_GRENADE_MOLOTOV)).not.toBeNull();
    lastGrenadeEquippedSlots = inventory.getLastEquippedGrenadeSlots();
    expect(lastGrenadeEquippedSlots).not.toEqual(getGrenadeSlotIds());
    const expectedSlots = [InventorySlot.SLOT_GRENADE_MOLOTOV];
    for (const slotId of getGrenadeSlotIds()) {
        if (slotId === InventorySlot.SLOT_GRENADE_MOLOTOV) {
            continue;
        }
        expectedSlots.push(slotId);
    }
    expect(lastGrenadeEquippedSlots).toEqual(expectedSlots);

    inventory.removeSlot(InventorySlot.SLOT_GRENADE_MOLOTOV);
    lastGrenadeEquippedSlots = inventory.getLastEquippedGrenadeSlots();
    expect(lastGrenadeEquippedSlots.shift()).toBe(InventorySlot.SLOT_GRENADE_SMOKE);
});

test("inventory equip/unequip state", () => {
    const inventory = new Inventory(true);
    const glock = inventory.getEquipped();
    expect(glock).toBeInstanceOf(PistolGlock);
    expect(inventory.equip(InventorySlot.SLOT_KNIFE)).not.toBeNull();
    expect(glock.isEquipped()).toBe(false);
    expect(inventory.getEquipped()).toBeInstanceOf(Knife);
    const equipEvent = inventory.equip(InventorySlot.SLOT_SECONDARY);
    expect(equipEvent).not.toBeNull();
    expect(inventory.getEquipped()).toBe(glock);
    // isEquipped() flips when the equip event completes (equipReadyTimeMs 400 -> 20 ticks)
    expect(glock.isEquipped()).toBe(false);
    for (let tick = 0; tick <= 20; tick++) {
        equipEvent.process(tick);
    }
    expect(glock.isEquipped()).toBe(true);
    // equip on empty slot returns null
    expect(inventory.equip(InventorySlot.SLOT_PRIMARY)).toBeNull();
});

test("inventory cannot buy without money", () => {
    const inventory = new Inventory(true);
    expect(inventory.purchase(stubPlayer, BuyMenuItem.RIFLE_AK)).toBeNull();
    expect(inventory.getDollars()).toBe(0);
    expect(inventory.has(InventorySlot.SLOT_PRIMARY)).toBe(false);
});

test("inventory buy and drop primary with enough money", () => {
    const startMoney = 2800;
    const akPrice = 2700;
    const inventory = new Inventory(true);
    inventory.earnMoney(startMoney);
    expect(inventory.purchase(stubPlayer, BuyMenuItem.RIFLE_AK)).not.toBeNull();
    expect(inventory.getDollars()).toBe(startMoney - akPrice);

    const item = inventory.getItemSlot(InventorySlot.SLOT_PRIMARY);
    expect(item).toBeInstanceOf(RifleAk);
    expect(item.getPrice()).toBe(akPrice);
    expect(item.isUserDroppable()).toBe(true);

    // re-equip primary like Player::equipPrimaryWeapon() (lastEquippedSlotId -> primary)
    expect(inventory.equip(InventorySlot.SLOT_PRIMARY)).not.toBeNull();
    expect(inventory.getEquipped()).toBe(item);
    const dropped = inventory.removeEquipped();
    expect(dropped).toBe(item);
    expect(inventory.getEquipped()).toBeInstanceOf(Knife);
    expect(inventory.has(InventorySlot.SLOT_PRIMARY)).toBe(false);
    // knife is not droppable
    expect(inventory.removeEquipped()).toBeNull();
});

test("inventory buying a new secondary drops the current one", () => {
    const inventory = new Inventory(true);
    inventory.earnMoney(2000);
    const dropped = [];
    const player = {
        dropEquippedItem() {
            dropped.push(inventory.getEquipped());
        },
    };

    expect(inventory.purchase(player, BuyMenuItem.PISTOL_P250)).not.toBeNull();
    expect(inventory.getDollars()).toBe(2000 - 300);
    expect(dropped).toHaveLength(1);
    expect(dropped[0]).toBeInstanceOf(PistolGlock);
    expect(inventory.getEquipped()).toBeInstanceOf(PistolP250);
    expect(inventory.has(InventorySlot.SLOT_SECONDARY)).toBe(true);
});

test("inventory buy max four grenades", () => {
    const inventory = new Inventory(true);
    inventory.earnMoney(6000);
    expect(inventory.purchase(stubPlayer, BuyMenuItem.GRENADE_SMOKE)).not.toBeNull();
    expect(inventory.purchase(stubPlayer, BuyMenuItem.GRENADE_MOLOTOV)).not.toBeNull();
    expect(inventory.purchase(stubPlayer, BuyMenuItem.GRENADE_FLASH)).not.toBeNull();
    expect(inventory.purchase(stubPlayer, BuyMenuItem.GRENADE_FLASH)).not.toBeNull();
    //
    expect(inventory.purchase(stubPlayer, BuyMenuItem.GRENADE_SMOKE)).toBeNull();
    expect(inventory.purchase(stubPlayer, BuyMenuItem.GRENADE_MOLOTOV)).toBeNull();
    expect(inventory.purchase(stubPlayer, BuyMenuItem.GRENADE_DECOY)).toBeNull();
    expect(inventory.purchase(stubPlayer, BuyMenuItem.GRENADE_FLASH)).toBeNull();
    expect(inventory.purchase(stubPlayer, BuyMenuItem.GRENADE_HE)).toBeNull();

    expect(inventory.getDollars()).toBe(6000 - 1100);
    // PHP game test asserts 6 items (attacker also carries the bomb from the game layer)
    expect(Object.keys(inventory.getItems())).toHaveLength(5);
    expect(inventory.getItemSlot(InventorySlot.SLOT_GRENADE_HE)).toBeNull();
    expect(inventory.getItemSlot(InventorySlot.SLOT_GRENADE_DECOY)).toBeNull();
    expect(inventory.getItemSlot(InventorySlot.SLOT_GRENADE_FLASH).getQuantity()).toBe(2);
});

test("inventory buy two flashes increments quantity", () => {
    const startMoney = 600;
    const itemPrice = 200;
    const inventory = new Inventory(true);
    inventory.earnMoney(startMoney);

    expect(inventory.purchase(stubPlayer, BuyMenuItem.GRENADE_FLASH)).not.toBeNull();
    expect(inventory.purchase(stubPlayer, BuyMenuItem.GRENADE_FLASH)).not.toBeNull();
    expect(inventory.purchase(stubPlayer, BuyMenuItem.GRENADE_FLASH)).toBeNull();
    expect(inventory.getDollars()).toBe(itemPrice);

    const item = inventory.getItemSlot(InventorySlot.SLOT_GRENADE_FLASH);
    expect(item).toBeInstanceOf(Flashbang);
    expect(item.getPrice()).toBe(itemPrice);
    expect(inventory.canBuy(item)).toBe(false);
    expect(item.getQuantity()).toBe(2);
});

test("inventory drop equipped grenade with quantity", () => {
    const inventory = new Inventory(true);
    inventory.earnMoney(600);
    inventory.purchase(stubPlayer, BuyMenuItem.GRENADE_FLASH);
    inventory.purchase(stubPlayer, BuyMenuItem.GRENADE_FLASH);

    const item = inventory.getEquipped();
    expect(item).toBeInstanceOf(Flashbang);
    expect(item.getQuantity()).toBe(2);
    const dropped = inventory.removeEquipped();
    expect(dropped).toBeInstanceOf(Flashbang);
    expect(dropped).not.toBe(item);
    expect(dropped.getQuantity()).toBe(1);
    expect(item.getQuantity()).toBe(1);
    expect(inventory.has(InventorySlot.SLOT_GRENADE_FLASH)).toBe(true);
    expect(inventory.getEquipped()).toBe(item);

    const dropped2 = inventory.removeEquipped();
    expect(dropped2).toBe(item);
    expect(inventory.has(InventorySlot.SLOT_GRENADE_FLASH)).toBe(false);
    expect(inventory.getEquipped()).toBeInstanceOf(Knife);
});

test("inventory kevlar buy flow", () => {
    const inventory = new Inventory(true);
    inventory.earnMoney(2301);
    expect(inventory.getKevlar()).toBeNull();

    expect(inventory.purchase(stubPlayer, BuyMenuItem.KEVLAR_BODY)).toBeNull(); // cannot be equipped
    expect(inventory.getDollars()).toBe(1651);
    let kevlar = inventory.getKevlar();
    expect(kevlar).not.toBeNull();
    expect(kevlar.getArmorType()).toBe(ArmorType.BODY);
    expect(kevlar.getArmor()).toBe(100);
    expect(kevlar.isUserDroppable()).toBe(false);
    expect(kevlar.canPurchaseMultipleTime(kevlar)).toBe(false);
    expect(inventory.equip(InventorySlot.SLOT_KEVLAR)).toBeNull();

    // damaged kevlar is repurchased as a fresh full-armor kevlar
    kevlar.lowerArmor(10);
    expect(kevlar.getArmor()).toBe(90);
    expect(inventory.purchase(stubPlayer, BuyMenuItem.KEVLAR_BODY)).toBeNull();
    expect(inventory.getDollars()).toBe(1001);
    kevlar = inventory.getKevlar();
    expect(kevlar.getArmorType()).toBe(ArmorType.BODY);
    expect(kevlar.getArmor()).toBe(100);

    // full body kevlar cannot be repurchased, upgrade to body+head costs 350
    expect(inventory.purchase(stubPlayer, BuyMenuItem.KEVLAR_BODY)).toBeNull();
    expect(inventory.getDollars()).toBe(1001);
    expect(inventory.purchase(stubPlayer, BuyMenuItem.KEVLAR_BODY_AND_HEAD)).toBeNull();
    expect(inventory.getDollars()).toBe(651);
    kevlar = inventory.getKevlar();
    expect(kevlar.getArmorType()).toBe(ArmorType.BODY_AND_HEAD);
    expect(kevlar.getArmor()).toBe(100);

    // damaged helmet kevlar is repaired in place (650) and cannot be bought again
    kevlar.lowerArmor(10);
    expect(kevlar.getArmor()).toBe(90);
    expect(inventory.purchase(stubPlayer, BuyMenuItem.KEVLAR_BODY)).toBeNull();
    expect(inventory.purchase(stubPlayer, BuyMenuItem.KEVLAR_BODY)).toBeNull();
    expect(inventory.getDollars()).toBe(1);
    expect(inventory.getKevlar()).toBe(kevlar);
    expect(kevlar.getArmorType()).toBe(ArmorType.BODY_AND_HEAD);
    expect(kevlar.getArmor()).toBe(100);
});

test("inventory pickup restrictions", () => {
    const defender = new Inventory(false);
    expect(defender.pickup(new DefuseKit())).toBe(true);
    expect(defender.has(InventorySlot.SLOT_KIT)).toBe(true);

    const attacker = new Inventory(true);
    expect(attacker.pickup(new DefuseKit())).toBe(false);
    expect(attacker.pickup(new Bomb(3000, 5000))).toBe(true);
    expect(attacker.has(InventorySlot.SLOT_BOMB)).toBe(true);
    expect(defender.pickup(new Bomb(3000, 5000))).toBe(false);

    // quantity limit: two flashes are full
    const third = new Inventory(false);
    expect(third.pickup(new Flashbang())).toBe(true);
    expect(third.pickup(new Flashbang())).toBe(true);
    expect(third.pickup(new Flashbang())).toBe(false);
});

test("inventory reset without respawn keeps items", () => {
    const inventory = new Inventory(true);
    inventory.earnMoney(5000);
    expect(inventory.purchase(stubPlayer, BuyMenuItem.RIFLE_AWP)).not.toBeNull();
    const awp = inventory.getItemSlot(InventorySlot.SLOT_PRIMARY);
    expect(awp).toBeInstanceOf(RifleAWP);
    awp.scope();
    expect(awp.getScopeLevel()).toBe(1);

    inventory.reset(true, false);
    expect(inventory.getItemSlot(InventorySlot.SLOT_PRIMARY)).toBe(awp);
    expect(awp.getScopeLevel()).toBe(0);
    expect(inventory.getDollars()).toBe(5000 - 4750);
});

test("inventory reset with respawn", () => {
    const inventory = new Inventory(true);
    inventory.earnMoney(3000);
    inventory.purchase(stubPlayer, BuyMenuItem.RIFLE_AK);
    expect(inventory.has(InventorySlot.SLOT_PRIMARY)).toBe(true);

    inventory.reset(true, true);
    expect(inventory.has(InventorySlot.SLOT_PRIMARY)).toBe(false);
    expect(inventory.has(InventorySlot.SLOT_KNIFE)).toBe(true);
    expect(inventory.has(InventorySlot.SLOT_SECONDARY)).toBe(true);
    expect(inventory.getEquipped()).toBeInstanceOf(PistolGlock);
    expect(inventory.getLastEquippedGrenadeSlots()).toEqual(getGrenadeSlotIds());
});

test("buy menu side-restricted items", () => {
    const attacker = new BuyMenu(true, []);
    const defender = new BuyMenu(false, []);

    expect(attacker.get(BuyMenuItem.RIFLE_AK)).toBeInstanceOf(RifleAk);
    expect(attacker.get(BuyMenuItem.RIFLE_M4A4)).toBeNull();
    expect(attacker.get(BuyMenuItem.PISTOL_USP)).toBeNull();
    expect(attacker.get(BuyMenuItem.PISTOL_GLOCK)).toBeInstanceOf(PistolGlock);
    expect(attacker.get(BuyMenuItem.GRENADE_MOLOTOV)).toBeInstanceOf(Molotov);
    expect(attacker.get(BuyMenuItem.GRENADE_INCENDIARY)).toBeNull();
    expect(attacker.get(BuyMenuItem.DEFUSE_KIT)).toBeNull();

    expect(defender.get(BuyMenuItem.RIFLE_AK)).toBeNull();
    expect(defender.get(BuyMenuItem.RIFLE_M4A4)).toBeInstanceOf(RifleM4A4);
    expect(defender.get(BuyMenuItem.PISTOL_USP)).toBeInstanceOf(PistolUsp);
    expect(defender.get(BuyMenuItem.PISTOL_GLOCK)).toBeNull();
    expect(defender.get(BuyMenuItem.GRENADE_MOLOTOV)).toBeNull();
    expect(defender.get(BuyMenuItem.GRENADE_INCENDIARY)).toBeInstanceOf(Incendiary);
    expect(defender.get(BuyMenuItem.DEFUSE_KIT)).toBeInstanceOf(DefuseKit);

    expect(attacker.get(BuyMenuItem.RIFLE_AWP)).toBeInstanceOf(RifleAWP);
    expect(attacker.get(BuyMenuItem.PISTOL_P250)).toBeInstanceOf(PistolP250);
    expect(attacker.get(BuyMenuItem.GRENADE_FLASH)).toBeInstanceOf(Flashbang);
    expect(attacker.get(BuyMenuItem.GRENADE_SMOKE)).toBeInstanceOf(Smoke);
    expect(attacker.get(BuyMenuItem.GRENADE_DECOY)).toBeInstanceOf(Decoy);
    expect(attacker.get(BuyMenuItem.GRENADE_HE)).toBeInstanceOf(HighExplosive);
    expect(attacker.get(BuyMenuItem.KEVLAR_BODY_AND_HEAD)).toBeInstanceOf(Kevlar);
    expect(attacker.get(BuyMenuItem.KEVLAR_BODY)).toBeInstanceOf(Kevlar);
});

test("buy menu max buy count", () => {
    const store = new BuyMenu(true, []);
    for (let i = 0; i < 5; i++) {
        const item = store.get(BuyMenuItem.RIFLE_AK);
        expect(item).not.toBeNull();
        store.confirmPurchase(item);
    }
    expect(store.get(BuyMenuItem.RIFLE_AK)).toBeNull();

    const flashStore = new BuyMenu(true, []);
    for (let i = 0; i < 2; i++) {
        const item = flashStore.get(BuyMenuItem.GRENADE_FLASH);
        expect(item).not.toBeNull();
        flashStore.confirmPurchase(item);
    }
    expect(flashStore.get(BuyMenuItem.GRENADE_FLASH)).toBeNull();
});

test("buy menu grenade count max", () => {
    const store = new BuyMenu(true, []);
    store.confirmPurchase(store.get(BuyMenuItem.GRENADE_SMOKE));
    store.confirmPurchase(store.get(BuyMenuItem.GRENADE_MOLOTOV));
    store.confirmPurchase(store.get(BuyMenuItem.GRENADE_FLASH));
    store.confirmPurchase(store.get(BuyMenuItem.GRENADE_FLASH));
    expect(store.get(BuyMenuItem.GRENADE_HE)).toBeNull();
    expect(store.get(BuyMenuItem.GRENADE_DECOY)).toBeNull();
    // weapons still purchasable
    expect(store.get(BuyMenuItem.RIFLE_AK)).not.toBeNull();
});

test("buy menu reset counts owned items", () => {
    const store = new BuyMenu(true, [new RifleAk(), new Flashbang(), new Flashbang(), new Smoke()]);
    expect(store.get(BuyMenuItem.RIFLE_AK)).not.toBeNull(); // 1 + 1 <= 5
    expect(store.get(BuyMenuItem.GRENADE_MOLOTOV)).not.toBeNull(); // 3 + 1 <= 4
    expect(store.get(BuyMenuItem.GRENADE_HE)).not.toBeNull(); // 3 + 1 <= 4 (4th grenade)
    store.confirmPurchase(store.get(BuyMenuItem.GRENADE_HE));
    expect(store.get(BuyMenuItem.GRENADE_DECOY)).toBeNull(); // 4 + 1 > 4

    const fullStore = new BuyMenu(true, [new RifleAk(), new RifleAk(), new RifleAk(), new RifleAk(), new RifleAk()]);
    expect(fullStore.get(BuyMenuItem.RIFLE_AK)).toBeNull(); // 5 + 1 > 5
});

test("drop item bounding radius by item type", () => {
    const position = new Point(10, 20, 30);
    const ak = new RifleAk();
    const dropAk = new DropItem("id1", ak, position);
    expect(dropAk.getId()).toBe("id1");
    expect(dropAk.getItem()).toBe(ak);
    expect(dropAk.getPosition()).toBe(position);
    expect(dropAk.getBoundingRadius()).toBe(30); // primary
    expect(dropAk.getHeight()).toBe(6);

    expect(new DropItem("id2", new PistolGlock(), position).getBoundingRadius()).toBe(20); // secondary
    expect(new DropItem("id3", new Flashbang(), position).getBoundingRadius()).toBe(10); // grenade
    expect(new DropItem("id4", new Knife(), position).getBoundingRadius()).toBe(10); // knife
    expect(new DropItem("id5", new DefuseKit(), position).getBoundingRadius()).toBe(10); // kit
});

test("item base behavior via weapons", () => {
    const ak = new RifleAk();
    expect(ak.getId()).toBe(ItemId.RifleAk);
    expect(ak.getSlot()).toBe(InventorySlot.SLOT_PRIMARY);
    expect(ak.getType()).toBe(ItemType.TYPE_WEAPON_PRIMARY);
    expect(ak.getPrice()).toBe(2700);
    expect(ak.getMaxBuyCount()).toBe(5);
    expect(ak.getMaxQuantity()).toBe(1);
    expect(ak.getQuantity()).toBe(1);
    expect(ak.getScopeLevel()).toBe(0);
    expect(ak.isUserDroppable()).toBe(true);
    expect(ak.canBeEquipped()).toBe(true);
    expect(ak.canAttack(5)).toBe(false); // not equipped
    expect(ak.toArray()).toEqual({ id: ItemId.RifleAk, slot: InventorySlot.SLOT_PRIMARY });
    expect(ak.canPurchaseMultipleTime(new RifleAk())).toBe(true);
    ak.setSkinId(123);
    expect(ak.getSkinId()).toBe(123);

    const knife = new Knife();
    expect(knife.isUserDroppable()).toBe(false);
    expect(() => knife.clone()).toThrow(GameException);
    // non-weapon items throw in Item::canPurchaseMultipleTime (PHP match default)
    expect(() => new Decoy().canPurchaseMultipleTime(new Decoy())).toThrow(GameException);
});

test("item equip event flow", () => {
    const ak = new RifleAk();
    expect(ak.isEquipped()).toBe(false);
    const event = ak.equip();
    expect(event).not.toBeNull();
    expect(ak.isEquipped()).toBe(false);

    // equipReadyTimeMs 800 -> 40 ticks at tick rate 20; callback fires on 41st process
    for (let tick = 0; tick <= 40; tick++) {
        event.process(tick);
    }
    expect(ak.isEquipped()).toBe(true);
    expect(ak.canAttack(50)).toBe(true);

    ak.unEquip();
    expect(ak.isEquipped()).toBe(false);
    expect(ak.canAttack(51)).toBe(false);

    // non-equippable items return null from equip()
    expect(new Kevlar(false).equip()).toBeNull();
});
