import { BuyMenuItem, InventorySlot, ItemType } from "./enums.js";
import { GameException } from "./game_exception.js";
import { NavigationMesh } from "./navigation_mesh.js";
import { PathFinder } from "./path_finder.js";
import { Point } from "./point.js";
import { playerBoundingRadius } from "./setting.js";
import { distanceSquared, smallestDeltaAngle, worldAngle } from "./util.js";

/**
 * BotController 的默认选项,可用构造参数整体覆盖。
 */
export const botDefaultOptions = Object.freeze({
    /** navmesh tile 边长(必须为奇数且 <= playerBoundingRadius - 4) */
    tileSize: 31,
    /** navmesh 碰撞体高度 */
    objectHeight: 100,
    /** navmesh 节点数上限(大图会抛异常,见 Bot.ensurePathFinder) */
    maxNodeCount: 2000,
    /** 索敌扫描间隔(tick) */
    scanIntervalTicks: 10,
    /** 索敌最大可视距离(单位) */
    sightRange: 3000,
    /** 手持刀时使用 attack2 的距离阈值 */
    knifeRange: 220,
    /** 判定"卡住"的最小位移 */
    stuckMinMove: 4,
    /** 连续卡住多少 tick 后跳一下 */
    stuckJumpTicks: 15,
    /** 连续卡住多少 tick 后放弃当前路径 */
    stuckRepathTicks: 40,
    /** 到达路点的判定半径 */
    arriveRadius: 80,
    /** 有钱时购买主武器的概率 */
    buyChance: 0.9,
    /** 路径吸附失败后重建 navmesh 的冷却(tick) */
    rebuildCooldownTicks: 200,
    /** 定期重算路径的间隔(tick) */
    pathRecomputeTicks: 60,
    /** 错误日志,可传 host 的 logger 或 console */
    logger: null,
});

/**
 * 单个 Bot(虚拟玩家):每 tick 决策并生成一条与真人客户端相同格式的文本命令串
 * (如 "forward|look 90.50 -12.00|attack"),由 BotController 通过
 * host.recvCommand() 注入到对局中。
 *
 * 行为状态机(刻意保持简单):
 *   - 索敌:每隔 scanIntervalTicks 用 world.pointCanSeePoint 找最近可见敌人;
 *     可见则进入攻击,不可见则回到巡逻。
 *   - 攻击:面向敌人(服务端角度坐标系,参照 util.js 的 worldAngle)开火;
 *     手持刀且敌人很近时用 attack2;装弹由服务端在弹药耗尽时自动处理。
 *   - 巡逻:以 navmesh 随机 tile 为目标,PathFinder.findTile 吸附当前点,
 *     Dijkstra 最短路,沿路点逐段移动(forward + left/right,必要时 jump)。
 *   - 买枪:暂停/购买期内且在购买区、有钱时偶尔买主武器。
 *
 * 防御性:任何可能抛异常的调用(路径构建/吸附/LOS)都降级为随机方向移动,
 * 异常不会逃逸出 tick()。
 */
export class Bot {
    constructor(game, world, playerId, options) {
        this.game = game;
        this.world = world;
        this.playerId = playerId;
        this.options = options;
        /** @type {?PathFinder} 以出生点为中心构建的局部 navmesh */
        this.pathFinder = null;
        /** @type {?Point} 当前巡逻目标(navmesh tile) */
        this.patrolGoal = null;
        /** @type {Point[]} Dijkstra 路径的剩余路点(不含起点) */
        this.waypoints = [];
        this.waypointIndex = 0;
        /** @type {?string} 当前路径的起点节点 hash */
        this.pathNodeId = null;
        /** @type {?number} 当前可见敌人 playerId */
        this.visibleEnemyId = null;
        this.lastScanTick = -1;
        this.stuckTicks = 0;
        this.lastPosition = null;
        this.lastPathRecomputeTick = 0;
        this.lastRebuildTick = -1;
        this.lastRoundNumber = -1;
        this.boughtThisRound = false;
        this.wanderTicks = 0;
        this.errorCount = 0;
    }

    /**
     * 一个 tick 的决策。
     * @returns {string} 命令串(空串 = 本 tick 无命令)
     */
    tick() {
        const player = this.game.getPlayer(this.playerId);
        if (player === undefined || !player.isAlive()) {
            return "";
        }

        try {
            return this.tickAlive(player);
        } catch (error) {
            this.errorCount++;
            if (this.errorCount <= 5) {
                this.log(`tick error: ${error.message}`);
            }
            return this.safeRandomMove(player);
        }
    }

