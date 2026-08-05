/**
 * 输入保持器:把 ~30Hz 的客户端输入串,在房主 100Hz tick 循环里
 * 还原成"保持状态每 tick 重放、边沿动作只应用一次"的命令流。
 *
 * 客户端 PlayerAction 的语义:移动/朝向/look/use/attack 是保持态(按住期间
 * 每个包都带),jump/reload/equip/buy/drop 是边沿(仅出现一次)。
 * PHP 服务端原设计要求客户端每 tick 发命令(100Hz);P2P 输入上行 ≤30Hz,
 * 因此用本模块在 worker 内按 tick 重放保持态,游戏手感与原版一致。
 */

const HELD_COMMANDS = new Set([
    "forward",
    "left",
    "right",
    "backward",
    "walk",
    "crouch",
    "stand",
    "run",
    "use",
    "attack",
    "attack2",
]);

export class InputRepeater {
    /** @type {Record<number, {held: string[], edges: string[]}>} */
    #state = {};

    /** 收到新的客户端命令串(约 30Hz) */
    onCommand(playerId, commandString) {
        const tokens = commandString.split("|").filter((token) => token.length > 0);
        const held = [];
        const edges = [];
        for (const token of tokens) {
            if (HELD_COMMANDS.has(token)) {
                held.push(token);
            } else if (token.startsWith("look ")) {
                held.push(token);
            } else {
                edges.push(token);
            }
        }
        this.#state[playerId] = { held, edges };
    }

    /** 每 tick 生成该玩家的命令串(无新输入时只重放保持态) */
    getCommand(playerId) {
        const state = this.#state[playerId];
        if (!state) {
            return "";
        }
        const edges = state.edges;
        state.edges = [];
        const parts = [...state.held, ...edges];
        return parts.length === 0 ? "" : parts.join("|");
    }

    /** 清空某玩家的输入(断线) */
    drop(playerId) {
        delete this.#state[playerId];
    }
}
