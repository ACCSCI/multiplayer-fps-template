import { circleWithPlane, planeWithPlane } from "../collision.js";
import { GameException } from "../game_exception.js";

/**
 * Spatial indexing and queries of the World (port of the related methods in
 * server/src/Core/World.php). The methods are mounted on World.prototype via
 * installSpatial() called from world/index.js.
 */

// PHP World::WALL_X / WALL_Z private constants
const WALL_X = "zy";
const WALL_Z = "xy";

/** Iterate a PHP-style keyed player collection (Map or plain object). */
function playerValues(players) {
    if (players instanceof Map) {
        return players.values();
    }
    return Object.values(players);
}

function getXWalls(world, x) {
    return world.walls[WALL_X]?.[x] ?? [];
}

function getZWalls(world, z) {
    return world.walls[WALL_Z]?.[z] ?? [];
}

function addWall(wall) {
    const plane = wall.getPlane();
    if (this.walls[plane] === undefined) {
        this.walls[plane] = {};
    }
    const base = wall.getBase();
    if (this.walls[plane][base] === undefined) {
        this.walls[plane][base] = [];
    }
    this.walls[plane][base].push(wall);
}

function addFloor(floor) {
    const y = floor.getY();
    if (this.floors[y] === undefined) {
        this.floors[y] = [];
    }
    this.floors[y].push(floor);
}

function isFloorAt(point) {
    if (point.y < 0) {
        throw new GameException("Y value cannot be lower than zero");
    }

    for (const floor of this.floors[point.y] ?? []) {
        if (circleWithPlane(point.x, point.z, 0, floor)) {
            return floor;
        }
    }
    return null;
}

function isWallAt(point) {
    for (const wall of this.walls[WALL_Z]?.[point.z] ?? []) {
        if (circleWithPlane(point.x, point.y, 0, wall)) {
            return wall;
        }
    }
    for (const wall of this.walls[WALL_X]?.[point.x] ?? []) {
        if (circleWithPlane(point.z, point.y, 0, wall)) {
            return wall;
        }
    }
    return null;
}

function findPlayersHeadFloor(point, radius = 0) {
    for (const player of playerValues(this.game.getAlivePlayers())) {
        const floor = player.getHeadFloor();
        if (floor.intersect(point, radius)) {
            player.getBoostFloor()?.getPlayer().suicide();
            return floor;
        }
    }
    return null;
}

function findFloorSquare(point, radius) {
    if (point.y < 0) {
        throw new GameException("Y value cannot be lower than zero");
    }
    if (this.floors[point.y] === undefined) {
        return null;
    }

    const distance = 2 * radius;
    const candidateX = point.x - radius;
    const candidateZ = point.z - radius;
    for (const floor of this.floors[point.y]) {
        if (
            planeWithPlane(
                floor.getPoint2DStart(),
                floor.width,
                floor.depth,
                candidateX,
                candidateZ,
                distance,
                distance,
            )
        ) {
            return floor;
        }
    }
    return null;
}

function findHighestWall(bottomCenter, height, radius, maxWallCeiling, xWall) {
    const base = xWall ? bottomCenter.x : bottomCenter.z;
    if (base < 0) {
        return maxWallCeiling + 1;
    }
    const walls = xWall ? getXWalls(this, base) : getZWalls(this, base);
    if (walls.length === 0) {
        return 0;
    }

    const width = 2 * radius;
    let highestWallCeiling = 0;
    const candidatePlaneA = xWall ? bottomCenter.z - radius : bottomCenter.x - radius;
    for (const wall of walls) {
        const wallCeiling = wall.getCeiling();
        if (wallCeiling <= bottomCenter.y) {
            continue;
        }
        if (
            !planeWithPlane(
                wall.getPoint2DStart(),
                wall.width,
                wall.height,
                candidatePlaneA,
                bottomCenter.y,
                width,
                height,
            )
        ) {
            continue;
        }
        if (wallCeiling > maxWallCeiling) {
            return wallCeiling;
        }
        if (wallCeiling > highestWallCeiling) {
            highestWallCeiling = wallCeiling;
        }
    }

    return highestWallCeiling;
}

function checkXSideWallCollision(bottomCenter, height, radius) {
    const startZ = bottomCenter.z - radius;
    const width = 2 * radius;
    for (const wall of this.walls[WALL_X]?.[bottomCenter.x] ?? []) {
        if (planeWithPlane(wall.getPoint2DStart(), wall.width, wall.height, startZ, bottomCenter.y, width, height)) {
            return wall;
        }
    }

    return null;
}

function checkZSideWallCollision(bottomCenter, height, radius) {
    const startX = bottomCenter.x - radius;
    const width = 2 * radius;
    for (const wall of this.walls[WALL_Z]?.[bottomCenter.z] ?? []) {
        if (planeWithPlane(wall.getPoint2DStart(), wall.width, wall.height, startX, bottomCenter.y, width, height)) {
            return wall;
        }
    }

    return null;
}

function isWallOrFloorCollision(start, candidate, radius) {
    if (this.findFloorSquare(candidate, radius)) {
        return true;
    }

    if (start.x !== candidate.x) {
        const xGrowing = start.x < candidate.x;
        const baseX = candidate.clone().addX(xGrowing ? radius : -radius);
        if (this.checkXSideWallCollision(baseX, radius, radius)) {
            return true;
        }
    }
    if (start.z !== candidate.z) {
        const zGrowing = start.z < candidate.z;
        const baseZ = candidate.clone().addZ(zGrowing ? radius : -radius);
        if (this.checkZSideWallCollision(baseZ, radius, radius)) {
            return true;
        }
    }

    return false;
}

export function installSpatial(proto) {
    proto.addWall = addWall;
    proto.addFloor = addFloor;
    proto.isFloorAt = isFloorAt;
    proto.isWallAt = isWallAt;
    proto.findPlayersHeadFloor = findPlayersHeadFloor;
    proto.findFloorSquare = findFloorSquare;
    proto.findHighestWall = findHighestWall;
    proto.checkXSideWallCollision = checkXSideWallCollision;
    proto.checkZSideWallCollision = checkZSideWallCollision;
    proto.isWallOrFloorCollision = isWallOrFloorCollision;
}
