import { expect, test } from "bun:test";
import { Box } from "../../assets/js/server/box.js";
import { Bullet } from "../../assets/js/server/bullet.js";
import { ArmorType, HitBoxType, ItemType } from "../../assets/js/server/enums.js";
import { Floor } from "../../assets/js/server/floor.js";
import { GameException } from "../../assets/js/server/game_exception.js";
import { HitBox } from "../../assets/js/server/hit_box.js";
import { BallCollider } from "../../assets/js/server/hit_geometry/ball_collider.js";
import { HitBoxBack } from "../../assets/js/server/hit_geometry/hit_box_back.js";
import { HitBoxChest } from "../../assets/js/server/hit_geometry/hit_box_chest.js";
import { HitBoxHead } from "../../assets/js/server/hit_geometry/hit_box_head.js";
import { HitBoxLegs } from "../../assets/js/server/hit_geometry/hit_box_legs.js";
import { HitBoxStomach } from "../../assets/js/server/hit_geometry/hit_box_stomach.js";
import { SphereHitBox } from "../../assets/js/server/hit_geometry/sphere_hit_box.js";
import { Point } from "../../assets/js/server/point.js";
import { movementXYZ, roundHalfAwayFromZero } from "../../assets/js/server/util.js";
import { Wall } from "../../assets/js/server/wall.js";
import { World } from "../../assets/js/server/world/index.js";
import { MockPlayer, MockWeapon } from "./helpers/mocks.js";

/** PHP assertPositionSame(new Point(x, y, z), point). */
function expectPoint(point, x, y, z) {
    expect([point.x, point.y, point.z]).toEqual([x, y, z]);
}

/** PHP TestMap: giant floor at y=0 and two boundary walls. */
class MockTestMap {
    getWalls() {
        return [
            new Wall(new Point(0, 0, -1), true, 99999).setPenetrable(false),
            new Wall(new Point(-1, 0, 0), false, 99999).setPenetrable(false),
        ];
    }

    getFloors() {
        return [new Floor(new Point(), 99999, 99999).setPenetrable(false)];
    }
}

function createWorld() {
    const world = new World({ bomb: null });
    world.loadMap(new MockTestMap());
    return world;
}

test("SphereHitBox world point origin", () => {
    const y = 1;
    const sphere = new SphereHitBox(new Point(49, y, 9), 38);
    const player = new MockPlayer();
    const data = new Map([
        [-90, [-9, 49]],
        [0, [49, 9]],
        [360, [49, 9]],
        [1, [49, 8]],
        [20, [49, -8]],
        [30, [47, -17]],
        [45, [41, -28]],
        [57, [34, -36]],
        [79, [18, -46]],
        [90, [9, -49]],
        [94, [6, -50]],
        [131, [-25, -43]],
        [169, [-46, -18]],
        [180, [-49, -9]],
        [191, [-50, 1]],
        [232, [-37, 33]],
        [240, [-32, 38]],
        [-120, [-32, 38]],
        [269, [-10, 49]],
        [270, [-9, 49]],
        [290, [8, 49]],
        [322, [33, 37]],
        [358, [49, 11]],
    ]);

    for (const [angle, xz] of data) {
        player.getSight().lookHorizontal(angle);
        expectPoint(sphere.calculateWorldCoordinate(player), xz[0], y, xz[1]);
    }
});

test("SphereHitBox invalid radius", () => {
    expect(() => new SphereHitBox(new Point(), 0)).toThrow(/bigger than zero/i);
    expect(() => new SphereHitBox(new Point(), 0)).toThrow(GameException);
    expect(() => new SphereHitBox(new Point(), -2)).toThrow(/bigger than zero/i);
    expect(() => new SphereHitBox(new Point(), -2)).toThrow(GameException);
});

test("SphereHitBox world point center", () => {
    const sphere = new SphereHitBox(new Point(-45, 12, 32), 38);
    const player = new MockPlayer();
    const y = -8;
    const data = new Map([
        [45, [6, 62]],
        [65, [25, 62]],
        [149, [70, 4]],
        [192, [52, -33]],
        [322, [-40, 6]],
    ]);

    for (const [angle, xz] of data) {
        player.getSight().lookHorizontal(angle);
        expectPoint(sphere.calculateWorldCoordinate(player, new Point(15, -20, 8)), xz[0], y, xz[1]);
    }
});

