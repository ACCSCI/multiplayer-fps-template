import { GameOverReason } from "./enums.js";
import { Player } from "./player.js";
import { PlayerControl } from "./player_control.js";
import { TextProtocol } from "./text_protocol.js";

/**
 * Pure in-memory port of server/src/Net/Server.php (UDP/network removed).
 *
 * API shape (SimHost builds on this):
 *   new HostSession(game, setting, protocol?)
 *   host.login(code)                 -> number|null  login code check -> playerId, GameStartEvent snapshot
 *   host.recvCommand(playerId, msg)  -> boolean      enqueue parsed player commands (960B / per-tick limits)
 *   host.tick()                      -> GameOverEvent|null  warmup -> commands -> game tick -> snapshot
 *   host.onSnapshot(cb)              -> void         cb(serializedStateString) after every broadcast
 *   host.onEvent(cb)                 -> void         cb(event) for each event of the tick
 *   host.getBlockedPlayersCount()    -> number
 *
 * Warmup semantics: logins are pushed via login(); warmup completes when all
 * players are connected (instant start) or after warmupWaitSec tick()-driven
 * countdown; on failure a GameOverEvent (REASON_NOT_ALL_PLAYERS_CONNECTED)
 * snapshot is broadcast once.
 */
export class HostSession {
    /** @type {Record<number, object>} PHP Client[] [playerId => Client] */
    clients = {};
    /** @type {Record<number, Function>} PHP array<int,callable(PlayerControl):void> */
    tickCommands = {};
    /** @type {number} PHP private int $playerId */
    playerId = 0;
    /** @type {number} PHP private int $countAttackers */
    countAttackers = 0;
    /** @type {number} PHP private int $countDefenders */
    countDefenders = 0;
    /** @type {number} PHP private int $blockListMax */
    blockListMax = 500;
    /** @type {Record<string, number>} PHP private array<string,int> [ipAddress => 1] */
    blockList = {};
    /** @type {Record<number, number>} PHP private array<string,int> [address-port => playerId] */
    loggedPlayers = {};

    /** @type {boolean} not in PHP: memory-mode warmup state */
    gameStarted = false;
    /** @type {boolean} not in PHP: players full, waiting for warmup countdown */
    gameReady = false;
    /** @type {?Function} snapshot callback */
    onSnapshotCallback = null;
    /** @type {?Function} per-event callback */
    onEventCallback = null;
    /** @type {?object} logger with log(level, msg), PHP NullLogger default */
    logger = null;

    constructor(game, setting, protocol = new TextProtocol()) {
        /** @type {object} PHP private Game $game */
        this.game = game;
        /** @type {object} PHP private ServerSetting $setting */
        this.setting = setting;
        /** @type {object} PHP private Protocol $protocol */
        this.protocol = protocol;
    }

    onSnapshot(callback) {
        this.onSnapshotCallback = callback;
    }

    onEvent(callback) {
        this.onEventCallback = callback;
    }

    setLogger(logger) {
        this.logger = logger;
    }

    getBlockedPlayersCount() {
        return Object.keys(this.blockList).length;
    }

    /**
     * PHP loginPlayer(): login code comparison -> GameStartEvent snapshot.
     * @returns {?number} playerId or null when the code is invalid/blocked
     */
    login(code) {
        const msg = `login ${code}`;
        let attackerSide = null;
        if (msg === `login ${this.setting.attackerCode}`) {
            attackerSide = true;
        } else if (msg === `login ${this.setting.defenderCode}`) {
            attackerSide = false;
        } else {
            this.playerBlock("login");
            return null;
        }

        const playerId = ++this.playerId;
        const playerControl = this.playerCreate(playerId, attackerSide);
        this.clients[playerId] = { playerControl, ip: "memory", port: playerId };
        this.loggedPlayers[playerId] = playerId;
        this.sendGameSettingToClient(this.game.getPlayer(playerId));
        return playerId;
    }

