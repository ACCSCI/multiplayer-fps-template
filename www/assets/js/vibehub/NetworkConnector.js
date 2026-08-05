/**
 * VibeHub 联机连接器:统一"房主(SimHost)"与"远程玩家(room)"两种数据源,
 * 驱动游戏渲染:
 *   - 输入循环 ~30Hz:control.getTickAction() -> source.sendCommand()
 *   - start 包 -> game.gameStart()(每个玩家自己的 playerId)
 *   - 快照(players,20Hz) -> game.applySnapshot()(内部插值)
 *   - 事件(可靠) -> game.processEventData()(即时)
 * 对局结束统计击杀/胜负写入 vibe.save,房主额外汇总排行榜到 vibe.global。
 */
import { EventList, GameOverReason } from "../server/enums.js";

const INPUT_HZ = 30;
const INPUT_INTERVAL_MS = 1000 / INPUT_HZ;

export class NetworkConnector {
    #game;
    #source;
    #control;
    #inputTimer = null;
    #started = false;
    #pendingSnaps = [];
    #myPlayerId = null;
    #vibeClient = null;
    #stats = { kills: 0, deaths: 0, wins: 0, losses: 0, rounds: 0 };
    #leaderboard = null;
    #onGameOver = null;

    constructor(game, callbacks = {}) {
        this.#game = game;
        this.#onGameOver = callbacks.onGameOver ?? null;
    }

    /** 绑定数据源(SimHost 或 room)与输入控制器 */
    connect(source, control, vibeClient) {
        this.#source = source;
        this.#control = control;
        this.#vibeClient = vibeClient ?? null;
        source.setFeed((msg) => this.#onFeed(msg));
        this.#inputTimer = setInterval(() => this.#sendInput(), INPUT_INTERVAL_MS);
    }

    /** 渲染循环每帧调用:插值平滑 */
    interpolate(now) {
        this.#game.interpolate(now);
    }

    isStarted() {
        return this.#started;
    }

    close() {
        if (this.#inputTimer !== null) {
            clearInterval(this.#inputTimer);
            this.#inputTimer = null;
        }
        if (this.#source?.close) {
            this.#source.close();
        }
    }

    #sendInput() {
        if (!this.#started) {
            return;
        }
        const command = this.#control.getTickAction();
        if (command !== "") {
            this.#source.sendCommand(command);
        }
    }

    #onFeed(msg) {
        if (msg.t === "start") {
            this.#started = true;
            this.#myPlayerId = msg.d.playerId;
            this.#game.gameStart(msg.d);
            const pending = this.#pendingSnaps;
            this.#pendingSnaps = [];
            for (const snap of pending) {
                this.#game.applySnapshot(snap.players);
            }
            return;
        }
        if (!this.#started) {
            if (msg.t === "snap") {
                this.#pendingSnaps.push(msg);
            }
            return;
        }
        if (msg.t === "snap") {
            this.#game.applySnapshot(msg.players);
            return;
        }
        if (msg.t === "ev") {
            this.#onEvent(msg.e);
        }
    }

    #onEvent(event) {
        if (event.code === EventList.KillEvent) {
            const playerCulprit = event.data.playerCulprit;
            const playerDead = event.data.playerDead;
            if (playerCulprit === this.#myPlayerId) {
                this.#stats.kills++;
            }
            if (playerDead === this.#myPlayerId) {
                this.#stats.deaths++;
            }
            this.#trackLeaderboardKill(playerCulprit);
        } else if (event.code === EventList.RoundEndEvent) {
            this.#stats.rounds++;
        } else if (event.code === EventList.GameOverEvent) {
            this.#recordGameOver(event.data.reason);
        }
        this.#game.processEventData(event);
    }

    #trackLeaderboardKill(playerCulprit) {
        if (!this.#source.getRoster) {
            return; // 非房主不汇总排行榜
        }
        if (this.#leaderboard === null) {
            this.#leaderboard = new Map();
        }
        const entry = this.#leaderboard.get(playerCulprit) ?? { kills: 0 };
        entry.kills++;
        this.#leaderboard.set(playerCulprit, entry);
    }

    #recordGameOver(reason) {
        let win = false;
        let loss = false;
        if (reason === GameOverReason.ATTACKERS_WINS || reason === GameOverReason.DEFENDERS_WINS) {
            const attackersWon = reason === GameOverReason.ATTACKERS_WINS;
            const meAttacker = this.#game.playerMe?.isAttacker();
            win = meAttacker === attackersWon;
            loss = !win;
        }
        this.#stats.wins += win ? 1 : 0;
        this.#stats.losses += loss ? 1 : 0;

        const result = { ...this.#stats };
        this.#flushStats(result);
        this.#flushLeaderboard();
        if (this.#onGameOver) {
            this.#onGameOver(result, win);
        }
    }

    async #flushStats(result) {
        if (!this.#vibeClient) {
            return;
        }
        await this.#vibeClient.addMatchResult(result);
    }

    async #flushLeaderboard() {
        if (!this.#vibeClient || !this.#source.getRoster) {
            return;
        }
        const roster = this.#source.getRoster();
        const entries = [];
        for (const [playerId, stats] of this.#leaderboard ?? []) {
            const entry = roster[playerId - 1];
            if (!entry || entry.isBot) {
                continue;
            }
            entries.push({ name: entry.name ?? `Player-${playerId}`, wins: 0, kills: stats.kills });
        }
        if (entries.length > 0) {
            await this.#vibeClient.saveLeaderboard(entries);
        }
    }
}
