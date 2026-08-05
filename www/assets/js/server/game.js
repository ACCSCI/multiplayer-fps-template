import { Backtrack } from "./backtrack.js";
import { GameOverReason, ItemId, PauseReason, RoundEndReason, SoundType } from "./enums.js";
import { Bomb } from "./equipment/bomb.js";
import { DropEvent } from "./events/drop_event.js";
import { GameOverEvent } from "./events/game_over_event.js";
import { GrillEvent } from "./events/grill_event.js";
import { KillEvent } from "./events/kill_event.js";
import { PauseEndEvent } from "./events/pause_end_event.js";
import { PauseStartEvent } from "./events/pause_start_event.js";
import { PlantEvent } from "./events/plant_event.js";
import { RoundEndCoolDownEvent } from "./events/round_end_cooldown_event.js";
import { RoundEndEvent } from "./events/round_end_event.js";
import { RoundStartEvent } from "./events/round_start_event.js";
import { SmokeEvent } from "./events/smoke_event.js";
import { SoundEvent } from "./events/sound_event.js";
import { ThrowEvent } from "./events/throw_event.js";
import { GameException } from "./game_exception.js";
import { GameProperty } from "./game_property.js";
import { GameState } from "./game_state.js";
import { Score } from "./score.js";
import { millisecondsToFrames } from "./util.js";
import { World } from "./world/index.js";

/**
 * Port of server/src/Core/Game.php
 * Game core: tick loop, rounds, economy, events.
 */
export class Game {
    /** @type {Bomb} PHP public readonly Bomb $bomb */
    bomb;
    /** @type {World} PHP private World $world */
    world;
    /** @type {Score} PHP private Score $score */
    score;
    /** @type {GameState} PHP private GameState $state */
    state;
    /** @type {Backtrack} PHP private Backtrack $backtrack */
    backtrack;
    /** @type {GameProperty} PHP private GameProperty $properties */
    properties;
    /** @type {?GameOverEvent} PHP private ?GameOverEvent $gameOver */
    gameOver = null;
    /** @type {PauseStartEvent} PHP private PauseStartEvent $startRoundFreezeTime */
    startRoundFreezeTime;
    /** @type {Record<number, object>} PHP private Player[] $players */
    players = {};
    /** @type {Record<number, object>} PHP private Event[] $events */
    events = {};
    /** @type {object[]} PHP private list<Event> $tickEvents */
    tickEvents = [];
    /** @type {number} PHP protected int $tick (renamed: field would collide with the tick() method) */
    tickId = 0;
    /** @type {number} PHP private int $eventId */
    eventId = 0;
    /** @type {number} PHP private int $roundNumber */
    roundNumber = 1;
    /** @type {number} PHP private int $roundStartTickId */
    roundStartTickId = 0;
    /** @type {number} PHP private int $roundTickCount */
    roundTickCount;
    /** @type {number} PHP private int $buyTimeTickCount */
    buyTimeTickCount;
    /** @type {number} PHP private int $playersCountAttackers */
    playersCountAttackers = 0;
    /** @type {number} PHP private int $playersCountDefenders */
    playersCountDefenders = 0;
    /** @type {boolean} PHP private bool $paused */
    paused = true;
    /** @type {boolean} PHP private bool $roundEndCoolDown */
    roundEndCoolDown = false;
    /** @type {boolean} PHP private bool $bombPlanted (renamed: field would collide with the bombPlanted() method) */
    bombPlantedState = false;
    /** @type {?number} PHP private ?int $bombEventId */
    bombEventId = null;

    constructor(properties = new GameProperty()) {
        this.bomb = new Bomb(properties.bomb_plant_time_ms, properties.bomb_defuse_time_ms);
        this.state = new GameState(this);
        this.score = new Score(properties.loss_bonuses);
        this.backtrack = new Backtrack(this, properties.backtrack_history_tick_count);
        this.properties = properties;
        this.world = new World(this);

        this.initialize();
    }

