import { expect, test } from "bun:test";
import { BotController } from "../../assets/js/server/bot_controller.js";
import { EventList, GameOverReason, InventorySlot } from "../../assets/js/server/enums.js";
import { Floor } from "../../assets/js/server/floor.js";
import { Game } from "../../assets/js/server/game.js";
import { GameProperty } from "../../assets/js/server/game_property.js";
import { HostSession } from "../../assets/js/server/host_session.js";
import { loadDefaultMap } from "../../assets/js/server/map_loader.js";
import { Point } from "../../assets/js/server/point.js";
import { ServerSetting } from "../../assets/js/server/server_setting.js";
import { TextProtocol } from "../../assets/js/server/text_protocol.js";
import { Wall } from "../../assets/js/server/wall.js";

// ---------------------------------------------------------------------------
// 对局构造(参考 game.test.js / host_session.test.js / world.test.js)
// ---------------------------------------------------------------------------

/** default-map.json 加载器(Bun 环境注入,替代 map_loader 的 fetch)。 */
async function loadJson() {
    return Bun.file(new URL("../../resources/map/default-map.json", import.meta.url)).json();
}

/** 真实地图 + 快速回合配置(3 回合 x 5s)。 */
async function createDefaultGame() {
    const loadedMap = await loadDefaultMap(loadJson);
    // map_loader 产出的地图对象缺 getBombMaxBlastDistance;且其购买区 contains
    // 只接受 getX()/getY()/getZ() 形式的点(login 的 snapshot 就会触发),这里
    // 换成 Point 兼容实现(测试里当作"总是在购买区")。
    const map = {
        ...loadedMap,
        getBombMaxBlastDistance: () => 1000,
        getBuyArea: () => ({ contains: () => true }),
    };
    const props = new GameProperty();
    props.freeze_time_sec = 0;
    props.half_time_freeze_sec = 0;
    props.round_end_cool_down_sec = 0;
    props.randomize_spawn_position = false;
    props.round_time_ms = 5000;
    props.max_rounds = 3;
    const game = new Game(props);
    game.loadMap(map);
    return game;
}

/** 600x600 小竞技场:两块出生点互相可见,navmesh 可完整构建。 */
function createArenaGame() {
    // 地板延伸到围墙外很远:子弹可能从墙边缘穿透或飞过墙顶,落到墙外
    // 的地板上停下来,避免服务端 isFloorAt 在 y<0 时抛异常(小地图边界问题)。
    const floor = new Floor(new Point(-3000, 0, -3000), 6000, 6000);
    // 围墙做成长条且互相交叠,把 600x600 的对战区完全围死。
    const walls = [
        new Wall(new Point(-3000, 0, 0), true, 6000, 400),
        new Wall(new Point(-3000, 0, 600), true, 6000, 400),
        new Wall(new Point(0, 0, -3000), false, 6000, 400),
        new Wall(new Point(600, 0, -3000), false, 6000, 400),
    ];
    const map = {
        name: "arena",
        getBombMaxBlastDistance: () => 1000,
        getWalls: () => walls,
        getFloors: () => [floor],
        getSpawnPositionAttacker: () => [new Point(200, 0, 300)],
        getSpawnPositionDefender: () => [new Point(400, 0, 300)],
        getSpawnRotationAttacker: () => 0,
        getSpawnRotationDefender: () => 180,
        getStartingPointsForNavigationMesh: () => [new Point(200, 0, 300), new Point(400, 0, 300)],
        getBuyArea: () => ({ contains: () => true }),
        getPlantArea: () => ({ contains: () => false }),
    };
    const props = new GameProperty();
    props.freeze_time_sec = 0;
    props.half_time_freeze_sec = 0;
    props.round_end_cool_down_sec = 0;
    props.randomize_spawn_position = false;
    props.round_time_ms = 30000;
    props.max_rounds = 2;
    const game = new Game(props);
    game.loadMap(map);
    return game;
}

/** 满员即开局的 HostSession(tick 20ms,攻击方 acode / 防守方 dcode)。 */
function createHost(game, playersMax = 2) {
    return new HostSession(game, new ServerSetting(playersMax, 20, "acode", "dcode"));
}

/** 跑 N 个 tick(onTick 注入命令 -> host.tick),返回每次 onTick 的结果。 */
function runTicks(controller, host, count) {
    const results = [];
    for (let i = 0; i < count; i++) {
        results.push(controller.onTick());
        host.tick();
    }
    return results;
}

// ---------------------------------------------------------------------------
// 测试
// ---------------------------------------------------------------------------

