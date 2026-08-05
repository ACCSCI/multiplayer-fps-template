import * as THREE from "three";
import { EventProcessor } from "./EventProcessor.js";
import { GameInventory } from "./GameInventory.js";
import { GameSound } from "./GameSound.js";
import { Player } from "./Player.js";
import { Utils } from "./Utils.js";

export class Game {
    #world;
    #hud;
    #stats;
    #pointer;
    #setting;
    #playerAction;
    #shouldRenderInsideTick;
    #tick = 0;
    #round = 1;
    #roundHalfTime = 2;
    #paused = false;
    #started = false;
    #options = null;
    #readyCallback;
    #endCallback;
    #hudDebounceTicks = 1;
    #eventProcessor;
    #sound;
    #inventory;
    #roundDamage = { did: {}, got: {} };
    score = null;
    bombDropPosition = null;
    alivePlayers = [0, 0];
    buyList = [];
    players = [];
    playerMe = null;
    playerSpectate = null;

    constructor(world, hud, stats) {
        this.#world = world;
        this.#hud = hud;
        this.#stats = stats;
        this.#eventProcessor = new EventProcessor(this);
        this.#sound = new GameSound(this, world, hud);
        this.#inventory = new GameInventory(this, world, hud);
    }

    #roundReset() {
        this.#sound.reset();
        this.#world.reset();
    }

    pause(msg, score, timeMs) {
        this.#paused = true;
        console.log(`Pause: ${msg} for ${timeMs}ms`);
        this.#roundReset();
        this.players.forEach((player) => {
            if (player.getId() === this.playerMe.getId()) {
                // reset spectate camera to our player
                const camera = this.#world.getCamera();
                camera.rotation.set(0, Utils.serverHorizontalRotationToThreeRadian(player.data.look.horizontal), 0);
                if (this.#pointer) {
                    this.#pointer.reset();
                }
                player.get3DObject().getObjectByName("sight").add(camera);
                this.playerSpectate = this.playerMe;
                this.requestPointerLock();
            } else {
                player.get3DObject().getObjectByName("figure").visible = true;
            }
            player.respawn();
        });
        if (!this.#started) {
            this.#gameStartOrHalfTimeOrEnd();
            this.#started = true;
        }
        if (this.#roundHalfTime === this.#round + 1) {
            this.#world.playSound("voice/blanka-last_round_of_half.mp3", null, true);
        }
        this.score = score;
        this.#hud.pause(msg, timeMs);
        this.#hud.requestFullScoreBoardUpdate(this.score);
    }

    unpause() {
        this.#paused = false;
        this.#hud.clearTopMessage();
        this.#hud.updateRoundDamage(null);
        this.#roundDamage = { did: {}, got: {} };
        console.log("Game unpause");
    }

    end(msg) {
        console.log("Game ended");
        this.#gameStartOrHalfTimeOrEnd();
        if (this.#endCallback) {
            this.#endCallback(msg);
        }
    }

    roundStart(aliveAttackers, aliveDefenders) {
        console.log(`Starting round ${this.#round}`);
        this.alivePlayers[0] = aliveDefenders;
        this.alivePlayers[1] = aliveAttackers;
        this.#hud.clearAlerts();
        this.#hud.roundStart(this.#options.setting.round_time_ms);
    }

    roundEnd(attackersWins, newRoundNumber, score) {
        const winner = attackersWins ? "Attackers" : "Defenders";
        console.log(`Round ${this.#round} ended. Round wins: ${winner}`);
        this.score = score;
        this.#round = newRoundNumber;
        this.#hud.displayTopMessage(`${winner} wins`);
        this.#hud.requestFullScoreBoardUpdate(this.score);
        this.#hud.updateRoundDamage(this.#roundDamage, this.getEnemyPlayers());
    }

    halfTime() {
        this.#gameStartOrHalfTimeOrEnd();
    }

    #gameStartOrHalfTimeOrEnd() {
        this.#world.playSound("538422__rosa-orenes256__referee-whistle-sound.wav", null, true);
    }

    playerHit(data, wasHeadshot) {
        const playerHitId = data.player;
        if (playerHitId === this.playerSpectate.getId()) {
            const anglePlayer = Math.round(this.getPlayerSpectateRotation()[0]);
            const camera = this.#world.getCamera();

            const cameraPosition = new THREE.Vector3();
            camera.getWorldPosition(cameraPosition);
            cameraPosition.z = Math.abs(cameraPosition.z);

            const angleHit = Utils.radianToDegree(
                Math.atan2(data.extra.origin.x - cameraPosition.x, data.extra.origin.z - cameraPosition.z),
            );
            const delta = Utils.smallestDeltaAngle(anglePlayer, angleHit);
            this.#hud.spectatorHit(
                delta < -30 && delta > -150,
                delta > 30 && delta < 150,
                Math.abs(delta) <= 40,
                Math.abs(delta) >= 120,
            );

            // Update hit position for better audio feedback
            const rotate = Utils.rotatePointY(angleHit, 0, 10);
            data.position.x = cameraPosition.x + rotate[0];
            data.position.y = cameraPosition.y + Math.sign(data.extra.origin.y - cameraPosition.y) * 3;
            data.position.z = cameraPosition.z + rotate[1];
        } else {
            this.#world.bulletPlayerHit(data.position, wasHeadshot);
        }

        const damage = data.extra.damage;
        const myId = this.playerMe.getId();
        const attackerId = data.extra.shooter;
        if (playerHitId === myId) {
            if (!this.#roundDamage.got[attackerId]) {
                this.#roundDamage.got[attackerId] = [];
            }
            this.#roundDamage.got[attackerId].push(damage);
        } else if (attackerId === myId) {
            if (!this.#roundDamage.did[playerHitId]) {
                this.#roundDamage.did[playerHitId] = [];
            }
            this.#roundDamage.did[playerHitId].push(damage);
        }
    }

    processSound(data) {
        this.#sound.processSound(data);
    }

    itemDrop(item, id) {
        this.#sound.itemDrop(item, id);
    }

    spawnGrenade(item, id, radius) {
        this.#sound.spawnGrenade(item, id, radius);
    }

    grillStart(fireId, position, size, maxTimeMs, maxPartCount) {
        this.#sound.grillStart(fireId, position, size, maxTimeMs, maxPartCount);
    }

    smokeStart(smokeId, position, size, maxTimeMs, maxPartCount) {
        this.#sound.smokeStart(smokeId, position, size, maxTimeMs, maxPartCount);
    }

    bombPlanted(timeMs, position) {
        this.#sound.bombPlanted(timeMs, position);
    }

    getRoundNumber() {
        return this.#round;
    }

    isPaused() {
        return this.#paused;
    }

    isPlaying() {
        return this.#started;
    }

    onReady(callback) {
        this.#readyCallback = callback;
    }

    onEnd(callback) {
        this.#endCallback = callback;
    }

    gameStart(options) {
        this.#options = options;
        Utils.tickMs = options.tickMs;
        this.#roundHalfTime = Math.floor(options.setting.max_rounds / 2) + 1;
        this.#hud.startWarmup(options.warmupSec * 1000);

        const playerId = options.playerId;
        if (this.players[playerId]) {
            throw new Error("My Player is already set!");
        }

        this.playerMe = new Player(options.player, this.#world.createPlayerMe());
        this.players[playerId] = this.playerMe;
        this.playerSpectate = this.playerMe;

        if (this.#readyCallback) {
            this.#readyCallback(this.#options);
        }
    }

    playerKilled(playerIdDead, playerIdCulprit, wasHeadshot, killItemId) {
        const culpritPlayer = this.players[playerIdCulprit];
        const deadPlayer = this.players[playerIdDead];

        deadPlayer.died();
        this.alivePlayers[deadPlayer.getTeamIndex()]--;

        this.#hud.showKill(culpritPlayer.data, deadPlayer.data, wasHeadshot, this.playerMe.data, killItemId);

        if (playerIdDead === this.playerSpectate.getId()) {
            this.requestPointerUnLock();
            this.spectatePlayer();
        }
    }

    spectatePlayer(directionNext = true) {
        if (this.playerMe.isAlive() || this.alivePlayers[this.playerMe.getTeamIndex()] === 0) {
            return;
        }

        const myId = this.playerSpectate.getId();
        const aliveAvailableSpectateMates = this.getMyTeamPlayers().filter(
            (player) => player.isAlive() && myId !== player.getId(),
        );
        if (aliveAvailableSpectateMates.length === 0) {
            return;
        }

        const ids = aliveAvailableSpectateMates.map((player) => player.getId()).sort();
        if (!directionNext) {
            ids.reverse();
        }

        let playerId = ids.find((id) => myId > id);
        if (!playerId) {
            playerId = ids.shift();
        }

        const camera = this.#world.getCamera();
        camera.rotation.set(0, 0, 0);

        const player = this.players[playerId];
        player.get3DObject().getObjectByName("sight").add(camera);
        player.get3DObject().getObjectByName("figure").visible = false;

        if (this.playerSpectate.isAlive()) {
            this.playerSpectate.get3DObject().getObjectByName("figure").visible = true;
        }
        this.playerSpectate = player;

        this.#inventory.equip(player.getEquippedSlotId());
        this.#hud.changeSpectatePlayer(player);
    }

    createPlayer(data) {
        if (this.players[data.id]) {
            throw new Error(`Player already exist with id ${data.id}`);
        }

        const player = new Player(data);
        this.#world.spawnPlayer(player, this.playerMe.isAttacker() !== data.isAttacker);
        this.players[data.id] = player;
        return player;
    }

    equip(slotId) {
        return this.#inventory.equip(slotId);
    }

    switchHands() {
        this.#inventory.switchHands();
    }

    clearDecals() {
        this.#world.clearDecals();
    }

    getScene() {
        return this.#world.getScene();
    }

    tick(state) {
        this.#stats.begin();
        this.#tick++;

        if (this.#options !== null) {
            state.players.forEach((serverState) => {
                let player = this.players[serverState.id];
                if (player === undefined) {
                    player = this.createPlayer(serverState);
                }
                this.updatePlayerData(player, serverState);
            });
        }
        state.events.forEach((event) => {
            this.#eventProcessor.process(event);
        });

        this.#render();
        this.#stats.end();
    }

    updatePlayerData(player, serverState) {
        player.get3DObject().getObjectByName("sight").position.y = serverState.sight;
        player.get3DObject().position.set(serverState.position.x, serverState.position.y, -serverState.position.z);

        this.#updateScopeState(player, serverState.scopeLevel);
        if (player.data.isAttacker === this.playerMe.data.isAttacker && player.data.money !== serverState.money) {
            this.#hud.updateMyTeamPlayerMoney(player.data, serverState.money);
        }
        player.updateData(serverState);

        if (this.playerSpectate.getId() === serverState.id && this.playerSpectate.isInventoryChanged(serverState)) {
            this.#inventory.equip(serverState.item.slot);
        }
        if (this.playerMe.getId() !== serverState.id) {
            this.#inventory.updateOtherPlayersModels(player, serverState);
        }
    }

    #updateScopeState(player, scopeLevel) {
        const isPlayerSpectate = this.playerSpectate.getId() === player.getId();

        if (isPlayerSpectate) {
            this.#hud.updateCrossHair(scopeLevel, this.playerSpectate.data.item.id);
            scopeLevel > 0 &&
                this.#hud.scopeBlur(this.#playerAction.isMoving() && !this.#playerAction.isCrouching() ? 3 : 0);
        }
        if (player.data.scopeLevel === scopeLevel) {
            return;
        }

        if (scopeLevel > 0) {
            this.#world.playSound(
                "210018__supakid13__sniper-scope-zoom-in.wav",
                player.getSightPosition(),
                isPlayerSpectate,
            );
        }
        if (isPlayerSpectate) {
            const isNotScopedIn = scopeLevel === 0;
            this.#world.getCamera().getObjectByName("pov-item").visible = isNotScopedIn;
            this.#world.updateCameraZoom(Utils.scopeLevelToZoom(scopeLevel));
            if (this.meIsAlive()) {
                this.#pointer.pointerSpeed = isNotScopedIn
                    ? this.#setting.getSensitivity()
                    : this.#setting.getInScopeSensitivity() / scopeLevel;
            }
        }
    }

    getMyTeamPlayers() {
        const meIsAttacker = this.playerMe.isAttacker();
        return this.players.filter((player) => player.isAttacker() === meIsAttacker);
    }

    getEnemyPlayers() {
        const meIsAttacker = this.playerMe.isAttacker();
        return this.players.filter((player) => player.isAttacker() !== meIsAttacker);
    }

    meIsAlive() {
        return this.playerMe.isAlive();
    }

    meIsSpectating() {
        return !this.meIsAlive();
    }

    setDependency(pointer, setting, action) {
        this.#pointer = pointer;
        this.#setting = setting;
        this.#playerAction = action;
        this.#shouldRenderInsideTick = setting.shouldMatchServerFps();
    }

    getPlayerMeRotation() {
        return Utils.threeRotationToServer(this.#pointer.getObject().rotation);
    }

    getPlayerSpectateRotation() {
        if (this.playerSpectate.getId() === this.playerMe.getId()) {
            return this.getPlayerMeRotation();
        }
        return [this.playerSpectate.data.look.horizontal, this.playerSpectate.data.look.vertical];
    }

    requestPointerLock() {
        if (this.#pointer.isLocked || (this.playerMe && this.playerMe.getId() !== this.playerSpectate.getId())) {
            return;
        }
        this.#pointer.lock();
    }

    requestPointerUnLock() {
        if (!this.#pointer.isLocked) {
            return;
        }
        this.#pointer.unlock();
    }

    getTick() {
        return this.#tick;
    }

    #render() {
        if (this.#started && --this.#hudDebounceTicks === 0) {
            this.#hudDebounceTicks = Utils.msToTick(40);
            this.#hud.updateHud(this.playerSpectate.data);
        }
        if (this.#shouldRenderInsideTick) {
            this.#world.render();
        }
    }
}