    /** 存活玩家的一个 tick(可能抛异常,由 tick() 兜底)。 */
    tickAlive(player) {
        const tickId = this.game.getTickId();
        const roundNumber = this.game.getRoundNumber();
        if (roundNumber !== this.lastRoundNumber) {
            this.lastRoundNumber = roundNumber;
            this.onRoundChanged();
        }

        const parts = [];
        this.maybeBuy(player, parts);

        if (this.game.isPaused()) {
            this.stuckTicks = 0;
            this.wanderTicks = 0;
            return parts.join("|");
        }

        if (tickId - this.lastScanTick >= this.options.scanIntervalTicks) {
            this.lastScanTick = tickId;
            this.visibleEnemyId = this.findVisibleEnemy(player);
        }

        const enemy = this.visibleEnemyId === null ? null : this.game.getPlayer(this.visibleEnemyId);
        if (enemy?.isAlive()) {
            this.attackEnemy(player, enemy, parts);
        } else {
            this.visibleEnemyId = null;
            this.patrol(player, parts, tickId);
            this.maybeReload(player, parts);
        }
        return parts.join("|");
    }

    /** 新回合:清空需要重算的状态。 */
    onRoundChanged() {
        this.patrolGoal = null;
        this.waypoints = [];
        this.waypointIndex = 0;
        this.pathNodeId = null;
        this.visibleEnemyId = null;
        this.stuckTicks = 0;
        this.lastPosition = null;
        this.wanderTicks = 0;
        this.boughtThisRound = false;
    }

    // ---------------------------------------------------------------- 索敌

    /** 找最近的、可见且存活的敌人 playerId;没有则返回 null。 */
    findVisibleEnemy(player) {
        const observer = player.getSightPositionClone();
        const mySide = player.isPlayingOnAttackerSide();
        const maxSight = this.options.sightRange;
        let bestId = null;
        let bestDistance = Infinity;

        for (const other of this.game.getPlayers()) {
            if (other.getId() === this.playerId || !other.isAlive()) {
                continue;
            }
            if (other.isPlayingOnAttackerSide() === mySide) {
                continue;
            }
            const target = other.getCentrePointClone();
            const distanceSq = distanceSquared(observer, target);
            if (distanceSq > maxSight * maxSight || distanceSq >= bestDistance) {
                continue;
            }
            const [angleH, angleV] = worldAngle(target, observer);
            if (angleH === null) {
                continue;
            }
            let visible = false;
            try {
                // playerIdSkip 传 null:与服务器自身 canBeSeen 一致,不做玩家身体
                // 碰撞检测(否则射线会在目标自己身上被挡掉)
                visible = this.world.pointCanSeePoint(
                    observer,
                    target,
                    angleH,
                    angleV,
                    Math.sqrt(distanceSq) + 10,
                    null,
                    30,
                );
            } catch {
                // LOS 内部可能因越界 y 抛异常,按不可见处理
                visible = false;
            }
            if (!visible) {
                continue;
            }
            bestId = other.getId();
            bestDistance = distanceSq;
        }
        return bestId;
    }

    // ---------------------------------------------------------------- 攻击

    /** 面向敌人开火;手持刀且敌人很近时用 attack2。 */
    attackEnemy(player, enemy, parts) {
        this.equipBestWeapon(player, parts);
        const observer = player.getSightPositionClone();
        const target = enemy.getCentrePointClone();
        const [angleH, angleV] = worldAngle(target, observer);
        if (angleH === null) {
            return;
        }
        parts.push(`look ${angleH.toFixed(2)} ${angleV.toFixed(2)}`);

        const equipped = player.getEquippedItem();
        const distance = Math.sqrt(distanceSquared(player.getPositionClone(), enemy.getPositionClone()));
        if (equipped.getType() === ItemType.TYPE_KNIFE && distance < this.options.knifeRange) {
            parts.push("attack2");
            return;
        }
        // 轻微走位,避免站桩
        if (Math.random() < 0.2) {
            parts.push(Math.random() < 0.5 ? "left" : "right");
        }
        parts.push("attack");
    }

    /** 主武器/副武器/刀 依次优选的切换。 */
    equipBestWeapon(player, parts) {
        const type = player.getEquippedItem().getType();
        if (type === ItemType.TYPE_WEAPON_PRIMARY || type === ItemType.TYPE_WEAPON_SECONDARY) {
            return;
        }
        const inventory = player.getInventory();
        if (inventory.has(InventorySlot.SLOT_PRIMARY)) {
            parts.push("equip 1");
        } else if (inventory.has(InventorySlot.SLOT_SECONDARY)) {
            parts.push("equip 2");
        } else {
            parts.push("equip 0");
        }
    }