test("SphereHitBox world point center modifier", () => {
    const sphere = new SphereHitBox(new Point(-45, 12, 32), 38);
    const player = new MockPlayer();
    player.getSight().lookHorizontal(45);
    expectPoint(sphere.calculateWorldCoordinate(player, new Point(15, -20, 8)), 6, -8, 62);
});

test("SphereHitBox world coordinate", () => {
    const sphere = new SphereHitBox(new Point(0, 0, 0), 30);
    const player = new MockPlayer();
    player.getSight().lookHorizontal(108);
    const point = sphere.calculateWorldCoordinate(player, new Point(1440, 0, 1457));
    expect([point.x, point.y, point.z]).not.toEqual([499, 0, 3277]);
});

test("SphereHitBox intersect", () => {
    const sphere = new SphereHitBox(new Point(-45, 12, 32), 38);
    const player = new MockPlayer();

    expect(sphere.intersect(player, new Point(-10, -8, 67))).toBe(false);
    player.getSight().lookHorizontal(10);
    expect(sphere.intersect(player, new Point(-10, -8, 67))).toBe(false);
    player.getSight().lookHorizontal(20);
    expect(sphere.intersect(player, new Point(-10, -8, 67))).toBe(true);
});

test("HitBoxHead geometry", () => {
    const head = new HitBoxHead();
    expect(head.getParts(new MockPlayer())).toHaveLength(7);
    const player = new MockPlayer(1, new Point(), 190);
    expect(head.intersect(player, new Point(0, 182, 1))).toBe(true);
    expect(head.intersect(player, new Point(100, 180, 100))).toBe(false);
});

test("HitBoxChest geometry", () => {
    const chest = new HitBoxChest();
    expect(chest.getParts(new MockPlayer())).toHaveLength(46);
    const player = new MockPlayer(1, new Point(), 190);
    expect(chest.intersect(player, new Point(0, 160, -1))).toBe(true);
    expect(chest.intersect(player, new Point(100, 160, 100))).toBe(false);
});

test("HitBoxBack geometry", () => {
    const back = new HitBoxBack();
    expect(back.getParts(new MockPlayer())).toHaveLength(32);
    const player = new MockPlayer(1, new Point(), 190);
    expect(back.intersect(player, new Point(-9, 119, -4))).toBe(true);
    expect(back.intersect(player, new Point(100, 119, 100))).toBe(false);
});

test("HitBoxStomach geometry", () => {
    const stomach = new HitBoxStomach();
    expect(stomach.getParts(new MockPlayer())).toHaveLength(20);
    const player = new MockPlayer(1, new Point(), 190);
    expect(stomach.intersect(player, new Point(-2, 111, 10))).toBe(true);
    expect(stomach.intersect(player, new Point(100, 111, 100))).toBe(false);
});

test("HitBoxLegs geometry per head height", () => {
    const legs = new HitBoxLegs();
    const player = new MockPlayer();
    // exact step heights
    expect(legs.getParts(new MockPlayer(1, new Point(), 140))).toHaveLength(38);
    expect(legs.getParts(new MockPlayer(1, new Point(), 165))).toHaveLength(38);
    expect(legs.getParts(new MockPlayer(1, new Point(), 175))).toHaveLength(42);
    expect(legs.getParts(new MockPlayer(1, new Point(), 190))).toHaveLength(50);
    // interpolated heights snap to the closest step (ties go to the first: 140, 165, 175, 190)
    expect(legs.getParts(new MockPlayer(1, new Point(), 152))).toHaveLength(38);
    expect(legs.getParts(new MockPlayer(1, new Point(), 153))).toHaveLength(38);
    expect(legs.getParts(new MockPlayer(1, new Point(), 168))).toHaveLength(38);
    expect(legs.getParts(new MockPlayer(1, new Point(), 171))).toHaveLength(42);
    expect(legs.getParts(new MockPlayer(1, new Point(), 182))).toHaveLength(42);
    expect(legs.getParts(new MockPlayer(1, new Point(), 183))).toHaveLength(50);
    // geometry is relative to the player position (not head height)
    const crouched = new MockPlayer(1, new Point(), 140);
    expect(legs.intersect(crouched, new Point(17, 5, 28))).toBe(true);
    expect(legs.intersect(player, new Point(16, 18, -5))).toBe(true);
    expect(legs.intersect(player, new Point(100, 5, 100))).toBe(false);
});

