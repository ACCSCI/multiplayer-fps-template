import { cylinderWithCylinder } from "../collision.js";
import { InventorySlot, SoundType } from "../enums.js";
import { DropEvent } from "../events/drop_event.js";
import { SoundEvent } from "../events/sound_event.js";
import { GameException } from "../game_exception.js";
import { NavigationMesh } from "../navigation_mesh.js";
import { PathFinder } from "../path_finder.js";
import { PlayerCollider } from "../player_collider.js";
import { playerBoundingRadius } from "../setting.js";
import { installLos } from "./los.js";
import { installSpatial } from "./spatial.js";
import { installVolumetric } from "./volumetric.js";

/**
 * Port of server/src/Core/World.php.
 * The World class is split into three modules whose methods are mounted on
 * World.prototype via the install*() mixins (static block below):
 *  - ./spatial.js    wall/floor buckets and queries
 *  - ./los.js        line-of-sight and bullet hit resolution
 *  - ./volumetric.js smoke/flame/explosive logic
 */
const BOMB_RADIUS = 90;
const BOMB_DEFUSE_MAX_DISTANCE = 300;
const ITEM_PICK_MAX_DISTANCE = 370;

/** PHP rand(min, max): inclusive both ends. */
function randomIntInclusive(min, max) {
    return Math.floor(Math.random() * (max - min + 1)) + min;
}

/** PHP shuffle(): Fisher-Yates in place. */
function shuffleInPlace(array) {
    for (let i = array.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [array[i], array[j]] = [array[j], array[i]];
    }
    return array;
}

/** Normalize an InventorySlot-like return value (raw int or { value: int }). */
function slotValue(slot) {
    if (slot !== null && typeof slot === "object") {
        return slot.value;
    }
    return slot;
}

export class World {
    static GRENADE_NAVIGATION_MESH_TILE_SIZE = 31;
    static GRENADE_NAVIGATION_MESH_OBJECT_HEIGHT = 80;

    static {
        installSpatial(World.prototype);
        installLos(World.prototype);
        installVolumetric(World.prototype);
    }

    constructor(game) {
        this.map = null;
        this.playersColliders = {};
        this.dropItems = [];
        this.walls = {};
        this.floors = {};
        this.spawnPositionTakes = {};
        this.spawnCandidates = {};
        this.activeSmokes = {};
        this.activeMolotovs = {};
        this.bomb = game.bomb;
        this.grenadeNavigationMesh = null;
        this.grenadePathFinder = null;
        this.game = game;
    }

    roundReset() {
        this.activeSmokes = {};
        this.activeMolotovs = {};
        this.spawnCandidates = {};
        this.spawnPositionTakes = {};
        this.dropItems = [];
        for (const collider of Object.values(this.playersColliders)) {
            collider.roundReset();
        }
    }

    loadMap(map) {
        let planeCount = 0;
        this.roundReset();
        this.map = map;

        this.walls = {};
        for (const wall of map.getWalls()) {
            this.addWall(wall);
            planeCount++;
        }

        this.floors = {};
        for (const floor of map.getFloors()) {
            this.addFloor(floor);
            planeCount++;
        }
        return planeCount;
    }

    regenerateNavigationMeshes() {
        const tileSize = World.GRENADE_NAVIGATION_MESH_TILE_SIZE;
        const colliderHeight = World.GRENADE_NAVIGATION_MESH_OBJECT_HEIGHT;
        this.grenadeNavigationMesh = this.getMap().getNavigationMesh(
            this.getMap().generateNavigationMeshKey(tileSize, colliderHeight),
        );
        if (this.grenadeNavigationMesh === null) {
            const pathFinder = this.buildNavigationMesh(tileSize, colliderHeight);
            this.grenadePathFinder = pathFinder;
            this.grenadeNavigationMesh = pathFinder.getNavigationMesh();
        }
    }

    addRamp(ramp) {
        for (const box of ramp.getBoxes()) {
            this.addBox(box);
        }
    }

    addBox(box) {
        for (const wall of box.getWalls()) {
            this.addWall(wall);
        }
        for (const floor of box.getFloors()) {
            this.addFloor(floor);
        }
    }