    /** 弹药耗尽且有备弹时主动换弹(战斗中被服务端自动处理,这里只覆盖巡逻)。 */
    maybeReload(player, parts) {
        const equipped = player.getEquippedItem();
        if (typeof equipped.getAmmo !== "function") {
            return;
        }
        if (equipped.getAmmo() > 0 || equipped.getAmmoReserve() === 0 || equipped.isReloading()) {
            return;
        }
        parts.push("reload");
    }

    // ---------------------------------------------------------------- 巡逻

    /** 朝当前路点移动;无可用路径时降级为随机方向移动。 */
    patrol(player, parts, tickId) {
        this.ensurePathFinder();
        if (this.pathFinder === null) {
            this.randomMove(parts);
            return;
        }

        const startNode = this.findCurrentNode(player);
        if (startNode === null) {
            // 走出 navmesh 覆盖范围:冷却后以当前位置重建
            if (tickId - this.lastRebuildTick > this.options.rebuildCooldownTicks) {
                this.lastRebuildTick = tickId;
                this.pathFinder = null;
                this.patrolGoal = null;
                this.waypoints = [];
            }
            this.randomMove(parts);
            return;
        }

        const startId = startNode.hash();
        const needsPath =
            this.waypoints.length === 0 ||
            this.pathNodeId !== startId ||
            tickId - this.lastPathRecomputeTick > this.options.pathRecomputeTicks;
        if (needsPath) {
            this.lastPathRecomputeTick = tickId;
            this.computePath(startNode);
        }

        if (this.waypoints.length === 0) {
            this.randomMove(parts);
            return;
        }

        this.wanderTicks = 0;
        const target = this.waypoints[this.waypointIndex];
        this.moveToward(player, target, parts);

        const position = player.getPositionClone();
        if (Math.hypot(position.x - target.x, position.z - target.z) < this.options.arriveRadius) {
            this.waypointIndex++;
            if (this.waypointIndex >= this.waypoints.length) {
                this.waypoints = [];
                this.waypointIndex = 0;
                this.patrolGoal = null;
            }
        }
        this.updateStuck(player, parts);
    }

    /** 懒构建局部 navmesh:大图节点数超限时回收已生成的网格继续用。 */
    ensurePathFinder() {
        if (this.pathFinder !== null) {
            return;
        }
        const player = this.game.getPlayer(this.playerId);
        const start = this.clampToNavMeshSpace(player.getPositionClone());
        const pathFinder = new PathFinder(
            this.world,
            new NavigationMesh(this.options.tileSize, this.options.objectHeight),
        );
        try {
            pathFinder.buildNavigationMesh(start, this.options.objectHeight, this.options.maxNodeCount);
        } catch (error) {
            // 覆盖面积超过 maxNodeCount 时构建会抛异常:网格本身已完整,
            // 与成功路径一样 saveAndClear() 收尾后即可使用(退化为局部导航)。
            if (!(error instanceof GameException)) {
                throw error;
            }
        }
        pathFinder.saveAndClear();
        this.pathFinder = pathFinder;
    }

    /** 把当前坐标吸附到 navmesh 节点;失败(越界/异常)返回 null。 */
    findCurrentNode(player) {
        const position = this.clampToNavMeshSpace(player.getPositionClone());
        try {
            return this.pathFinder.findTile(position, playerBoundingRadius());
        } catch {
            return null;
        }
    }

    /** 计算到随机巡逻目标的 Dijkstra 最短路;失败则清空路点。 */
    computePath(startNode) {
        const startId = startNode.hash();
        this.pathNodeId = startId;

        let goal = this.patrolGoal;
        if (goal !== null && !this.pathFinder.getNavigationMesh().has(goal.hash())) {
            goal = null;
        }
        if (goal === null) {
            goal = this.pickRandomGoal(startId);
            this.patrolGoal = goal;
        }
        if (goal === null) {
            this.waypoints = [];
            return;
        }

        const startGraphNode = this.pathFinder.getGraph().getNodeById(startId);
        const goalGraphNode = this.pathFinder.getGraph().getNodeById(goal.hash());
        if (startGraphNode === null || goalGraphNode === null || startId === goal.hash()) {
            this.patrolGoal = null;
            this.waypoints = [];
            return;
        }

        const result = this.pathFinder.getGraph().shortestPathDijkstra(startGraphNode, goalGraphNode);
        if (result.path.length === 0 || !Number.isFinite(result.cost)) {
            // 目标不可达:换个目标
            this.patrolGoal = null;
            this.waypoints = [];
            return;
        }
        this.waypoints = result.path.slice(1).map((id) => Point.fromHash(id));
        this.waypointIndex = 0;
    }