test("BallCollider resolution 1", () => {
    const radius = 2;
    const angleHorizontal = 0.0;
    const angleVertical = -90.0;
    const start = new Point(10, 10, 0);
    const resolutionPoint = new Point(10, 4, 0);

    const world = createWorld();
    const ball = new BallCollider(world, start, radius, angleHorizontal, angleVertical);
    world.addBox(new Box(new Point(9), 1, 1, 1));
    world.addBox(new Box(new Point(10), 1, 1, 1));
    world.addBox(new Box(new Point(11), 1, 1, 1));

    runCollision(ball, start, angleHorizontal, angleVertical);
    expectPoint(ball.getLastValidPosition(), resolutionPoint.x, resolutionPoint.y, resolutionPoint.z);
    expect(ball.getResolutionAngleHorizontal()).toBe(angleHorizontal);
    expect(ball.getResolutionAngleVertical()).toBe(90.0);
});

function runCollision(ball, start, angleHorizontal, angleVertical) {
    const candidate = start.clone();
    for (let distance = 1; distance <= 128; distance++) {
        candidate.setFrom(start);
        candidate.addFromArray(movementXYZ(angleHorizontal, angleVertical, distance));
        if (ball.hasCollision(candidate)) {
            return;
        }
    }

    throw new Error(`No '${start}' collision detected`);
}

test("BallCollider resolution 2", () => {
    const radius = 2;
    const angleHorizontal = 27;
    const angleVertical = 45.0;
    const start = new Point(14, radius, 0);
    const extreme = start.clone();

    const world = createWorld();
    const ball = new BallCollider(world, start, radius, angleHorizontal, angleVertical);
    expectPoint(ball.getLastExtremePosition(), extreme.x, extreme.y, extreme.z);
    expect(ball.hasCollision(start.addPart(-2, 3, 0))).toBe(false);
    expectPoint(ball.getLastExtremePosition(), extreme.x, extreme.y, extreme.z);
    expect(ball.hasCollision(start.addPart(-2, 3, 0))).toBe(false);
    expectPoint(ball.getLastExtremePosition(), extreme.x, extreme.y, extreme.z);
    expect(ball.hasCollision(start.addPart(-2, 2, 0))).toBe(false);
    expectPoint(ball.getLastExtremePosition(), extreme.x, extreme.y, extreme.z);
    expect(ball.hasCollision(start.addPart(-2, 0, 0))).toBe(false);
    expectPoint(ball.getLastExtremePosition(), extreme.x, extreme.y, extreme.z);
    expect(ball.hasCollision(start.addPart(-2, 0, 0))).toBe(false);
    expectPoint(ball.getLastExtremePosition(), extreme.x, extreme.y, extreme.z);
    expect(ball.hasCollision(start.addPart(-2, -2, 0))).toBe(false);
    extreme.setFrom(start);
    expectPoint(ball.getLastExtremePosition(), extreme.x, extreme.y, extreme.z);
    expect(ball.hasCollision(start.addPart(-1, -1, 0))).toBe(true);
    expectPoint(ball.getLastExtremePosition(), start.x, start.y, start.z);
    expectPoint(ball.getLastValidPosition(), radius, radius + 6, 0);
    expect(roundHalfAwayFromZero(ball.getResolutionAngleHorizontal())).toBe(360 - angleHorizontal);
});

