/**
 * VibeHub SDK 封装:登录/退出、账号状态、三层数据(存档/排行榜)。
 * 同步模型 state-sync(房主权威快照),房间与联机由 NetworkConnector 负责。
 */

// 项目 slug:来自 vibeapps 试玩地址第一段路径(vibehub list 可查)。
// TODO(发布后回填):首次发布取得真实 slug 后替换此值。
const VIBEHUB_WORK = "counter-strike-football";

const SETTINGS_KEY = "settings";
const STATS_KEY = "stats";
const LEADERBOARD_KEY = "leaderboard";

export class VibeHubClient {
    #vibe = null;
    #user = null;
    #initPromise = null;
    #authListeners = [];

    /** @returns {Promise<import("./VibeHubClient.js").VibeHubClient>} */
    init() {
        if (!this.#initPromise) {
            this.#initPromise = this.#doInit();
        }
        return this.#initPromise;
    }

    async #doInit() {
        // SDK 脚本是 async 加载:轮询等待它就绪,期间页面 UI 已正常渲染
        const deadline = Date.now() + 20000;
        while (!window.VibeHub) {
            if (Date.now() > deadline) {
                throw new Error("VibeHub SDK is not loaded (missing script tag)");
            }
            await new Promise((resolve) => setTimeout(resolve, 250));
        }
        // 失败后允许重试(如 SDK 脚本晚到或网络恢复)
        try {
            return await this.#initVibe();
        } catch (error) {
            this.#initPromise = null;
            throw error;
        }
    }

    async #initVibe() {
        console.log(`[VibeHub] SDK ${VibeHub.version} channel ${VibeHub.channel}`);
        const vibe = await VibeHub.init({ work: VIBEHUB_WORK });
        this.#vibe = vibe;
        this.#user = vibe.user;
        vibe.onAuthChange((user) => {
            this.#user = user;
            this.#authListeners.forEach((listener) => {
                listener(user);
            });
        });
        return this;
    }

    async login() {
        const vibe = await this.init();
        this.#user = await vibe.login();
        return this.#user;
    }

    logout() {
        if (!this.#vibe) {
            return;
        }
        this.#vibe.logout();
        this.#user = null;
    }

    isLoggedIn() {
        return this.#vibe?.isLoggedIn() ?? false;
    }

    getUser() {
        return this.#user;
    }

    /** 登录/退出回调;返回取消函数 */
    onAuthChange(callback) {
        this.#authListeners.push(callback);
        return () => {
            this.#authListeners = this.#authListeners.filter((listener) => listener !== callback);
        };
    }

    /**
     * 玩家设置云同步:登录时读取云端并合并回 localStorage;保存时双写。
     * 匿名玩家只用 localStorage。
     */
    async loadCloudSettings() {
        if (!this.isLoggedIn()) {
            return null;
        }
        try {
            return await this.#vibe.save.get(SETTINGS_KEY);
        } catch (error) {
            console.warn("[VibeHub] load settings failed", error);
            return null;
        }
    }

    async saveSettings(settingJson, savedAtMs) {
        if (!this.isLoggedIn()) {
            return;
        }
        try {
            await this.#vibe.save.set(SETTINGS_KEY, { v: 2, setting: settingJson, savedAt: savedAtMs });
        } catch (error) {
            console.warn("[VibeHub] save settings failed", error);
        }
    }

    /** 个人战绩(击杀/死亡/胜/负),玩家本人读写 */
    async addMatchResult(result) {
        if (!this.isLoggedIn()) {
            return null;
        }
        try {
            const stats = (await this.#vibe.save.get(STATS_KEY)) ?? { v: 2, kills: 0, deaths: 0, wins: 0, losses: 0 };
            stats.kills += result.kills ?? 0;
            stats.deaths += result.deaths ?? 0;
            stats.wins += result.wins ?? 0;
            stats.losses += result.losses ?? 0;
            stats.roundsPlayed = (stats.roundsPlayed ?? 0) + (result.rounds ?? 0);
            await this.#vibe.save.set(STATS_KEY, stats);
            return stats;
        } catch (error) {
            console.warn("[VibeHub] save stats failed", error);
            return null;
        }
    }

    async loadStats() {
        if (!this.isLoggedIn()) {
            return null;
        }
        try {
            return await this.#vibe.save.get(STATS_KEY);
        } catch (error) {
            console.warn("[VibeHub] load stats failed", error);
            return null;
        }
    }

    /** 排行榜(房主在结算时汇总写入,所有人读取) */
    async saveLeaderboard(entries) {
        if (!this.isLoggedIn()) {
            return;
        }
        try {
            const current = (await this.#vibe.global.get(LEADERBOARD_KEY)) ?? { v: 2, entries: [] };
            const merged = mergeLeaderboard(current.entries, entries);
            await this.#vibe.global.set(LEADERBOARD_KEY, { v: 2, entries: merged.slice(0, 50) });
        } catch (error) {
            console.warn("[VibeHub] save leaderboard failed", error);
        }
    }

    async loadLeaderboard() {
        try {
            const data = await this.#vibe.global.get(LEADERBOARD_KEY);
            return data?.entries ?? [];
        } catch (error) {
            console.warn("[VibeHub] load leaderboard failed", error);
            return [];
        }
    }

    getRoomApi() {
        return this.#vibe?.rooms ?? null;
    }
}

/** 按 (wins, kills) 合并排行榜条目,name 相同视为同一玩家 */
function mergeLeaderboard(current, newEntries) {
    const byName = new Map();
    for (const entry of [...current, ...newEntries]) {
        const prev = byName.get(entry.name);
        if (!prev || entry.wins > prev.wins || (entry.wins === prev.wins && entry.kills > prev.kills)) {
            byName.set(entry.name, { ...prev, ...entry });
        }
    }
    return [...byName.values()].sort((a, b) => b.wins - a.wins || b.kills - a.kills);
}