    /** 随机选一个非当前的 navmesh 节点作为巡逻目标。 */
    pickRandomGoal(startId) {
        const nodes = this.pathFinder.getGraph().getNodes();
        if (nodes.length === 0) {
            return null;
        }
        for (let attempt = 0; attempt < 8; attempt++) {
            const node = nodes[Math.floor(Math.random() * nodes.length)];
            if (node.getId() !== startId) {
                return node.getData();
            }
        }
        return nodes[Math.floor(Math.random() * nodes.length)].getData();
    }

    /** 朝目标点移动:look 转向 + forward,大角度转向时辅以左右平移/后退。 */
    moveToward(player, target, parts) {
        const position = player.getPositionClone();
        const dx = target.x - position.x;
        const dz = target.z - position.z;
        if (dx === 0 && dz === 0) {
            return;
        }
        const angleH = ((Math.atan2(dx, dz) * 180) / Math.PI + 360) % 360;
        parts.push(`look ${angleH.toFixed(2)} 0.00`);

        const current = player.getSight().getRotationHorizontal();
        const delta = smallestDeltaAngle(current, angleH);
        if (delta > 120 || delta < -120) {
            parts.push("backward");
        } else if (delta > 45) {
            parts.push("forward", "right");
        } else if (delta < -45) {
            parts.push("forward", "left");
        } else {
            parts.push("forward");
        }
    }

    /** 卡住检测:连续多 tick 移动不动则 jump,更久则放弃当前路径。 */
    updateStuck(player, parts) {
        const position = player.getPositionClone();
        const moved =
            this.lastPosition === null
                ? Infinity
                : Math.hypot(position.x - this.lastPosition.x, position.z - this.lastPosition.z);
        this.stuckTicks = moved < this.options.stuckMinMove ? this.stuckTicks + 1 : 0;
        this.lastPosition = position;

        if (this.stuckTicks >= this.options.stuckJumpTicks) {
            parts.push("jump");
        }
        if (this.stuckTicks >= this.options.stuckRepathTicks) {
            this.waypoints = [];
            this.waypointIndex = 0;
            this.patrolGoal = null;
            this.stuckTicks = 0;
        }
    }

    // ---------------------------------------------------------------- 杂项

    /** 暂停/购买期内在购买区且有钱时,偶尔买一把主武器。 */
    maybeBuy(player, parts) {
        if (this.boughtThisRound || !this.game.playersCanBuy()) {
            return;
        }
        if (player.getInventory().has(InventorySlot.SLOT_PRIMARY)) {
            return;
        }
        if (!this.inBuyArea(player)) {
            return;
        }
        const attacker = player.isPlayingOnAttackerSide();
        const buyMenuItem = attacker ? BuyMenuItem.RIFLE_AK : BuyMenuItem.RIFLE_M4A4;
        const price = attacker ? 2700 : 3100; // RifleAk::$price / RifleM4A4::$price
        if (player.getInventory().getDollars() < price) {
            return;
        }
        if (Math.random() > this.options.buyChance) {
            return;
        }
        parts.push(`buy ${buyMenuItem}`);
        this.boughtThisRound = true;
    }

    /** 是否在购买区内(兼容 .x/.y/.z 与 getX()/getY()/getZ() 两种地图实现)。 */
    inBuyArea(player) {
        let area = null;
        try {
            area = this.world.getMap().getBuyArea(player.isPlayingOnAttackerSide());
        } catch {
            return false;
        }
        if (area === null || typeof area.contains !== "function") {
            return false;
        }
        const position = player.getReferenceToPosition();
        try {
            return area.contains({
                getX: () => position.x,
                getY: () => position.y,
                getZ: () => position.z,
            });
        } catch {
            return false;
        }
    }

    /** 兜底移动:随机方向前进(可能被墙挡住,但不会崩溃)。 */
    randomMove(parts) {
        this.wanderTicks++;
        if (this.wanderTicks > 120) {
            // 长时间找不到路径:原地待着比乱走到坑里安全
            return;
        }
        const angleH = Math.floor(Math.random() * 360);
        parts.push(`look ${angleH.toFixed(2)} 0.00`, "forward");
        if (Math.random() < 0.3) {
            parts.push(Math.random() < 0.5 ? "left" : "right");
        }
    }

    /** 异常兜底入口:randomMove 自身也要保证不抛。 */
    safeRandomMove(_player) {
        try {
            return this.randomMove([]);
        } catch {
            return "";
        }
    }

    /** navmesh 只接受 x/z >= 1、y >= 0 的坐标。 */
    clampToNavMeshSpace(point) {
        if (point.x < 1) {
            point.x = 1;
        }
        if (point.z < 1) {
            point.z = 1;
        }
        if (point.y < 0) {
            point.y = 0;
        }
        return point;
    }

    log(message) {
        const logger = this.options.logger;
        if (logger !== null && typeof logger.log === "function") {
            logger.log("warning", `[bot ${this.playerId}] ${message}`);
        }
    }
}