function testSingleWallBounce(
    ballCenter,
    ballRadius,
    angleHorizontal,
    angleVertical,
    plane,
    expectedAngleHorizontal,
    expectedAngleVertical,
    expectedCollisionPoint = null,
    maxDistance = 16,
) {
    const world = createWorld();
    let isWall = false;
    if (plane instanceof Floor) {
        world.addFloor(plane);
    } else if (plane instanceof Wall) {
        world.addWall(plane);
        isWall = true;
    } else {
        throw new Error("Unknown plane given");
    }
    const ball = new BallCollider(world, ballCenter, ballRadius, angleHorizontal, angleVertical);

    const candidate = ballCenter.clone();
    for (let distance = 1; distance <= maxDistance; distance++) {
        candidate.setFrom(ballCenter);
        candidate.addFromArray(movementXYZ(angleHorizontal, angleVertical, distance));
        if (!ball.hasCollision(candidate)) {
            continue;
        }

        if (expectedCollisionPoint) {
            expectPoint(candidate, expectedCollisionPoint.x, expectedCollisionPoint.y, expectedCollisionPoint.z);
        }
        expect(roundHalfAwayFromZero(ball.getResolutionAngleHorizontal())).toBe(expectedAngleHorizontal);
        expect(roundHalfAwayFromZero(ball.getResolutionAngleVertical())).toBe(expectedAngleVertical);

        const p = plane.getStart();
        if (isWall) {
            if (plane.getPlane() === "xy") {
                expect(
                    p.clone().addZ(angleHorizontal > 270 || angleHorizontal < 90 ? -ballRadius : +ballRadius).z,
                ).toBe(candidate.z);
            } else {
                expect(p.clone().addX(angleHorizontal > 0 && angleHorizontal < 180 ? -ballRadius : +ballRadius).x).toBe(
                    candidate.x,
                );
            }
        } else {
            if (angleVertical === 0.0) {
                throw new Error("Floor with 0 vertical angle");
            }
            expect(p.clone().addY(angleVertical > 0 ? -ballRadius : +ballRadius).y).toBe(candidate.y);
        }

        return;
    }

    throw new Error(`No collision detected for ${ballCenter}`);
}

test("BallCollider single wall bounce", () => {
    testSingleWallBounce(new Point(5, 5, 11), 4, 0, 90, new Floor(new Point(5, 16, 11)), 0, -90);
    testSingleWallBounce(new Point(5, 15, 11), 3, 0, -90, new Floor(new Point(5, 4, 11)), 0, 90);
    for (let r = 1; r <= 5; r++) {
        testSingleWallBounce(new Point(5, 5, 11), r, 0, 90, new Floor(new Point(5, 16, 11)), 0, -90);
    }
    testSingleWallBounce(new Point(5, 6, 11), 2, 90, -45, new Floor(new Point(5, 2, 11), 9), 90, 45);

    testSingleWallBounce(new Point(5, 5, 0), 3, 0, 0, new Wall(new Point(5, 1, 11), true), 180, 0);
    testSingleWallBounce(new Point(5, 5, 0), 2, 90, 0, new Wall(new Point(11, 0, 0), false), 270, 0);
    for (let r = 1; r <= 5; r++) {
        testSingleWallBounce(new Point(5, 5, 14), r, 180, 0, new Wall(new Point(5, 5, 2), true), 0, 0);
    }
    testSingleWallBounce(new Point(15, 5, 0), 2, 270, 0, new Wall(new Point(4, 2, 0), false), 90, 0);
    testSingleWallBounce(new Point(15, 5, 0), 2, 270, 45, new Wall(new Point(4, 2, 0), false), 90, 45);
});

test("BallCollider single wall angled bounce", () => {
    testSingleWallBounce(
        new Point(5, 15, 5),
        1,
        180,
        10,
        new Wall(new Point(1, 1, 1), true, 100).setNormal(0, 40),
        0,
        -62,
        new Point(5, 16, 2),
    );
    testSingleWallBounce(
        new Point(5, 15, 5),
        1,
        180,
        70,
        new Wall(new Point(1, 1, 1), true, 100).setNormal(0, -10),
        0,
        49,
        new Point(5, 23, 2),
    );
});

