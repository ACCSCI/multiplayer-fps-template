import { expect, test } from "bun:test";
import { buildMapFromJson } from "../../assets/js/server/map_loader.js";

const MAP_JSON = JSON.parse(await Bun.file("www/resources/map/default-map.json").text());

// 全量地图构建耗时数秒,模块级构建一次共享
const map = buildMapFromJson(MAP_JSON);

test(
    "buildMapFromJson produces walls, floors and spawn points",
    () => {
        const walls = map.getWalls();
        const floors = map.getFloors();
        expect(walls.length).toBeGreaterThan(10000);
        expect(floors.length).toBeGreaterThan(1000);
        expect(map.getSpawnPositionAttacker()).toHaveLength(10);
        expect(map.getSpawnPositionDefender()).toHaveLength(10);
    },
    { timeout: 30000 },
);

test(
    "buy and plant areas are queryable per team",
    () => {
        expect(map.getBuyArea(true)).not.toBeNull();
        expect(map.getBuyArea(false)).not.toBeNull();
        expect(map.getPlantArea()).not.toBeNull();
    },
    { timeout: 30000 },
);
