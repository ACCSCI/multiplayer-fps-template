import { Bot, botDefaultOptions } from "./bot.js";

/**
 * BotController:在房主端为对局自动补位 Bot。
 *
 * 用法(与 host.tick() 每 tick 配合):
 *   const controller = new BotController(host, game, game.getWorld());
 *   controller.addBot("acode");   // 内部 host.login("acode")
 *   controller.addBot("dcode");
 *   for (...) {
 *       controller.onTick();  // 生成命令串并通过 host.recvCommand() 注入
 *       host.tick();
 *   }
 *
 * onTick() 返回 [{ playerId, command, accepted }],方便上层/测试观察
 * 每条命令是否被服务端接受(accepted === true 即 TextProtocol 解析成功)。
 */
export class BotController {
    constructor(host, game, world, options = {}) {
        /** @type {object} HostSession */
        this.host = host;
        /** @type {object} Game */
        this.game = game;
        /** @type {object} World */
        this.world = world;
        /** @type {object} 合并后的选项(默认值见 botDefaultOptions) */
        this.options = { ...botDefaultOptions, ...options };
        /** @type {Map<number, Bot>} [playerId => Bot] */
        this.bots = new Map();
    }

    /**
     * 登录一个新 Bot 并纳入管理。
     * @param {string} teamCode 服务端登录码(ServerSetting.attackerCode/defenderCode)
     * @returns {?number} playerId;登录失败或异常返回 null
     */
    addBot(teamCode) {
        try {
            const playerId = this.host.login(teamCode);
            if (playerId === null) {
                return null;
            }
            this.bots.set(playerId, new Bot(this.game, this.world, playerId, this.options));
            return playerId;
        } catch (error) {
            this.log(`addBot failed: ${error.message}`);
            return null;
        }
    }

    /**
     * 每个 tick 调用一次:为所有 Bot 生成命令并通过 host.recvCommand() 注入。
     * @returns {{playerId: number, command: string, accepted: boolean}[]}
     */
    onTick() {
        const results = [];
        for (const bot of this.bots.values()) {
            const command = bot.tick();
            let accepted = false;
            if (command !== "") {
                accepted = this.host.recvCommand(bot.playerId, command);
            }
            results.push({ playerId: bot.playerId, command, accepted });
        }
        return results;
    }

    getBotCount() {
        return this.bots.size;
    }

    isBot(playerId) {
        return this.bots.has(playerId);
    }

    /**
     * 停止对一个 Bot 下发命令(玩家本身仍留在对局中)。
     * @returns {boolean} 是否存在并已移除
     */
    removeBot(playerId) {
        return this.bots.delete(playerId);
    }

    /** @returns {Bot[]} 受管理的 Bot 列表 */
    getBots() {
        return [...this.bots.values()];
    }

    log(message) {
        const logger = this.options.logger;
        if (logger !== null && typeof logger.log === "function") {
            logger.log("warning", `[bot-controller] ${message}`);
        }
    }
}