test("Bullet lifecycle", () => {
    const weapon = new MockWeapon();
    const bullet = new Bullet(weapon, 100);
    expect(bullet.getDamage()).toBe(1);
    expect(bullet.getDistanceTraveled()).toBe(1);
    expect(bullet.isActive()).toBe(true);
    expect(bullet.getShootItem()).toBe(weapon);
    expect(bullet.getOrigin()).toBe(null);
    expect(bullet.getPosition()).toBe(null);

    bullet.setProperties(50);
    expect(bullet.getDamage()).toBe(50);

    const origin = new Point(1, 2, 3);
    bullet.setOriginPlayer(7, true, origin);
    expect(bullet.getOriginPlayerId()).toBe(7);
    expect(bullet.isOriginPlayerAttackerSide()).toBe(true);
    expect(bullet.getOrigin()).toBe(origin);
    expectPoint(bullet.getPosition(), 1, 2, 3);
    expect(bullet.getPosition()).not.toBe(origin);
    expect(bullet.getPlayerSkipIds()).toEqual({ 7: true });

    bullet.addPlayerIdSkip(9);
    expect(bullet.getPlayerSkipIds()).toEqual({ 7: true, 9: true });

    bullet.lowerDamage(30);
    expect(bullet.getDamage()).toBe(20);
    expect(bullet.isActive()).toBe(true);

    expect(bullet.incrementDistance()).toBe(2);
    expect(bullet.getDistanceTraveled()).toBe(2);

    const position = new Point(10, 20, 30);
    bullet.move(position);
    expectPoint(bullet.getPosition(), 10, 20, 30);

    for (let i = 0; i < 100; i++) {
        bullet.incrementDistance();
    }
    expect(bullet.isActive()).toBe(false);

    const bullet2 = new Bullet(weapon, 100);
    bullet2.setProperties(10);
    bullet2.lowerDamage(10);
    expect(bullet2.getDamage()).toBe(0);
    expect(bullet2.isActive()).toBe(false);
    expect(() => bullet2.lowerDamage(-1)).toThrow();
});

test("HitBox headshot kill", () => {
    const player = new MockPlayer(1, new Point(), 190, ArmorType.NONE);
    const weapon = new MockWeapon(ItemType.TYPE_WEAPON_PRIMARY, 300);
    weapon.damageValue = 100;
    const hitBox = new HitBox(player, HitBoxType.HEAD, new HitBoxHead());

    const bullet = new Bullet(weapon, 1000);
    bullet.setOriginPlayer(1, false, new Point());
    bullet.setProperties(100);

    expect(hitBox.intersect(new Point(0, 182, 1))).toBe(true);
    hitBox.registerHit(bullet);

    expect(player.isAlive()).toBe(false);
    expect(hitBox.playerWasKilled()).toBe(true);
    expect(hitBox.wasHeadShot()).toBe(true);
    expect(hitBox.getDamage()).toBe(100);
    expect(hitBox.getMoneyAward()).toBe(300);
});

test("HitBox team damage", () => {
    const player = new MockPlayer(1, new Point(), 190, ArmorType.NONE);
    player.health = 5;
    const weapon = new MockWeapon(ItemType.TYPE_WEAPON_PRIMARY, 300);
    weapon.damageValue = 20;
    const hitBox = new HitBox(player, HitBoxType.CHEST, new HitBoxChest());

    const bullet = new Bullet(weapon, 1000);
    bullet.setOriginPlayer(1, true, new Point()); // same side as the player
    bullet.setProperties(20);

    hitBox.registerHit(bullet);

    expect(player.health).toBe(0); // 20 halved -> 10 -> 5 - 10
    expect(player.isAlive()).toBe(false);
    expect(hitBox.playerWasKilled()).toBe(true);
    expect(hitBox.getDamage()).toBe(0); // team damage is never awarded
    expect(hitBox.getMoneyAward()).toBe(-300);
});

test("HitBox armor damage", () => {
    const player = new MockPlayer(1, new Point(), 190, ArmorType.BODY_AND_HEAD);
    const weapon = new MockWeapon(ItemType.TYPE_WEAPON_PRIMARY, 300);
    weapon.damageValue = 20;
    const hitBox = new HitBox(player, HitBoxType.HEAD, new HitBoxHead());

    const bullet = new Bullet(weapon, 1000);
    bullet.setOriginPlayer(1, false, new Point());
    bullet.setProperties(20);

    hitBox.registerHit(bullet);

    expect(player.armor).toBe(50); // 20 primary weapon + 30 head armor
    expect(hitBox.getDamage()).toBe(20);
});

