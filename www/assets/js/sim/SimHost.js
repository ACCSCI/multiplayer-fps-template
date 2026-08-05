/**
 * SimHost(主线程侧):房主浏览器里管理模拟 Worker,并把对局状态桥接到
 * VibeHub room:
 *   - 快照(players)经 sendRealtime 以 20Hz 广播(可丢,最新胜出)
 *   - 事件经 send 可靠即时转发(不可丢)
 *   - GameStartEvent 定向发送给对应玩家(每个玩家自己的 playerId)
 * 本地(房主自己)通过 onFeed 回调获得同样的快照/事件流,与远程客户端一致。
 */
import { EventList } from "../server/enums.js";

const SNAPSHOT_HZ = 20;
const SNAPSHOT_INTERVAL_MS = 1000 / SNAPSHOT_HZ;
const ATTACKER_CODE = "acode";
const DEFENDER_CODE = "dcode";

export class SimHost {
    #room;
    #worker;
    #playersMax;
    #roster = [];
    #peerByPlayerId = {};
    #latestPlayers = null;
    #broadcastTimer = null;
    #feedCallback = null;
    #pendingFeed = [];
    #started = false;

    constructor(room, playersMax = 10) {
        this.#room = room;
        this.#playersMax = playersMax;
    }

    /** 玩家列表:{peerId|null(房主自己), name}[];真人在前,bot 自动补位到 playersMax */
    async start(playerList) {
        const roster = buildRoster(playerList, this.#playersMax);
        this.#roster = roster;
        this.#peerByPlayerId = {};
        roster.forEach((entry, index) => {
            const playerId = index + 1;
            entry.playerId = playerId;
            if (entry.peerId !== null) {
                this.#peerByPlayerId[playerId] = entry.peerId;
            }
        });

        this.#worker = new Worker("./assets/js/sim/sim.worker.js", { type: "module" });
        this.#worker.onmessage = (event) => this.#onWorkerMessage(event.data);

        await new Promise((resolve, reject) => {
            this.#worker.onerror = (error) => {
                reject(new Error(`Sim worker failed: ${error.message}`));
            };
            const readyHandler = (event) => {
                if (event.data.t === "ready") {
                    this.#worker.onmessage = (e) => this.#onWorkerMessage(e.data);
                    this.#worker.onerror = null;
                    resolve();
                } else if (event.data.t === "error") {
                    reject(new Error(event.data.message));
                }
            };
            this.#worker.onmessage = readyHandler;
        });

        this.#worker.postMessage({
            t: "start",
            playersMax: this.#playersMax,
            tickMs: 10,
            warmupInstantStart: true,
            warmupWaitSec: 60,
            roster: this.#roster.map((entry) => ({ code: entry.code, isBot: entry.isBot })),
        });

        await new Promise((resolve, reject) => {
            const timer = setInterval(() => {
                if (this.#started) {
                    clearInterval(timer);
                    resolve();
                }
            }, 20);
            setTimeout(() => {
                clearInterval(timer);
                reject(new Error("Sim worker start timeout"));
            }, 30000);
        });

        this.#broadcastTimer = setInterval(() => this.#broadcastSnapshot(), SNAPSHOT_INTERVAL_MS);
    }

    /** 房主自己的输入命令串(~30Hz) */
    sendCommand(commandString) {
        const myPlayerId = this.#roster[0]?.playerId;
        if (myPlayerId !== undefined && this.#worker) {
            this.#worker.postMessage({ t: "cmd", playerId: myPlayerId, cmd: commandString });
        }
    }

    /** 本地消费流(与远程客户端同构):{t:'start',d}|{t:'snap',players}|{t:'ev',e} */
    onFeed(callback) {
        this.#feedCallback = callback;
        const pending = this.#pendingFeed;
        this.#pendingFeed = [];
        for (const msg of pending) {
            callback(msg);
        }
    }

    /** feed 回调未设置前暂存消息,设置后补发(worker 启动先于 connect) */
    #emit(msg) {
        if (this.#feedCallback) {
            this.#feedCallback(msg);
        } else {
            this.#pendingFeed.push(msg);
        }
    }

    getRoster() {
        return this.#roster;
    }

    close() {
        if (this.#broadcastTimer !== null) {
            clearInterval(this.#broadcastTimer);
            this.#broadcastTimer = null;
        }
        if (this.#worker) {
            this.#worker.postMessage({ t: "stop" });
            this.#worker.terminate();
            this.#worker = null;
        }
    }

    #onWorkerMessage(msg) {
        if (msg.t === "ready") {
            this.#started = true;
            return;
        }
        if (msg.t === "error") {
            console.error(`[SimHost] worker error: ${msg.message}`);
            return;
        }
        if (msg.t === "snap") {
            this.#onSnapshot(msg.s);
            return;
        }
        if (msg.t === "ev") {
            this.#relayEvent(msg.e);
            return;
        }
    }

    /** worker 每 tick 全量序列化;提取 GameStartEvent 定向发送,其余只保留 players */
    #onSnapshot(serialized) {
        let state;
        try {
            state = JSON.parse(serialized);
        } catch (error) {
            console.warn(`[SimHost] snapshot parse failed: ${error}`);
            return;
        }
        if (Array.isArray(state.events)) {
            for (const event of state.events) {
                if (event.code === EventList.GameStartEvent) {
                    this.#sendStart(event.data);
                }
            }
        }
        this.#latestPlayers = state.players ?? [];
    }

    #sendStart(data) {
        const playerId = data.playerId;
        const peerId = this.#peerByPlayerId[playerId];
        const message = { t: "start", d: data };
        this.#emit(message);
        if (peerId !== undefined) {
            this.#room.send(message, peerId);
        }
    }

    #relayEvent(event) {
        const message = { t: "ev", e: event };
        this.#emit(message);
        this.#room.send(message);
    }

    #broadcastSnapshot() {
        if (this.#latestPlayers === null) {
            return;
        }
        const message = { t: "s", p: this.#latestPlayers };
        this.#emit({ t: "snap", players: this.#latestPlayers });
        this.#room.sendRealtime(JSON.stringify(message));
    }
}

/** 队伍分配:前一半进攻方,后一半防守方;不足补 bot(平衡两队) */
function buildRoster(playerList, playersMax) {
    const humans = playerList.slice(0, playersMax);
    const attackerCount = Math.ceil(playersMax / 2);
    const humanAttackers = Math.min(attackerCount, humans.length);
    const humanDefenders = humans.length - humanAttackers;
    const botAttackers = attackerCount - humanAttackers;
    const botDefenders = playersMax - attackerCount - humanDefenders;

    const roster = [];
    for (const human of humans) {
        roster.push({ peerId: human.peerId, name: human.name, isBot: false });
    }
    for (let i = 0; i < botAttackers; i++) {
        roster.push({ peerId: null, name: `Bot-${i + 1}`, isBot: true });
    }
    for (let i = 0; i < botDefenders; i++) {
        roster.push({ peerId: null, name: `Bot-${botAttackers + i + 1}`, isBot: true });
    }
    // 按队伍分配登录码:进攻方用 acode,防守方用 dcode
    roster.forEach((entry, index) => {
        entry.code = index < attackerCount ? ATTACKER_CODE : DEFENDER_CODE;
    });
    return roster;
}
