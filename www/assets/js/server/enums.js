/**
 * Ports of server/src/Enum/*.php (12 enums) and server/src/Event/EventList.php.
 * PHP enum methods are exported as plain functions taking the enum value.
 */

// server/src/Event/EventList.php
export const EventList = Object.freeze({
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

// server/src/Enum/GameOverReason.php
export const GameOverReason = Object.freeze({
    REASON_NOT_ALL_PLAYERS_CONNECTED: 1,
    ATTACKERS_WINS: 2,
    DEFENDERS_WINS: 3,
    TIE: 4,
    ATTACKERS_SURRENDER: 5,
    DEFENDERS_SURRENDER: 6,
    SERVER_ERROR: 9,
});

// server/src/Enum/PauseReason.php
export const PauseReason = Object.freeze({
    FREEZE_TIME: 1,
    TIMEOUT_ATTACKERS: 2,
    TIMEOUT_DEFENDERS: 3,
    HALF_TIME: 4,
});

// server/src/Enum/RoundEndReason.php
export const RoundEndReason = Object.freeze({
    ALL_ENEMIES_ELIMINATED: 0,
    TIME_RUNS_OUT: 1,
    BOMB_DEFUSED: 2,
    BOMB_EXPLODED: 3,
});

// server/src/Enum/Color.php
export const Color = Object.freeze({
    BLUE: 1,
    GREEN: 2,
    YELLOW: 3,
    PURPLE: 4,
    ORANGE: 5,
});

// server/src/Enum/SoundType.php
export const SoundType = Object.freeze({
    PLAYER_GROUND_TOUCH: 0,
    PLAYER_STEP: 1,
    ITEM_ATTACK: 2,
    ITEM_ATTACK2: 3,
    FLAME_SPAWN: 4,
    ITEM_BUY: 5,
    BULLET_HIT: 6,
    PLAYER_DEAD: 7,
    ITEM_RELOAD: 8,
    BULLET_HIT_HEADSHOT: 9,
    ATTACK_NO_AMMO: 10,
    BOMB_PLANTED: 11,
    BOMB_PLANTING: 12,
    BOMB_EXPLODED: 13,
    BOMB_DEFUSING: 14,
    BOMB_DEFUSED: 15,
    ITEM_PICKUP: 16,
    GRENADE_LAND: 17,
    GRENADE_BOUNCE: 18,
    GRENADE_AIR: 19,
    ITEM_DROP_AIR: 20,
    ITEM_DROP_LAND: 21,
    FLAME_EXTINGUISH: 22,
    FLAME_PLAYER_HIT: 23,
    SMOKE_SPAWN: 24,
    SMOKE_FADE: 25,
});

// server/src/Enum/ArmorType.php
export const ArmorType = Object.freeze({
    NONE: 0,
    BODY: 1,
    BODY_AND_HEAD: 2,
});

export function hasArmorHead(type) {
    return type === ArmorType.BODY_AND_HEAD;
}

export function hasArmorBody(type) {
    return type === ArmorType.BODY;
}

export function hasNoArmor(type) {
    return type === ArmorType.NONE;
}

// server/src/Enum/BuyMenuItem.php
export const BuyMenuItem = Object.freeze({
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

// server/src/Enum/InventorySlot.php
export const InventorySlot = Object.freeze({
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

/** @returns int[] PHP InventorySlot::getGrenadeSlotIds() */
export function getGrenadeSlotIds() {
    return [
        InventorySlot.SLOT_GRENADE_SMOKE,
        InventorySlot.SLOT_GRENADE_MOLOTOV,
        InventorySlot.SLOT_GRENADE_HE,
        InventorySlot.SLOT_GRENADE_FLASH,
        InventorySlot.SLOT_GRENADE_DECOY,
    ];
}

// server/src/Enum/ItemId.php
export const ItemId = Object.freeze({
    SOLID_SURFACE: 0,
    BOMB: 50,

    SolidSurface: 0,
    Knife: 1,
    PistolGlock: 2,
    PistolP250: 3,
    PistolUsp: 4,
    RifleAk: 5,
    RifleM4A4: 6,
    RifleAWP: 7,

    Decoy: 30,
    Flashbang: 31,
    HighExplosive: 32,
    Incendiary: 33,
    Kevlar: 34,
    Molotov: 35,
    Smoke: 36,

    Bomb: 50,
    DefuseKit: 51,
});

// server/src/Enum/ItemType.php
export const ItemType = Object.freeze({
    TYPE_KNIFE: 0,
    TYPE_WEAPON_PRIMARY: 1,
    TYPE_WEAPON_SECONDARY: 2,
    TYPE_BOMB: 5,
    TYPE_DEFUSE_KIT: 6,
    TYPE_GRENADE: 7,
    TYPE_KEVLAR: 8,
});

// server/src/Enum/HitBoxType.php
export const HitBoxType = Object.freeze({
    HEAD: 1,
    CHEST: 2,
    STOMACH: 3,
    LEG: 4,
    BACK: 5,
});

// server/src/Enum/RampDirection.php (pure enum: no backing int values)
export const RampDirection = Object.freeze({
    GROW_TO_POSITIVE_X: "GROW_TO_POSITIVE_X",
    GROW_TO_POSITIVE_Z: "GROW_TO_POSITIVE_Z",
    GROW_TO_NEGATIVE_X: "GROW_TO_NEGATIVE_X",
    GROW_TO_NEGATIVE_Z: "GROW_TO_NEGATIVE_Z",
});

export function isOnXAxis(direction) {
    return direction === RampDirection.GROW_TO_POSITIVE_X || direction === RampDirection.GROW_TO_NEGATIVE_X;
}

export function growToPositive(direction) {
    return direction === RampDirection.GROW_TO_POSITIVE_X || direction === RampDirection.GROW_TO_POSITIVE_Z;
}