    initialize() {
        this.roundTickCount = millisecondsToFrames(this.properties.round_time_ms);
        this.buyTimeTickCount = millisecondsToFrames(this.properties.buy_time_sec * 1000);
        this.startRoundFreezeTime = new PauseStartEvent(
            this,
            PauseReason.FREEZE_TIME,
            () => {
                this.paused = false;
                this.addEvent(new PauseEndEvent());
                this.addEvent(
                    new RoundStartEvent(this.playersCountAttackers, this.playersCountDefenders, () => {
                        this.roundEndCoolDown = false;
                        this.roundStartTickId = this.getTickId();
                    }),
                );
            },
            this.properties.freeze_time_sec * 1000,
        );
        this.addEvent(this.startRoundFreezeTime);
    }

    /** @returns {?GameOverEvent} */
    tick() {
        if (this.gameOver) {
            this.tickEvents = [this.gameOver];
            return this.gameOver;
        }

        const alivePlayers = [0, 0];
        if (!this.isPaused()) {
            this.backtrack.startState();
        }
        for (const player of Object.values(this.players)) {
            if (!player.isAlive()) {
                continue;
            }

            player.onTick(this.tickId);
            if (player.isAlive()) {
                alivePlayers[player.isPlayingOnAttackerSide() ? 1 : 0]++;
                if (!this.isPaused()) {
                    this.backtrack.addStateData(player);
                }
            }
        }
        if (!this.isPaused()) {
            this.backtrack.finishState();
        }
        if (!this.roundEndCoolDown) {
            this.checkRoundEnd(alivePlayers[0], alivePlayers[1]);
        }
        this.processEvents();
        this.tickId++;
        return null;
    }

    /** @param {number} defendersAlive PHP int */
    checkRoundEnd(defendersAlive, attackersAlive) {
        if (this.playersCountAttackers > 0 && attackersAlive === 0 && !this.bombPlantedState) {
            this.roundEnd(false, RoundEndReason.ALL_ENEMIES_ELIMINATED);
            return;
        }
        if (this.playersCountDefenders > 0 && defendersAlive === 0) {
            this.roundEnd(true, RoundEndReason.ALL_ENEMIES_ELIMINATED);
            return;
        }

        if (!this.bombPlantedState && this.roundStartTickId + this.roundTickCount === this.tickId) {
            this.roundEnd(false, RoundEndReason.TIME_RUNS_OUT);
            return;
        }
    }

    /** @param {object} event PHP Event */
    addEvent(event) {
        const eventId = this.eventId++;
        this.events[eventId] = event;
        event.customId = eventId;
        event.onComplete.push((e) => this.removeEvent(e.customId));

        this.tickEvents.push(event);
        return eventId;
    }

    removeEvent(eventId) {
        delete this.events[eventId];
    }

    processEvents() {
        if (Object.keys(this.events).length === 0) {
            this.eventId = 0;
            return;
        }

        for (const event of Object.values(this.events)) {
            event.process(this.tickId);
        }
    }

    getPlayer(id) {
        return this.players[id];
    }

    /** @param {object} player PHP Player */
    addPlayer(player) {
        if (this.players[player.getId()] !== undefined) {
            throw new GameException(`Player with ID '${player.getId()}' is already in game!`);
        }

        player.setWorld(this.world);
        player.getInventory().earnMoney(this.properties.start_money);
        const spawnPosition = this.getWorld().getPlayerSpawnPosition(
            player.isPlayingOnAttackerSide(),
            this.properties.randomize_spawn_position,
        );
        player.setPosition(spawnPosition);
        player
            .getSight()
            .lookHorizontal(
                this.getWorld().getPlayerSpawnRotationHorizontal(
                    player.isPlayingOnAttackerSide(),
                    this.properties.randomize_spawn_position ? 80 : 0,
                ),
            );

        this.players[player.getId()] = player;
        this.world.addPlayer(player);
        if (player.isPlayingOnAttackerSide()) {
            this.playersCountAttackers++;
            if (this.playersCountAttackers === 1) {
                this.spawnBomb();
            }
        } else {
            this.playersCountDefenders++;
        }
        this.score.addPlayer(player);
    }

