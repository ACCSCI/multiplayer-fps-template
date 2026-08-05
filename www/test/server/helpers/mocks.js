import { ArmorType, ItemType } from "../../../assets/js/server/enums.js";
import { Point } from "../../../assets/js/server/point.js";

/**
 * Mock Player/Sight/Game/Weapon used by the unit tests until the real
 * Player/Game/weapon implementations are integrated into the tests.
 * They implement exactly the duck-typed methods the tested classes call.
 */
export class MockSight {
    constructor() {
        this.h = 0;
        this.v = 0;
    }

    getRotationHorizontal() {
        return this.h;
    }

    getRotationVertical() {
        return this.v;
    }

    look(horizontal, vertical) {
        this.h = horizontal;
        this.v = vertical;
    }

    lookHorizontal(horizontal) {
        this.h = horizontal;
    }
}

export class MockPlayer {
    constructor(id = 1, position = new Point(), headHeight = 190, armorType = ArmorType.NONE) {
        this.id = id;
        this.position = position;
        this.headHeight = headHeight;
        this.armorType = armorType;
        this.health = 100;
        this.armor = 0;
        this.attackerSide = true;
        this.sight = new MockSight();
    }

    getId() {
        return this.id;
    }

    getReferenceToPosition() {
        return this.position;
    }

    getPositionClone() {
        return this.position.clone();
    }

    /** Copies the given point (PHP Player::setPosition semantics). */
    setPosition(point) {
        this.position.setFrom(point);
    }

    getSight() {
        return this.sight;
    }

    getHeadHeight() {
        return this.headHeight;
    }

    setHeadHeight(height) {
        this.headHeight = height;
    }

    getArmorType() {
        return this.armorType;
    }

    setArmorType(type) {
        this.armorType = type;
    }

    isPlayingOnAttackerSide() {
        return this.attackerSide;
    }

    isAlive() {
        return this.health > 0;
    }

    lowerHealth(amount) {
        this.health -= amount;
        if (this.health <= 0) {
            this.health = 0;
        }
    }

    lowerArmor(amount) {
        this.armor += amount;
    }

    getBoundingRadius() {
        return 60;
    }
}

export class MockGame {
    constructor(players) {
        this.players = players;
    }

    getPlayers() {
        return this.players;
    }

    getPlayer(id) {
        return this.players.find((player) => player.getId() === id);
    }
}

export class MockWeapon {
    static rangeMaxDamage = 500;
    static range = 900;
    static damage = 20;

    constructor(type = ItemType.TYPE_WEAPON_PRIMARY, killAward = 300) {
        this.type = type;
        this.killAward = killAward;
        this.damageValue = 20;
    }

    getDamageValue(_hitBoxType, _armorType) {
        return this.damageValue;
    }

    getKillAward() {
        return this.killAward;
    }

    getType() {
        return this.type;
    }
}
