/**
 * 房主模拟 Worker:在独立线程跑完整的服务端模拟(HostSession + Game),
 * 固定 10ms tick;输入经 InputRepeater 还原为 100Hz 命令流。
 *
 * 消息协议(主线程 <-> worker):
 *   -> {t:'start', playersMax, tickMs, warmupInstantStart, roster:[{code, isBot}]}
 *   -> {t:'cmd', playerId, cmd}      客户端命令串(~30Hz,可重复)
 *   -> {t:'drop', playerId}          玩家断开
 *   -> {t:'stop'}
 *   <- {t:'ready'}
 *   <- {t:'snap', s:<serialized JSON>}  每 tick 一次(含玩家与事件)
 *   <- {t:'ev', e:<event>}              事件即时转发
 *
 * roster:非 bot 条目按顺序登录,playerId 从 1 递增(与 SimHost 的
 * 玩家列表顺序一致);bot 条目由 BotController.addBot(code) 自行登录。
 */
import { GameFactory } from "../server/game_factory.js";
import { HostSession } from "../server/host_session.js";
import { loadDefaultMap } from "../server/map_loader.js";
import { ServerSetting } from "../server/server_setting.js";
import { InputRepeater } from "./input_repeater.js";

let host = null;
let repeater = null;
let botController = null;
let tickTimer = null;
let started = false;

self.onmessage = async (event) => {
    const msg = event.data;
    switch (msg.t) {
        case "start": {
            if (started) {
                return;
            }
            started = true;
            try {
                await startGame(msg);
                self.postMessage({ t: "ready" });
            } catch (error) {
                self.postMessage({ t: "error", message: String(error) });
            }
            break;
        }
        case "cmd": {
            if (repeater) {
                repeater.onCommand(msg.playerId, msg.cmd);
            }
            break;
        }
        case "drop": {
            if (repeater) {
                repeater.drop(msg.playerId);
            }
            break;
        }
        case "stop": {
            stopLoop();
            break;
        }
        default:
            break;
    }
};

async function startGame(msg) {
    const map = await loadDefaultMap();
    const game = GameFactory.createDefaultCompetitive();
    game.loadMap(map);

    const realCount = msg.roster.filter((entry) => !entry.isBot).length;
    const setting = new ServerSetting(
        msg.playersMax,
        msg.tickMs,
        "acode",
        "dcode",
        msg.warmupInstantStart,
        msg.warmupWaitSec,
    );
    host = new HostSession(game, setting);
    repeater = new InputRepeater();

    // BotController 不可用时,不填 bot,playersMax 降为真人数量保证开赛
    let botSupport = true;
    try {
        const module = await import("../server/bot_controller.js");
        botController = new module.BotController(host, game, game.getWorld());
    } catch (error) {
        console.warn("[sim.worker] BotController unavailable, bots disabled:", error);
        botSupport = false;
    }
    if (!botSupport && setting.playersMax > realCount) {
        setting.playersMax = realCount;
    }

    host.onSnapshot((snap) => self.postMessage({ t: "snap", s: snap }));
    // 事件对象含 onComplete 闭包,无法结构化克隆;发送序列化形态
    // {code, data}(与 TextProtocol 线上格式一致,客户端 EventProcessor 直接消费)
    host.onEvent((ev) => self.postMessage({ t: "ev", e: { code: ev.getCode(), data: ev.serialize() } }));

    for (const entry of msg.roster) {
        if (entry.isBot) {
            if (botController) {
                botController.addBot(entry.code);
            }
            continue;
        }
        const playerId = host.login(entry.code);
        if (playerId === null) {
            self.postMessage({ t: "error", message: `login failed for roster ${entry.code}` });
            return;
        }
    }

    tickTimer = setInterval(tickLoop, setting.tickMs);
}

function tickLoop() {
    for (const key of Object.keys(host.clients)) {
        const playerId = Number(key);
        const cmd = repeater.getCommand(playerId);
        if (cmd !== "") {
            host.recvCommand(playerId, cmd);
        }
    }
    if (botController) {
        botController.onTick();
    }
    host.tick();
}

function stopLoop() {
    if (tickTimer !== null) {
        clearInterval(tickTimer);
        tickTimer = null;
    }
}