    /** @param {number} reason PHP GameOverReason */
    quit(reason) {
        this.gameOver = new GameOverEvent(reason);
        this.tickEvents = [this.gameOver];
    }

    isPaused() {
        return this.paused;
    }

    isBombActive() {
        return this.bombPlantedState && this.bombEventId !== null;
    }

    getTickId() {
        return this.tickId;
    }

    playersCanBuy() {
        return this.isPaused() || this.tickId <= this.roundStartTickId + this.buyTimeTickCount;
    }

    /** @param {object} map PHP Map */
    loadMap(map) {
        this.bomb.setMaxBlastDistance(map.getBombMaxBlastDistance());
        return this.world.loadMap(map);
    }

    getWorld() {
        return this.world;
    }

    /** @returns {object[]} PHP list<Event> */
    consumeTickEvents() {
        const events = this.tickEvents;
        this.tickEvents = [];
        return events;
    }

    getRoundNumber() {
        return this.roundNumber;
    }

    addSoundEvent(event) {
        this.addEvent(event);
    }

    addThrowEvent(event) {
        this.addEvent(event);
    }

    addGrillEvent(event) {
        this.addEvent(event);
    }

    addSmokeEvent(event) {
        this.addEvent(event);
    }

    addDropEvent(event) {
        this.addEvent(event);
    }

    /** @param {object} playerDead PHP Player, @param {object} bullet PHP Bullet */
    playerAttackKilledEvent(playerDead, bullet, headShot) {
        this.playerKilledEvent(
            this.players[bullet.getOriginPlayerId()],
            playerDead,
            bullet.getShootItem().getId(),
            headShot,
        );
    }

    /** @param {object} playerCulprit PHP Player, @param {object} item PHP Grenade */
    playerGrenadeKilledEvent(playerCulprit, playerDead, item) {
        let moneyAward = item.getKillAward();
        if (playerCulprit.isPlayingOnAttackerSide() === playerDead.isPlayingOnAttackerSide()) {
            moneyAward = -300;
        }
        playerCulprit.getInventory().earnMoney(moneyAward);
        this.playerKilledEvent(playerCulprit, playerDead, item.getId(), false);
    }

    /** @param {number} itemId PHP int */
    playerKilledEvent(playerCulprit, playerDead, itemId, headShot) {
        if (playerDead.isPlayingOnAttackerSide() === playerCulprit.isPlayingOnAttackerSide()) {
            // team kill
            this.score.getPlayerStat(playerCulprit.getId()).removeKill();
        } else {
            this.score.getPlayerStat(playerCulprit.getId()).addKill(headShot);
        }
        this.score.getPlayerStat(playerDead.getId()).addDeath();

        this.addEvent(new KillEvent(playerDead, playerCulprit, itemId, headShot));
        const soundEvent = new SoundEvent(playerDead.getPositionClone(), SoundType.PLAYER_DEAD);
        this.addSoundEvent(soundEvent.setPlayer(playerDead));
    }

    playerFallDamageKilledEvent(playerDead) {
        this.score.getPlayerStat(playerDead.getId()).removeKill();
        this.score.getPlayerStat(playerDead.getId()).addDeath();

        this.addEvent(new KillEvent(playerDead, playerDead, ItemId.SOLID_SURFACE, false));
        const soundEvent = new SoundEvent(playerDead.getPositionClone(), SoundType.PLAYER_DEAD);
        this.addSoundEvent(soundEvent.setPlayer(playerDead));
    }

