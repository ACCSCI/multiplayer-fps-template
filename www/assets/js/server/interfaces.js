/**
 * Port of server/src/Interface/*.php (10 interfaces).
 *
 * JS has no `interface` keyword. Each PHP interface is represented as a frozen
 * contract object: `{ name, methods, extends }`. Classes "implement" a
 * contract simply by defining the methods it requires (PHP checks this at
 * compile time, JS resolves it at call time - duck typing). The JSDoc on the
 * implementing classes documents the contract name, e.g. `@implements
 * {Volumetric}`. hasContract() offers an optional runtime check.
 *
 * Inheritance is mirrored: Flammable extends Volumetric.
 */

/** @type {readonly string[]} PHP Attackable: fire(), applyRecoil(), getTickId() */
export const Attackable = Object.freeze({
    name: "Attackable",
    methods: ["fire", "applyRecoil", "getTickId"],
});

/** @type {readonly string[]} PHP AttackEnable: attack(), attackSecondary(), getDamageValue(), getKillAward(), getType(), getId(), createBullet() */
export const AttackEnable = Object.freeze({
    name: "AttackEnable",
    methods: ["attack", "attackSecondary", "getDamageValue", "getKillAward", "getType", "getId", "createBullet"],
});

export const Volumetric = Object.freeze({
    name: "Volumetric",
    methods: ["getSpawnAreaMetersSquared", "getMaxTimeMs", "getMaxAreaMetersSquared"],
});

/** PHP: interface Flammable extends Volumetric */
export const Flammable = Object.freeze({
    name: "Flammable",
    methods: ["getBoundingRadius", "calculateDamage"],
    extends: [Volumetric],
});

/** PHP: empty marker interface (marks items limited to one per round) */
export const ForOneRoundMax = Object.freeze({
    name: "ForOneRoundMax",
    methods: [],
});

export const HitIntersect = Object.freeze({
    name: "HitIntersect",
    methods: ["intersect"],
});

export const Hittable = Object.freeze({
    name: "Hittable",
    methods: ["getHitAntiForce", "getMoneyAward", "playerWasKilled", "getPlayer", "wasHeadShot", "getDamage"],
});

export const NetSerializable = Object.freeze({
    name: "NetSerializable",
    methods: ["serialize", "getCode"],
});

export const Reloadable = Object.freeze({
    name: "Reloadable",
    methods: ["reload"],
});

export const ScopeItem = Object.freeze({
    name: "ScopeItem",
    methods: ["scope", "isScopedIn"],
});

/**
 * Runtime check that an object exposes all methods of a contract
 * (PHP `instanceof Interface` equivalent; interface extension is implied
 * because the parent contract's methods are a subset of the child's).
 */
export function hasContract(obj, contract) {
    return contract.methods.every((method) => typeof obj[method] === "function");
}