    /**
     * PHP receiveClientsCommands() + parseClientRequest(): collect one command
     * stream per player per tick from the in-memory queue.
     * @returns {boolean} true when the command stream was queued
     */
    recvCommand(playerId, msg) {
        if (this.loggedPlayers[playerId] === undefined) {
            this.playerBlock(String(playerId));
            return false;
        }
        if (msg.length > this.protocol.getRequestMaxSizeBytes()) {
            this.log(`Player '${playerId}' send too large request`, "warning");
            return false;
        }
        if (this.tickCommands[playerId] !== undefined) {
            this.log(`Player '${playerId}' have queued requests, dropping`, "warning");
            return false;
        }

        const player = this.game.getPlayer(playerId);
        if (!player.isAlive()) {
            return false;
        }

        const commands = this.protocol.parsePlayerControlCommands(msg);
        if (commands.length === 0) {
            this.log(`Player '${playerId}' send invalid request`, "warning");
            return false;
        }

        this.tickCommands[playerId] = (control) => {
            for (const command of commands) {
                const method = command.shift();
                control[method](...command);
            }
        };
        return true;
    }

    /**
     * One loop iteration of PHP Server::start()/startGame():
     * warmup -> receiveClientsCommands -> gameTick -> sendGameStateToClients.
     * @returns {?GameOverEvent} PHP ?GameOverEvent
     */
    tick() {
        if (!this.gameStarted) {
            this.warmupTick();
            if (!this.gameStarted) {
                return null;
            }
            if (!this.gameReady) {
                // warmup failed: broadcast the GameOverEvent snapshot once
                this.sendGameStateToClients();
                return this.game.tick();
            }
            // PHP startGame(): broadcast the initial state before the loop
            this.sendGameStateToClients();
        }

        const gameOverEvent = this.gameTick();
        this.sendGameStateToClients();
        return gameOverEvent;
    }

    /** PHP startWarmup(): waiting for players, countdown is tick()-driven in memory mode. */
    warmupTick() {
        if (Object.keys(this.clients).length === this.setting.playersMax) {
            if (this.setting.warmupInstantStart) {
                this.gameStarted = true;
                this.gameReady = true;
                return;
            }
            this.gameReady = true;
        }

        this.setting.warmupWaitSecRemains--;
        if (this.setting.warmupWaitSecRemains >= 0) {
            return;
        }

        if (this.gameReady) {
            this.gameStarted = true;
            return;
        }

        this.log(
            `Not all players connected during warmup! Players: ${Object.keys(this.clients).length}/${this.setting.playersMax}.`,
        );
        this.game.quit(GameOverReason.REASON_NOT_ALL_PLAYERS_CONNECTED);
        this.gameStarted = true;
    }

    /** PHP gameTick(): apply queued commands, then the game tick. */
    gameTick() {
        for (const [playerId, callback] of Object.entries(this.tickCommands)) {
            callback(this.clients[playerId].playerControl);
        }
        this.tickCommands = {};
        return this.game.tick();
    }

    /**
     * PHP sendGameStateToClients(): broadcast the snapshot (players + events) to
     * connected clients only (no clients, no sends - like PHP). Equivalent to
     * TextProtocol::serializeGameState() output; events are also forwarded to
     * the onEvent callback.
     */
    sendGameStateToClients() {
        const events = this.game.consumeTickEvents();
        const msg = this.protocol.serialize(this.game.getPlayers(), events);
        if (Object.keys(this.clients).length === 0) {
            return;
        }
        if (this.onSnapshotCallback) {
            this.onSnapshotCallback(msg);
        }
        if (this.onEventCallback) {
            for (const event of events) {
                this.onEventCallback(event);
            }
        }
    }

    /** PHP loginPlayer(): GameStartEvent snapshot for the new client. */
    sendGameSettingToClient(player) {
        const msg = this.protocol.serializeGameSetting(player, this.setting, this.game);
        if (this.onSnapshotCallback) {
            this.onSnapshotCallback(msg);
        }
    }

    /** PHP playerCreate(): color assignment, Player + PlayerControl creation. */
    playerCreate(playerId, attackerSide) {
        let color;
        if (attackerSide) {
            color = (this.countAttackers % 5) + 1;
            this.countAttackers++;
        } else {
            color = (this.countDefenders % 5) + 1;
            this.countDefenders++;
        }

        const player = new Player(playerId, color, attackerSide);
        this.game.addPlayer(player);
        return new PlayerControl(player, this.game.getState());
    }

    /** PHP playerBlock(): track blocked addresses (memory clients keyed by id). */
    playerBlock(playerAddress) {
        if (Object.keys(this.blockList).length > this.blockListMax) {
            const firstKey = Object.keys(this.blockList)[0];
            delete this.blockList[firstKey];
        }
        this.blockList[playerAddress] = 1;
    }

    /** PHP Server::log() - NullLogger by default. */
    log(msg, level = "info") {
        if (this.logger) {
            this.logger.log(level, msg);
        }
    }
}
