import { expect, test } from "bun:test";
import {
    ArmorType,
    BuyMenuItem,
    Color,
    EventList,
    GameOverReason,
    getGrenadeSlotIds,
    growToPositive,
    HitBoxType,
    hasArmorBody,
    hasArmorHead,
    hasNoArmor,
    InventorySlot,
    ItemId,
    ItemType,
    isOnXAxis,
    PauseReason,
    RampDirection,
    RoundEndReason,
    SoundType,
} from "../../assets/js/server/enums.js";

test("enums values match PHP sources", () => {
    expect(EventList).toEqual({
        unknown: 0,
        GameOverEvent: 1,
        PauseStartEvent: 2,
        PauseEndEvent: 3,
        RoundStartEvent: 4,
        RoundEndEvent: 5,
        GameStartEvent: 6,
        RoundEndCoolDownEvent: 7,
        KillEvent: 8,
        SoundEvent: 9,
        PlantEvent: 10,
        ThrowEvent: 11,
        DropEvent: 12,
        GrillEvent: 13,
        SmokeEvent: 14,
    });
    expect(GameOverReason).toEqual({
        REASON_NOT_ALL_PLAYERS_CONNECTED: 1,
        ATTACKERS_WINS: 2,
        DEFENDERS_WINS: 3,
        TIE: 4,
        ATTACKERS_SURRENDER: 5,
        DEFENDERS_SURRENDER: 6,
        SERVER_ERROR: 9,
    });
    expect(PauseReason).toEqual({ FREEZE_TIME: 1, TIMEOUT_ATTACKERS: 2, TIMEOUT_DEFENDERS: 3, HALF_TIME: 4 });
    expect(RoundEndReason).toEqual({ ALL_ENEMIES_ELIMINATED: 0, TIME_RUNS_OUT: 1, BOMB_DEFUSED: 2, BOMB_EXPLODED: 3 });
    expect(Color).toEqual({ BLUE: 1, GREEN: 2, YELLOW: 3, PURPLE: 4, ORANGE: 5 });
    expect(ArmorType).toEqual({ NONE: 0, BODY: 1, BODY_AND_HEAD: 2 });
    expect(BuyMenuItem).toEqual({
        RIFLE_AK: 1,
        GRENADE_FLASH: 2,
        GRENADE_SMOKE: 3,
        GRENADE_MOLOTOV: 4,
        GRENADE_HE: 5,
        GRENADE_DECOY: 6,
        RIFLE_M4A4: 7,
        PISTOL_USP: 8,
        PISTOL_P250: 9,
        KEVLAR_BODY_AND_HEAD: 10,
        PISTOL_GLOCK: 11,
        KEVLAR_BODY: 12,
        GRENADE_INCENDIARY: 13,
        DEFUSE_KIT: 14,
        RIFLE_AWP: 15,
    });
    expect(InventorySlot).toEqual({
        SLOT_KNIFE: 0,
        SLOT_PRIMARY: 1,
        SLOT_SECONDARY: 2,
        SLOT_BOMB: 3,
        SLOT_GRENADE_DECOY: 4,
        SLOT_GRENADE_MOLOTOV: 5,
        SLOT_GRENADE_SMOKE: 6,
        SLOT_GRENADE_FLASH: 7,
        SLOT_GRENADE_HE: 8,
        SLOT_TASER: 9,
        SLOT_KEVLAR: 10,
        SLOT_KIT: 11,
    });
    expect(ItemType).toEqual({
        TYPE_KNIFE: 0,
        TYPE_WEAPON_PRIMARY: 1,
        TYPE_WEAPON_SECONDARY: 2,
        TYPE_BOMB: 5,
        TYPE_DEFUSE_KIT: 6,
        TYPE_GRENADE: 7,
        TYPE_KEVLAR: 8,
    });
    expect(HitBoxType).toEqual({ HEAD: 1, CHEST: 2, STOMACH: 3, LEG: 4, BACK: 5 });
});

test("enums frozen", () => {
    expect(Object.isFrozen(EventList)).toBe(true);
    expect(Object.isFrozen(ItemId)).toBe(true);
    expect(Object.isFrozen(SoundType)).toBe(true);
    expect(Object.isFrozen(RampDirection)).toBe(true);
});

