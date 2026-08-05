import { getTickRate } from "./util.js";

/**
 * Port of server/src/Core/Setting.php
 * PHP static-only class -> ESM exported functions with module-level state.
 * Derived constants are lazily computed from the current tick rate and cached.
 * NOTE: caches are cleared on loadConstants() only (matching PHP). Call
 * setTickRate() before the first derived-constant access, or clear the caches
 * via loadConstants(getDataArray()) afterwards.
 */
const defaultConstant = Object.freeze({
    moveOneMs: 0.6,
    moveWalkOneMs: 0.34,
    moveCrouchOneMs: 0.2,
    fallAmountOneMs: 1,
    crouchDurationMs: 250,
    jumpDurationMs: 420,
    jumpMovementSpeedMultiplier: 1.0,
    flyingMovementSpeedMultiplier: 0.8,
    throwSpeed: 40,

    playerVelocity: 100,
    playerHeadRadius: 10,
    playerBoundingRadius: 60,
    playerJumpHeight: 170,
    playerHeadHeightStand: 190,
    playerHeadHeightCrouch: 140,
    playerObstacleOvercomeHeight: 30,
    playerFallDamageThreshold: 500,
});

let data = { ...defaultConstant };

/** @type {Record<string, number>} */
const cacheInt = {};
/** @type {Record<string, number>} */
const cacheFloat = {};

/** PHP isset() on the cache: key present with a non-null value. */
function isCached(cache, key) {
    return key in cache;
}

export function loadConstants(constants) {
    for (const key of Object.keys(cacheInt)) {
        delete cacheInt[key];
    }
    for (const key of Object.keys(cacheFloat)) {
        delete cacheFloat[key];
    }

    const merged = { ...constants };
    // BC code
    merged.playerVelocity = merged.playerVelocity ?? 0;
    for (const [key, defaultValue] of Object.entries(defaultConstant)) {
        if (key in merged) {
            continue;
        }
        merged[key] = defaultValue;
    }
    data = merged;
}

export function tickCountCrouch() {
    if (!isCached(cacheInt, "tickCountCrouch")) {
        cacheInt.tickCountCrouch = Math.ceil(data.crouchDurationMs / getTickRate());
    }
    return cacheInt.tickCountCrouch;
}

export function fallAmountPerTick() {
    if (!isCached(cacheInt, "fallAmountPerTick")) {
        cacheInt.fallAmountPerTick = Math.ceil(data.fallAmountOneMs * getTickRate());
    }
    return cacheInt.fallAmountPerTick;
}

export function jumpDistancePerTick() {
    if (!isCached(cacheInt, "jumpDistancePerTick")) {
        cacheInt.jumpDistancePerTick = Math.ceil(playerJumpHeight() / tickCountJump());
    }
    return cacheInt.jumpDistancePerTick;
}

export function crouchDistancePerTick() {
    if (!isCached(cacheInt, "crouchDistancePerTick")) {
        cacheInt.crouchDistancePerTick = Math.ceil(
            (playerHeadHeightStand() - playerHeadHeightCrouch()) / tickCountCrouch(),
        );
    }
    return cacheInt.crouchDistancePerTick;
}

export function tickCountJump() {
    if (!isCached(cacheInt, "tickCountJump")) {
        cacheInt.tickCountJump = Math.ceil(data.jumpDurationMs / getTickRate());
    }
    return cacheInt.tickCountJump;
}

export function moveDistancePerTick() {
    if (!isCached(cacheInt, "moveDistancePerTick")) {
        cacheInt.moveDistancePerTick = Math.ceil(data.moveOneMs * getTickRate());
    }
    return cacheInt.moveDistancePerTick;
}

export function moveDistanceWalkPerTick() {
    if (!isCached(cacheInt, "moveDistanceWalkPerTick")) {
        cacheInt.moveDistanceWalkPerTick = Math.ceil(data.moveWalkOneMs * getTickRate());
    }
    return cacheInt.moveDistanceWalkPerTick;
}

export function moveDistanceCrouchPerTick() {
    if (!isCached(cacheInt, "moveDistanceCrouchPerTick")) {
        cacheInt.moveDistanceCrouchPerTick = Math.ceil(data.moveCrouchOneMs * getTickRate());
    }
    return cacheInt.moveDistanceCrouchPerTick;
}

export function jumpMovementSpeedMultiplier() {
    if (!isCached(cacheFloat, "jumpMovementSpeedMultiplier")) {
        cacheFloat.jumpMovementSpeedMultiplier = data.jumpMovementSpeedMultiplier;
    }
    return cacheFloat.jumpMovementSpeedMultiplier;
}

export function flyingMovementSpeedMultiplier() {
    if (!isCached(cacheFloat, "flyingMovementSpeedMultiplier")) {
        cacheFloat.flyingMovementSpeedMultiplier = data.flyingMovementSpeedMultiplier;
    }
    return cacheFloat.flyingMovementSpeedMultiplier;
}

export function getWeaponPrimarySpeedMultiplier(itemId) {
    const key = `getWeaponPrimarySpeedMultiplier-${itemId}`;
    if (!isCached(cacheFloat, key)) {
        cacheFloat[key] = data[`weaponPrimarySpeedMultiplier-${itemId}`] ?? 0.6;
    }
    return cacheFloat[key];
}

export function getWeaponSecondarySpeedMultiplier(itemId) {
    const key = `getWeaponSecondarySpeedMultiplier-${itemId}`;
    if (!isCached(cacheFloat, key)) {
        cacheFloat[key] = data[`weaponSecondarySpeedMultiplier-${itemId}`] ?? 0.8;
    }
    return cacheFloat[key];
}

export function throwSpeed() {
    return data.throwSpeed;
}

export function playerHeadRadius() {
    return data.playerHeadRadius;
}

export function playerBoundingRadius() {
    return data.playerBoundingRadius;
}

export function playerVelocity() {
    return data.playerVelocity;
}

export function playerJumpHeight() {
    return data.playerJumpHeight;
}

export function playerHeadHeightStand() {
    return data.playerHeadHeightStand;
}

export function playerHeadHeightCrouch() {
    return data.playerHeadHeightCrouch;
}

export function playerObstacleOvercomeHeight() {
    return data.playerObstacleOvercomeHeight;
}

export function playerFallDamageThreshold() {
    return data.playerFallDamageThreshold;
}

export function getDataArray() {
    return data;
}
