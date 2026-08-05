/**
 * 地图加载:把 resources/map/default-map.json(原始 quads)转换为
 * World.loadMap() 可消费的 Map-like 对象(墙/地板/出生点/购买区/种弹区)。
 * 浏览器与 worker 共用;构建全量地图耗时数秒,结果缓存。
 */
import { Floor } from "./floor.js";
import { PlaneBuilder } from "./plane_builder.js";
import { Point } from "./point.js";
import { Wall } from "./wall.js";

const MAP_URL = "resources/map/default-map.json";

/** @type {?Promise<object>} */
let cachedMapPromise = null;

/**
 * @param {() => Promise<object>} [jsonLoader] 测试可注入;默认 fetch 相对 URL
 */
export function loadDefaultMap(jsonLoader = defaultJsonLoader) {
    if (cachedMapPromise === null) {
        cachedMapPromise = jsonLoader().then(buildMapFromJson);
    }
    return cachedMapPromise;
}

async function defaultJsonLoader() {
    const response = await fetch(MAP_URL);
    if (!response.ok) {
        throw new Error(`Failed to load map JSON: ${response.status}`);
    }
    return response.json();
}

/** 把 quads 构建为 Map-like 对象(与 PHP Map/DefaultMap 语义对应) */
export function buildMapFromJson(json) {
    const builder = new PlaneBuilder();
    const walls = [];
    const floors = [];
    for (const quad of json.quads) {
        const points = quad.points.filter((p) => p !== null).map((xyz) => new Point(xyz[0], xyz[1], xyz[2]));
        const planes = builder.create(points[0], points[1], points[2], points[3] ?? null, quad.jaggedness);
        for (const plane of planes) {
            if (plane instanceof Wall) {
                walls.push(plane);
            } else if (plane instanceof Floor) {
                floors.push(plane);
            }
        }
    }

    const buyAreaAttackers = areaBoxes(json.buyAreaAttackers);
    const buyAreaDefenders = areaBoxes(json.buyAreaDefenders);
    const plantArea = areaBoxes(json.plantArea);

    return {
        getWalls: () => walls,
        getFloors: () => floors,
        getSpawnPositionAttacker: () => json.spawnAttackers.map((xyz) => new Point(xyz[0], xyz[1], xyz[2])),
        getSpawnPositionDefender: () => json.spawnDefenders.map((xyz) => new Point(xyz[0], xyz[1], xyz[2])),
        getSpawnRotationAttacker: () => 0,
        getSpawnRotationDefender: () => 0,
        getStartingPointsForNavigationMesh: () => [
            new Point(...json.spawnAttackers[0]),
            new Point(...json.spawnDefenders[0]),
        ],
        generateNavigationMeshKey: (tileSize, colliderHeight) => `${tileSize}-${colliderHeight}`,
        getNavigationMesh: () => null,
        getBombMaxBlastDistance: () => 1000,
        getBuyArea: (forAttackers) => {
            const boxes = forAttackers ? buyAreaAttackers : buyAreaDefenders;
            return boxes ? { contains: (point) => containsAny(boxes, point) } : null;
        },
        getPlantArea: () => (plantArea ? { contains: (point) => containsAny(plantArea, point) } : null),
    };
}

/** {a,b} 或 [{a,b}] → 数组 */
function areaBoxes(area) {
    if (!area) {
        return null;
    }
    return Array.isArray(area) ? area : [area];
}

function containsAny(boxes, point) {
    const x = typeof point.getX === "function" ? point.getX() : point.x;
    const y = typeof point.getY === "function" ? point.getY() : point.y;
    const z = typeof point.getZ === "function" ? point.getZ() : point.z;
    for (const box of boxes) {
        if (x >= box.a[0] && x <= box.b[0] && y >= box.a[1] && y <= box.b[1] && z >= box.a[2] && z <= box.b[2]) {
            return true;
        }
    }
    return false;
}