test("ItemId values", () => {
    expect(ItemId.SOLID_SURFACE).toBe(0);
    expect(ItemId.SolidSurface).toBe(0);
    expect(ItemId.Knife).toBe(1);
    expect(ItemId.PistolGlock).toBe(2);
    expect(ItemId.PistolP250).toBe(3);
    expect(ItemId.PistolUsp).toBe(4);
    expect(ItemId.RifleAk).toBe(5);
    expect(ItemId.RifleM4A4).toBe(6);
    expect(ItemId.RifleAWP).toBe(7);
    expect(ItemId.Decoy).toBe(30);
    expect(ItemId.Flashbang).toBe(31);
    expect(ItemId.HighExplosive).toBe(32);
    expect(ItemId.Incendiary).toBe(33);
    expect(ItemId.Kevlar).toBe(34);
    expect(ItemId.Molotov).toBe(35);
    expect(ItemId.Smoke).toBe(36);
    expect(ItemId.BOMB).toBe(50);
    expect(ItemId.Bomb).toBe(50);
    expect(ItemId.DefuseKit).toBe(51);
});

test("SoundType values", () => {
    expect(SoundType.PLAYER_GROUND_TOUCH).toBe(0);
    expect(SoundType.PLAYER_STEP).toBe(1);
    expect(SoundType.ITEM_ATTACK).toBe(2);
    expect(SoundType.ITEM_ATTACK2).toBe(3);
    expect(SoundType.FLAME_SPAWN).toBe(4);
    expect(SoundType.ITEM_BUY).toBe(5);
    expect(SoundType.BULLET_HIT).toBe(6);
    expect(SoundType.PLAYER_DEAD).toBe(7);
    expect(SoundType.ITEM_RELOAD).toBe(8);
    expect(SoundType.BULLET_HIT_HEADSHOT).toBe(9);
    expect(SoundType.ATTACK_NO_AMMO).toBe(10);
    expect(SoundType.BOMB_PLANTED).toBe(11);
    expect(SoundType.BOMB_PLANTING).toBe(12);
    expect(SoundType.BOMB_EXPLODED).toBe(13);
    expect(SoundType.BOMB_DEFUSING).toBe(14);
    expect(SoundType.BOMB_DEFUSED).toBe(15);
    expect(SoundType.ITEM_PICKUP).toBe(16);
    expect(SoundType.GRENADE_LAND).toBe(17);
    expect(SoundType.GRENADE_BOUNCE).toBe(18);
    expect(SoundType.GRENADE_AIR).toBe(19);
    expect(SoundType.ITEM_DROP_AIR).toBe(20);
    expect(SoundType.ITEM_DROP_LAND).toBe(21);
    expect(SoundType.FLAME_EXTINGUISH).toBe(22);
    expect(SoundType.FLAME_PLAYER_HIT).toBe(23);
    expect(SoundType.SMOKE_SPAWN).toBe(24);
    expect(SoundType.SMOKE_FADE).toBe(25);
});

test("enum helper functions", () => {
    expect(hasArmorHead(ArmorType.BODY_AND_HEAD)).toBe(true);
    expect(hasArmorHead(ArmorType.BODY)).toBe(false);
    expect(hasArmorHead(ArmorType.NONE)).toBe(false);
    expect(hasArmorBody(ArmorType.BODY)).toBe(true);
    expect(hasArmorBody(ArmorType.BODY_AND_HEAD)).toBe(false);
    expect(hasNoArmor(ArmorType.NONE)).toBe(true);
    expect(hasNoArmor(ArmorType.BODY)).toBe(false);

    expect(getGrenadeSlotIds()).toEqual([
        InventorySlot.SLOT_GRENADE_SMOKE,
        InventorySlot.SLOT_GRENADE_MOLOTOV,
        InventorySlot.SLOT_GRENADE_HE,
        InventorySlot.SLOT_GRENADE_FLASH,
        InventorySlot.SLOT_GRENADE_DECOY,
    ]);

    expect(isOnXAxis(RampDirection.GROW_TO_POSITIVE_X)).toBe(true);
    expect(isOnXAxis(RampDirection.GROW_TO_NEGATIVE_X)).toBe(true);
    expect(isOnXAxis(RampDirection.GROW_TO_POSITIVE_Z)).toBe(false);
    expect(growToPositive(RampDirection.GROW_TO_POSITIVE_X)).toBe(true);
    expect(growToPositive(RampDirection.GROW_TO_POSITIVE_Z)).toBe(true);
    expect(growToPositive(RampDirection.GROW_TO_NEGATIVE_X)).toBe(false);
});