    playerBombKilledEvent(playerDead) {
        this.addEvent(new KillEvent(playerDead, playerDead, ItemId.BOMB, false));
        const soundEvent = new SoundEvent(playerDead.getPositionClone(), SoundType.PLAYER_DEAD);
        this.addSoundEvent(soundEvent.setPlayer(playerDead).setItem(this.bomb));
    }

    spawnBomb() {
        this.bombReset();
        this.bombPlantedState = false;
        if (this.playersCountAttackers === 0) {
            return;
        }

        const attackers = Object.values(this.players).filter((player) => player.isPlayingOnAttackerSide());
        const bombCarrier = attackers[Math.floor(Math.random() * attackers.length)];
        bombCarrier.getInventory().pickup(this.bomb);
    }

    bombReset() {
        this.bomb.reset();
        if (this.bombEventId !== null) {
            delete this.events[this.bombEventId];
            this.bombEventId = null;
        }
    }

    bombDefused(defuser) {
        defuser.getInventory().earnMoney(300);
        const soundEvent = new SoundEvent(this.bomb.getPosition(), SoundType.BOMB_DEFUSED);
        this.addSoundEvent(soundEvent.setItem(this.bomb));
        this.roundEnd(false, RoundEndReason.BOMB_DEFUSED);
        this.bombReset();
    }

    bombPlanted(planter) {
        this.bombPlantedState = true;
        planter.getInventory().earnMoney(300);
        const soundEvent = new SoundEvent(this.bomb.getPosition(), SoundType.BOMB_PLANTED);
        this.addSoundEvent(soundEvent.setItem(this.bomb));

        const event = new PlantEvent(
            () => {
                const explodeSoundEvent = new SoundEvent(this.bomb.getPosition(), SoundType.BOMB_EXPLODED);
                this.addSoundEvent(explodeSoundEvent.setItem(this.bomb));
                this.roundEnd(true, RoundEndReason.BOMB_EXPLODED);

                for (const player of this.getAlivePlayers()) {
                    this.bomb.explodeDamageToPlayer(player);
                    if (!player.isAlive()) {
                        this.playerBombKilledEvent(player);
                    }
                }
                this.bombEventId = null;
            },
            this.properties.bomb_explode_time_ms,
            this.bomb.getPosition(),
        );
        this.bombEventId = this.addEvent(event);
    }

    /** @param {number} reason PHP RoundEndReason */
    roundEnd(attackersWins, reason) {
        this.roundEndCoolDown = true;
        const roundEndEvent = new RoundEndEvent(this, attackersWins, reason);
        roundEndEvent.onComplete.push(() => this.endRound(roundEndEvent));
        this.addEvent(roundEndEvent);
    }

    /** @param {object} roundEndEvent PHP RoundEndEvent */
    endRound(roundEndEvent) {
        this.roundNumber++;
        this.score.roundEnd(roundEndEvent);

        if (this.roundNumber > this.properties.max_rounds) {
            if (this.score.isTie()) {
                this.gameOver = new GameOverEvent(GameOverReason.TIE);
            } else {
                this.gameOver = new GameOverEvent(
                    this.score.attackersIsWinning() ? GameOverReason.ATTACKERS_WINS : GameOverReason.DEFENDERS_WINS,
                );
            }
            return;
        }

        const startRoundFreezeTime = this.startRoundFreezeTime;
        startRoundFreezeTime.reset();

        const isHalftime =
            this.properties.max_rounds > 1 && Math.floor(this.properties.max_rounds / 2) + 1 === this.roundNumber;
        let event;
        if (isHalftime) {
            const callback = () => {
                this.halfTimeSwapTeams();
                this.roundReset(true, roundEndEvent);
                this.addEvent(startRoundFreezeTime);
            };
            event = new PauseStartEvent(
                this,
                PauseReason.HALF_TIME,
                callback,
                this.properties.half_time_freeze_sec * 1000,
            );
            this.paused = true;
        } else {
            event = new RoundEndCoolDownEvent(() => {
                this.paused = true;
                this.roundReset(false, roundEndEvent);
                this.addEvent(startRoundFreezeTime);
            }, this.properties.round_end_cool_down_sec * 1000);
        }

        this.addEvent(event);
    }