test("BotController: addBot 登录成功并正确跟踪 bot", async () => {
    const game = await createDefaultGame();
    const host = createHost(game);
    const controller = new BotController(host, game, game.getWorld());

    expect(controller.getBotCount()).toBe(0);
    expect(controller.addBot("acode")).toBe(1);
    expect(controller.addBot("dcode")).toBe(2);
    expect(controller.addBot("wrong-code")).toBe(null); // 无效登录码

    expect(controller.getBotCount()).toBe(2);
    expect(controller.isBot(1)).toBe(true);
    expect(controller.isBot(2)).toBe(true);
    expect(controller.isBot(3)).toBe(false);
    expect(game.getPlayer(1).isPlayingOnAttackerSide()).toBe(true);
    expect(game.getPlayer(2).isPlayingOnAttackerSide()).toBe(false);

    expect(controller.removeBot(1)).toBe(true);
    expect(controller.removeBot(99)).toBe(false);
    expect(controller.getBotCount()).toBe(1);
    expect(controller.isBot(1)).toBe(false);
});

test("BotController: 命令串使用 TextProtocol 的 wire 格式", () => {
    const protocol = new TextProtocol();
    expect(protocol.parsePlayerControlCommands("look 90.50 -12.00|attack|forward")).toEqual([
        ["look", 90.5, -12],
        ["attack"],
        ["forward"],
    ]);
    expect(protocol.parsePlayerControlCommands("forward|look 250.00 0.00|jump")).toEqual([
        ["forward"],
        ["look", 250, 0],
        ["jump"],
    ]);
    expect(protocol.parsePlayerControlCommands("buy 1|equip 1|reload")).toEqual([["buy", 1], ["equip", 1], ["reload"]]);
});

test("BotController: 真实地图上两个 bot 跑 1000+ tick 无崩溃且持续移动", async () => {
    const game = await createDefaultGame();
    const host = createHost(game);
    const controller = new BotController(host, game, game.getWorld());
    expect(controller.addBot("acode")).toBe(1);
    expect(controller.addBot("dcode")).toBe(2);

    const samples = [];
    let acceptedAny = false;
    let gameOver = null;
    for (let i = 0; i < 1000; i++) {
        const results = controller.onTick();
        for (const result of results) {
            if (result.accepted) {
                acceptedAny = true;
            }
        }
        if (i % 100 === 0) {
            samples.push([game.getPlayer(1).getPositionClone(), game.getPlayer(2).getPositionClone()]);
        }
        gameOver = host.tick();
    }

    // 命令被服务端接受(TextProtocol 解析成功且排队)
    expect(acceptedAny).toBe(true);

    // 两个 bot 都在移动(相对首个采样点的位移)
    const [firstA, firstD] = samples[0];
    let maxDistance = 0;
    for (const [attacker, defender] of samples) {
        maxDistance = Math.max(
            maxDistance,
            Math.hypot(attacker.x - firstA.x, attacker.z - firstA.z),
            Math.hypot(defender.x - firstD.x, defender.z - firstD.z),
        );
    }
    expect(maxDistance).toBeGreaterThan(150);

    // 3 回合 x 250 tick 后对局正常结束
    expect(gameOver).not.toBe(null);
    expect([GameOverReason.ATTACKERS_WINS, GameOverReason.DEFENDERS_WINS, GameOverReason.TIE]).toContain(
        gameOver.reason,
    );
}, 120000);

test("BotController: 竞技场中两个敌队 bot 互相对局(击杀 -> 回合循环)", () => {
    const game = createArenaGame();
    const host = createHost(game);
    const controller = new BotController(host, game, game.getWorld());
    controller.addBot("acode");
    controller.addBot("dcode");

    const eventCodes = [];
    host.onEvent((event) => eventCodes.push(event.getCode()));
    runTicks(controller, host, 1200);

    expect(eventCodes.filter((code) => code === EventList.KillEvent).length).toBeGreaterThan(0);
    expect(game.getRoundNumber()).toBeGreaterThan(1); // 至少打完一个完整回合
});

test("BotController: 有钱且可购买时 bot 会买主武器", () => {
    const game = createArenaGame();
    game.getProperties().start_money = 16000;
    const host = createHost(game);
    const controller = new BotController(host, game, game.getWorld());
    controller.addBot("acode");
    controller.addBot("dcode");

    let buyAccepted = false;
    for (let i = 0; i < 30; i++) {
        for (const result of controller.onTick()) {
            if (result.accepted && result.command.startsWith("buy ")) {
                buyAccepted = true;
            }
        }
        host.tick();
    }

    expect(buyAccepted).toBe(true);
    expect(game.getPlayer(1).getInventory().has(InventorySlot.SLOT_PRIMARY)).toBe(true);
});

test("BotController: 每条被接受的命令串都能被 TextProtocol 再次解析", () => {
    const game = createArenaGame();
    const host = createHost(game);
    const controller = new BotController(host, game, game.getWorld());
    controller.addBot("acode");
    controller.addBot("dcode");

    const protocol = new TextProtocol();
    let checked = 0;
    for (let i = 0; i < 300; i++) {
        for (const result of controller.onTick()) {
            if (result.command !== "" && result.accepted) {
                expect(protocol.parsePlayerControlCommands(result.command).length).toBeGreaterThan(0);
                checked++;
            }
        }
        host.tick();
    }
    expect(checked).toBeGreaterThan(0);
});