    addPlayer(player) {
        this.playersColliders[player.getId()] = new PlayerCollider(player);
    }

    getPlayerSpawnRotationHorizontal(isAttacker, maxRandomOffset) {
        const base = isAttacker ? this.getMap().getSpawnRotationAttacker() : this.getMap().getSpawnRotationDefender();
        return base + randomIntInclusive(-maxRandomOffset, maxRandomOffset);
    }

    getPlayerSpawnPosition(isAttacker, randomizeSpawnPosition) {
        const key = isAttacker ? 1 : 0;
        let source;
        if (this.spawnCandidates[key]) {
            source = this.spawnCandidates[key];
        } else {
            source = isAttacker ? this.getMap().getSpawnPositionAttacker() : this.getMap().getSpawnPositionDefender();
            if (randomizeSpawnPosition) {
                source = shuffleInPlace([...source]);
            }
            this.spawnCandidates[key] = source;
        }

        for (let index = 0; index < source.length; index++) {
            if (this.spawnPositionTakes[key]?.[index]) {
                continue;
            }
            if (this.spawnPositionTakes[key] === undefined) {
                this.spawnPositionTakes[key] = {};
            }
            this.spawnPositionTakes[key][index] = 1;
            return source[index].clone();
        }

        const side = isAttacker ? "attacker" : "defender";
        throw new GameException(`Cannot find free spawn position for '${side}' player`);
    }

    tryPickDropItems(player) {
        const playerPosition = player.getReferenceToPosition();
        const boundingRadius = player.getBoundingRadius();
        const headHeight = player.getHeadHeight();

        for (let key = 0; key < this.dropItems.length; key++) {
            const dropItem = this.dropItems[key];
            if (dropItem === undefined) {
                continue;
            }
            if (
                !cylinderWithCylinder(
                    dropItem.getPosition(),
                    dropItem.getBoundingRadius(),
                    dropItem.getHeight(),
                    playerPosition,
                    boundingRadius,
                    headHeight,
                )
            ) {
                continue;
            }

            if (player.getInventory().pickup(dropItem.getItem())) {
                const soundEvent = new SoundEvent(dropItem.getPosition(), SoundType.ITEM_PICKUP);
                this.makeSound(
                    soundEvent.setPlayer(player).setItem(dropItem.getItem()).addExtra("id", dropItem.getId()),
                );
                delete this.dropItems[key];
            }
        }
    }

    dropItem(player, item) {
        const dropEvent = new DropEvent(player, item, this);
        dropEvent.onFloorLand((dropItem) => {
            this.dropItems.push(dropItem);
        });
        this.game.addDropEvent(dropEvent);
    }

    playerUse(player) {
        // Bomb defusing
        if (
            !player.isPlayingOnAttackerSide() &&
            this.game.isBombActive() &&
            this.canBeSeen(player, this.bomb.getPosition(), BOMB_RADIUS, BOMB_DEFUSE_MAX_DISTANCE)
        ) {
            const defused = this.bomb.tryDefuse(player, this.getTickId());
            if (defused === null) {
                const soundEvent = new SoundEvent(player.getPositionClone().addY(10), SoundType.BOMB_DEFUSING);
                this.makeSound(soundEvent.setPlayer(player).setItem(this.bomb));
            } else if (defused === true) {
                this.game.bombDefused(player);
            }
            return;
        }

        // Dropped item pickup
        for (let key = 0; key < this.dropItems.length; key++) {
            const dropItem = this.dropItems[key];
            if (dropItem === undefined) {
                continue;
            }
            if (!this.canBeSeen(player, dropItem.getPosition(), dropItem.getBoundingRadius(), ITEM_PICK_MAX_DISTANCE)) {
                continue;
            }

            let shouldEquipOnPickup = false;
            const item = dropItem.getItem();
            const slot = item.getSlot();
            const slotId = slotValue(slot);
            if (
                player.getInventory().has(slotId) &&
                [InventorySlot.SLOT_PRIMARY, InventorySlot.SLOT_SECONDARY].includes(slotId)
            ) {
                shouldEquipOnPickup = player.getEquippedItem().getSlot() === slot;
                player.dropItemFromSlot(slotId);
            }
            if (player.getInventory().pickup(item)) {
                const soundEvent = new SoundEvent(dropItem.getPosition(), SoundType.ITEM_PICKUP);
                this.makeSound(soundEvent.setPlayer(player).setItem(item).addExtra("id", dropItem.getId()));
                delete this.dropItems[key];
                if (shouldEquipOnPickup) {
                    player.equip(slot);
                }
                return;
            }
        }
    }