test("HitBox leg hit does no armor damage", () => {
    const player = new MockPlayer(1, new Point(), 190, ArmorType.BODY_AND_HEAD);
    const weapon = new MockWeapon(ItemType.TYPE_WEAPON_PRIMARY, 300);
    weapon.damageValue = 20;
    const hitBox = new HitBox(player, HitBoxType.LEG, new HitBoxLegs());

    const bullet = new Bullet(weapon, 1000);
    bullet.setOriginPlayer(1, false, new Point());
    bullet.setProperties(20);

    hitBox.registerHit(bullet);

    expect(player.armor).toBe(0);
    expect(hitBox.getDamage()).toBe(20);
});

test("HitBox distance falloff", () => {
    const player = new MockPlayer(1, new Point(), 190, ArmorType.NONE);
    const weapon = new MockWeapon(ItemType.TYPE_WEAPON_PRIMARY, 300);
    weapon.damageValue = 20;
    const hitBox = new HitBox(player, HitBoxType.CHEST, new HitBoxChest());

    const bullet = new Bullet(weapon, 1000);
    bullet.setOriginPlayer(1, false, new Point());
    for (let i = 0; i < 600; i++) {
        bullet.incrementDistance();
    }

    hitBox.registerHit(bullet);

    // (601 - 500) / (900 + 1 - 500) -> capped at 0.99999 reduction
    expect(player.health).toBe(99);
    expect(hitBox.getDamage()).toBe(1);
});

test("HitBox bullet damage reduction", () => {
    const player = new MockPlayer(1, new Point(), 190, ArmorType.NONE);
    const weapon = new MockWeapon(ItemType.TYPE_WEAPON_PRIMARY, 300);
    weapon.damageValue = 20;
    const hitBox = new HitBox(player, HitBoxType.CHEST, new HitBoxChest());

    const bullet = new Bullet(weapon, 1000);
    bullet.setOriginPlayer(1, false, new Point());
    bullet.setProperties(10);

    hitBox.registerHit(bullet);

    // (10 / 20) * 0.9 -> ceil(20 * 0.45)
    expect(player.health).toBe(91);
    expect(hitBox.getDamage()).toBe(9);
});

test("HitBox getHitAntiForce", () => {
    const headHitBox = new HitBox(
        new MockPlayer(1, new Point(), 190, ArmorType.NONE),
        HitBoxType.HEAD,
        new HitBoxHead(),
    );
    expect(headHitBox.getHitAntiForce(new Point())).toBe(50);

    const headArmored = new HitBox(
        new MockPlayer(1, new Point(), 190, ArmorType.BODY_AND_HEAD),
        HitBoxType.HEAD,
        new HitBoxHead(),
    );
    expect(headArmored.getHitAntiForce(new Point())).toBe(95);

    const body = new HitBox(new MockPlayer(1, new Point(), 190, ArmorType.BODY), HitBoxType.CHEST, new HitBoxChest());
    expect(body.getHitAntiForce(new Point())).toBe(60);

    const none = new HitBox(new MockPlayer(1, new Point(), 190, ArmorType.NONE), HitBoxType.CHEST, new HitBoxChest());
    expect(none.getHitAntiForce(new Point())).toBe(30);
});

test("HitBox reset", () => {
    const player = new MockPlayer(1, new Point(), 190, ArmorType.NONE);
    const weapon = new MockWeapon(ItemType.TYPE_WEAPON_PRIMARY, 300);
    weapon.damageValue = 100;
    const hitBox = new HitBox(player, HitBoxType.HEAD, new HitBoxHead());

    const bullet = new Bullet(weapon, 1000);
    bullet.setOriginPlayer(1, false, new Point());
    bullet.setProperties(100);
    hitBox.registerHit(bullet);
    expect(hitBox.playerWasKilled()).toBe(true);

    hitBox.reset();
    expect(hitBox.playerWasKilled()).toBe(false);
    expect(hitBox.wasHeadShot()).toBe(false);
    expect(hitBox.getDamage()).toBe(0);
    expect(hitBox.getMoneyAward()).toBe(0);
    expect(hitBox.getType()).toBe(HitBoxType.HEAD);
    expect(hitBox.getPlayer()).toBe(player);
});
