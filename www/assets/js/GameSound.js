import * as THREE from "three";
import { InventorySlot, SoundType } from "./Enums.js";
import { SoundRepository } from "./SoundRepository.js";
import { Utils } from "./Utils.js";

/**
 * Sound playback and explosive/volumetric effects (fire, smoke, grenades,
 * bomb) for the game. Owns all transient world objects tied to sounds:
 * dropped items, throwables and volumetrics, plus round-scoped timers.
 */
export class GameSound {
    #game;
    #world;
    #hud;
    #soundRepository;
    #dropItems = {};
    #throwables = {};
    #volumetrics = {};
    #roundIntervalIds = [];
    #bombTimerId = null;

    constructor(game, world, hud) {
        this.#game = game;
        this.#world = world;
        this.#hud = hud;
        this.#soundRepository = new SoundRepository((...args) => world.playSound(...args));
    }

    reset() {
        clearInterval(this.#bombTimerId);
        for (const id of this.#roundIntervalIds) {
            clearInterval(id);
        }
        this.#roundIntervalIds = [];
        for (const id of Object.keys(this.#dropItems)) {
            this.itemPickUp(id);
        }
        for (const id of Object.keys(this.#throwables)) {
            this.removeGrenade(id);
        }
        for (const groupId of Object.keys(this.#volumetrics)) {
            for (const itemId of Object.keys(this.#volumetrics[groupId])) {
                this.#world.destroyObject(this.#volumetrics[groupId][itemId]);
            }
        }
        this.#volumetrics = {};
    }

    processSound(data) {
        const game = this.#game;
        const spectatorId = game.playerSpectate.getId();
        if (data.type === SoundType.ITEM_ATTACK) {
            this.#world.itemAttack(game.players[data.player], data.item, data.player === spectatorId);
        }
        if (data.type === SoundType.BULLET_HIT) {
            if (data.player) {
                game.playerHit(data, false);
            } else {
                this.#world.bulletWallHit(data.extra.origin, data.position, data.item);
            }
        } else if (data.type === SoundType.BULLET_HIT_HEADSHOT) {
            game.playerHit(data, true);
        }
        if (data.type === SoundType.FLAME_PLAYER_HIT) {
            game.playerHit(data, false);
        }
        if (data.type === SoundType.ITEM_PICKUP) {
            this.itemPickUp(data.extra.id);
        }
        if (data.type === SoundType.FLAME_SPAWN) {
            this.spawnFlame(
                data.position,
                data.extra.height,
                data.extra.id,
                `${data.position.x}-${data.position.y}-${data.position.z}`,
            );
        }
        if (data.type === SoundType.SMOKE_SPAWN) {
            this.spawnSmoke(
                data.position,
                data.extra.height,
                data.extra.id,
                `${data.position.x}-${data.position.y}-${data.position.z}`,
            );
        }
        if (data.type === SoundType.FLAME_EXTINGUISH) {
            this.destroyFlame(data.extra.id, `${data.position.x}-${data.position.y}-${data.position.z}`);
        }
        if (data.type === SoundType.SMOKE_FADE) {
            this.smokeFade(data.extra.id);
        }
        if (data.type === SoundType.ITEM_DROP_AIR) {
            const item = this.#dropItems[data.extra.id];
            item.rotation.x -= 0.1;
            item.rotation.y -= 0.1;
            item.rotation.z -= 0.1;
            item.position.set(data.position.x, data.position.y, -data.position.z);
        }
        if (data.type === SoundType.ITEM_DROP_LAND) {
            if (data.item.slot === InventorySlot.SLOT_BOMB) {
                game.bombDropPosition = data.position;
            }
            const item = this.#dropItems[data.extra.id];
            item.rotation.set(0, 0, 0);
            item.rotateOnWorldAxis(new THREE.Vector3(0, 1, 0), Math.random() * 6.28);
            item.position.set(data.position.x, data.position.y, -data.position.z);
        }
        if (data.type === SoundType.BOMB_DEFUSED || data.type === SoundType.BOMB_EXPLODED) {
            clearInterval(this.#bombTimerId);
        }
        if (
            data.type === SoundType.GRENADE_AIR ||
            data.type === SoundType.GRENADE_BOUNCE ||
            data.type === SoundType.GRENADE_LAND
        ) {
            const grenade = this.#throwables[data.extra.id];
            grenade.rotation.x += 0.1;
            grenade.rotation.y += 0.1;
            grenade.rotation.z += 0.1;
            grenade.position.set(data.position.x, data.position.y, -data.position.z);

            if (data.type === SoundType.GRENADE_LAND) {
                this.#grenadeLand(data.extra.id, data.item, data.player, data.position);
            }
        }

        this.#soundRepository.play(data, spectatorId, game.getTick());
    }

    #grenadeLand(throwableId, item, playerId, position) {
        const game = this.#game;
        if (item.slot === InventorySlot.SLOT_GRENADE_DECOY) {
            const player = game.players[playerId];
            const soundItem = player.data.slots[InventorySlot.SLOT_PRIMARY]
                ? player.data.slots[InventorySlot.SLOT_PRIMARY]
                : player.data.slots[InventorySlot.SLOT_SECONDARY]
                  ? player.data.slots[InventorySlot.SLOT_SECONDARY]
                  : player.data.slots[InventorySlot.SLOT_KNIFE];
            const soundName = this.#soundRepository.getItemAttackSound(soundItem);

            const world = this.#world;
            const endTime = Date.now() + 15 * 1e3;
            const callback = () => {
                world.playSound(soundName, position, false);
                if (Date.now() > endTime) {
                    this.removeGrenade(throwableId);
                    return;
                }
                this.#roundIntervalIds.push(setTimeout(callback, Math.random() * 1000));
            };
            this.#roundIntervalIds.push(setTimeout(callback, 100));
            return;
        }
        if (item.slot === InventorySlot.SLOT_GRENADE_FLASH) {
            const grenade = this.#throwables[throwableId].getObjectByName("collider");
            const sight = game.playerSpectate.get3DObject().getObjectByName("sight");
            const sightPosition = sight.getWorldPosition(new THREE.Vector3());
            const direction = grenade.getWorldPosition(new THREE.Vector3()).sub(sightPosition).normalize();
            if (this.#world.getCamera().getWorldDirection(new THREE.Vector3()).dot(direction) <= 0) {
                // flash behind spectator
                this.removeGrenade(throwableId);
                return;
            }

            const ray = new THREE.Raycaster(sightPosition, direction);
            ray.layers.set(Utils.LAYER_WORLD);
            grenade.layers.set(Utils.LAYER_WORLD);
            const intersects = ray.intersectObjects([grenade, this.#world.getScene()]);
            if (intersects.length >= 1 && intersects[0].object === grenade) {
                this.#hud.showFlashBangScreen();
            }
            this.removeGrenade(throwableId);
            return;
        }
        if (item.slot === InventorySlot.SLOT_GRENADE_HE) {
            this.removeGrenade(throwableId); // fixme add some cool effect
            return;
        }

        this.#roundIntervalIds.push(setTimeout(() => this.removeGrenade(throwableId), 500));
    }

    itemDrop(item, id) {
        const model = this.#world.itemDropped(item);
        this.#dropItems[id] = model;
    }

    itemPickUp(id) {
        const dropItem = this.#dropItems[id];
        this.#world.destroyObject(dropItem);
        delete this.#dropItems[id];
    }

    spawnGrenade(item, id, radius) {
        this.#throwables[id] = this.#world.spawnGrenade(item, radius);
    }

    removeGrenade(id) {
        const grenade = this.#throwables[id];
        this.#world.destroyObject(grenade);
        delete this.#throwables[id];
    }

    grillStart(fireId, position, size, _maxTimeMs, _maxPartCount) {
        this.#volumetrics[fireId] = {};
        this.#volumetrics[fireId].size = size;
        this.#world.playSound("338301_4811732-lq.mp3", position, false);
    }

    spawnFlame(point, height, fireId, partId) {
        const size = this.#volumetrics[fireId].size;
        height = Utils.lerp(
            height,
            Utils.randomInt(16, 26),
            Math.min(Math.sqrt(Object.keys(this.#volumetrics[fireId]).length) / Utils.randomInt(7, 9), 1),
        );
        this.#volumetrics[fireId][partId] = this.#world.spawnFlame(point, size, height);
    }

    destroyFlame(fireId, flameId) {
        const flame = this.#volumetrics[fireId][flameId];
        this.#world.destroyObject(flame);
        delete this.#volumetrics[fireId][flameId];
    }

    smokeStart(smokeId, _position, size, _maxTimeMs, maxPartCount) {
        this.#volumetrics[smokeId] = { mesh: this.#world.initSmoke(smokeId, size, maxPartCount) };
    }

    spawnSmoke(point, height, smokeId, _partId) {
        this.#world.spawnSmoke(point, height, smokeId);
    }

    smokeFade(smokeId) {
        const intervalId = setInterval(() => {
            if (this.#world.fadeSmoke(smokeId)) {
                clearInterval(intervalId);
            }
        }, 50);
        this.#roundIntervalIds.push(intervalId);
    }

    bombPlanted(timeMs, position) {
        const world = this.#world;
        world.spawnBomb(position);
        this.#game.bombDropPosition = position;

        const bombSecCount = Math.ceil(timeMs / 1000);
        this.#hud.bombPlanted(bombSecCount);

        const tenSecWarningSecCount = Math.round(timeMs / 1000 - 10);
        let tickSecondsCount = 0;
        const bombTimerId = setInterval(() => {
            if (tickSecondsCount === bombSecCount) {
                clearInterval(bombTimerId);
            }
            if (tickSecondsCount === tenSecWarningSecCount) {
                world.playSound("88532__northern87__woosh-northern87.wav", null, true);
            }
            world.playSound("536422__rudmer-rotteveel__setting-electronic-timer-1-beep.wav", position, false);
            tickSecondsCount++;
        }, 1000);
        this.#bombTimerId = bombTimerId;
    }
}