    halfTimeSwapTeams() {
        const attackersCount = this.playersCountAttackers;
        this.playersCountAttackers = this.playersCountDefenders;
        this.playersCountDefenders = attackersCount;
        this.score.swapTeams();

        for (const player of Object.values(this.players)) {
            player.swapTeam();
            player.getInventory().earnMoney(-player.getInventory().getDollars());
            player.getInventory().earnMoney(this.properties.start_money);
            player.getInventory().reset(player.isPlayingOnAttackerSide(), true);
        }
    }

    /** @param {boolean} firstRound PHP bool */
    roundReset(firstRound, roundEndEvent) {
        this.backtrack.reset();
        this.world.roundReset();

        for (const event of Object.values(this.events)) {
            if (isForOneRoundMax(event)) {
                this.removeEvent(event.customId);
            }
        }

        const randomizeSpawn = this.properties.randomize_spawn_position;
        for (const player of Object.values(this.players)) {
            if (!firstRound) {
                player.getInventory().earnMoney(this.calculateRoundMoneyAward(roundEndEvent, player));
            }
            player.roundReset();
            const spawnPosition = this.getWorld().getPlayerSpawnPosition(
                player.isPlayingOnAttackerSide(),
                randomizeSpawn,
            );
            player
                .getSight()
                .lookHorizontal(
                    this.getWorld().getPlayerSpawnRotationHorizontal(
                        player.isPlayingOnAttackerSide(),
                        randomizeSpawn ? 80 : 0,
                    ),
                );
            player.setPosition(spawnPosition);
        }
        this.spawnBomb();
    }

    /** @returns {number} PHP int */
    calculateRoundMoneyAward(roundEndEvent, player) {
        const attackersWins = roundEndEvent.attackersWins;

        // Attacker side checks
        if (player.isPlayingOnAttackerSide()) {
            let amount = this.bombPlantedState ? 800 : 0;
            if (attackersWins) {
                switch (roundEndEvent.reason) {
                    case RoundEndReason.ALL_ENEMIES_ELIMINATED:
                        amount += 3250;
                        break;
                    case RoundEndReason.BOMB_EXPLODED:
                        amount += 3500;
                        break;
                    default:
                        GameException.invalid(`${roundEndEvent.reason}`);
                }
            } else if (this.bombPlantedState || !player.isAlive()) {
                amount += this.score.getMoneyLossBonus(true);
            }

            return amount;
        }

        // Defender side checks
        if (!attackersWins) {
            switch (roundEndEvent.reason) {
                case RoundEndReason.ALL_ENEMIES_ELIMINATED:
                case RoundEndReason.TIME_RUNS_OUT:
                    return 3250;
                case RoundEndReason.BOMB_DEFUSED:
                    return 3500;
                default:
                    GameException.invalid(`${roundEndEvent.reason}`);
            }
        }

        return this.score.getMoneyLossBonus(false);
    }

    getState() {
        return this.state;
    }

    getScore() {
        return this.score;
    }

    getProperties() {
        return this.properties;
    }

    getBacktrack() {
        return this.backtrack;
    }

    /** @returns {object[]} PHP Player[] */
    getAlivePlayers() {
        return Object.values(this.players).filter((player) => player.isAlive());
    }

    /** @returns {object[]} PHP Player[] */
    getPlayers() {
        return Object.values(this.players);
    }
}

/** PHP `$event instanceof ForOneRoundMax` - events limited to one round. */
function isForOneRoundMax(event) {
    return (
        event instanceof DropEvent ||
        event instanceof ThrowEvent ||
        event instanceof GrillEvent ||
        event instanceof SmokeEvent
    );
}