    makeSound(soundEvent) {
        this.game.addSoundEvent(soundEvent);
    }

    canAttack(player) {
        if (this.game.isPaused()) {
            return false;
        }
        if (!player.isAlive()) {
            return false;
        }

        return player.getEquippedItem().canAttack(this.getTickId());
    }

    canPlant(player) {
        if (slotValue(player.getEquippedItem().getSlot()) !== InventorySlot.SLOT_BOMB) {
            return false;
        }
        if (player.isFlying()) {
            return false;
        }
        if (!player.isAlive()) {
            return false;
        }
        if (this.game.isPaused()) {
            return false;
        }

        return this.getMap().getPlantArea().contains(player.getReferenceToPosition());
    }

    canBuy(player) {
        if (!this.game.playersCanBuy()) {
            return false;
        }

        return this.getMap().getBuyArea(player.isPlayingOnAttackerSide()).contains(player.getReferenceToPosition());
    }

    getTickId() {
        return this.game.getTickId();
    }

    isPaused() {
        return this.game.isPaused();
    }

    playerDiedToFallDamage(playerDead) {
        this.game.playerFallDamageKilledEvent(playerDead);
    }

    buildNavigationMesh(tileSize, objectHeight) {
        const boundingRadius = playerBoundingRadius();
        if (tileSize > boundingRadius - 4) {
            throw new GameException("Tile size should be decently lower than player bounding radius.");
        }

        const pathFinder = new PathFinder(this, new NavigationMesh(tileSize, objectHeight));
        const startPoints = this.getMap().getStartingPointsForNavigationMesh();
        if (startPoints.length === 0) {
            throw new GameException("No starting point for navigation defined!");
        }
        for (const point of startPoints) {
            pathFinder.buildNavigationMesh(point, objectHeight);
        }

        pathFinder.saveAndClear();
        return pathFinder;
    }

    tryPlantBomb(player) {
        if (!this.canPlant(player)) {
            return;
        }

        const planted = this.bomb.tryPlant(player, this.getTickId());
        if (planted === null) {
            const soundEvent = new SoundEvent(player.getPositionClone().addY(10), SoundType.BOMB_PLANTING);
            this.makeSound(soundEvent.setPlayer(player).setItem(this.bomb));
        } else if (planted === true) {
            player.equip(player.getInventory().removeBomb());
            this.game.bombPlanted(player);
        }
    }

    isPlantingOrDefusing(player) {
        return this.bomb.isPlantingOrDefusing(player.getId(), this.getTickId());
    }

    isCollisionWithOtherPlayers(playerIdSkip, point, radius, height) {
        for (const collider of Object.values(this.playersColliders)) {
            if (collider.playerId === playerIdSkip) {
                continue;
            }

            if (collider.isBoundaryCollision(point, radius, height)) {
                return collider.getPlayer();
            }
        }

        return null;
    }

    getWalls() {
        const output = [];
        for (const wallGroup of Object.values(this.walls)) {
            for (const walls of Object.values(wallGroup)) {
                for (const wall of walls) {
                    output.push(wall.toArray());
                }
            }
        }

        return output;
    }

    getFloors() {
        const output = [];
        for (const floors of Object.values(this.floors)) {
            for (const floor of floors) {
                output.push(floor.toArray());
            }
        }
        return output;
    }

    getDropItems() {
        return this.dropItems;
    }

    getMap() {
        if (this.map === null) {
            throw new GameException("No map is loaded!");
        }

        return this.map;
    }

    getBacktrack() {
        return this.game.getBacktrack();
    }

    activeMolotovExists() {
        return Object.keys(this.activeMolotovs).length > 0;
    }

    getGrenadeNavigationMesh() {
        return this.grenadeNavigationMesh ?? GameException.invalid();
    }
}
