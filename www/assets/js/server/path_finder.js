import { GameException } from "./game_exception.js";
import { DirectedEdge, Graph, Node } from "./graph.js";
import { NavigationMesh } from "./navigation_mesh.js";
import { Point } from "./point.js";
import { playerObstacleOvercomeHeight } from "./setting.js";
import { World } from "./world/index.js";

/** PHP PathFinder::$moves static array; Map preserves the PHP iteration order. */
const MOVES = new Map([
    [90, [1, 0, 0]],
    [0, [0, 0, 1]],
    [270, [-1, 0, 0]],
    [180, [0, 0, -1]],
]);

/**
 * Port of server/src/Core/PathFinder.php (SplQueue BFS -> JS array queue).
 * @param {World} world
 * @param {NavigationMesh} navigationMesh
 */
export class PathFinder {
    constructor(world, navigationMesh) {
        this.world = world;
        this.navigationMesh = navigationMesh;
        this.graph = new Graph();
        this.visited = new Set();
        this.obstacleOvercomeHeight = playerObstacleOvercomeHeight();
    }

    canFullyMoveTo(candidate, angle, targetDistance, radius, height) {
        if (angle % 90 !== 0) {
            GameException.notImplementedYet();
        }

        let looseFloor = false;
        for (let distance = 1; distance <= targetDistance; distance++) {
            candidate.addPart(...MOVES.get(angle));
            if (!this.canMoveTo(candidate, angle, radius)) {
                return false;
            }

            if (!looseFloor && !this.world.findFloorSquare(candidate, radius)) {
                looseFloor = true;
            }
        }

        if (!looseFloor) {
            return true;
        }

        const fallCandidate = candidate.clone();
        for (let i = 1; i <= 3 * height; i++) {
            fallCandidate.addY(-1);
            if (this.world.findFloorSquare(fallCandidate, radius)) {
                candidate.setY(fallCandidate.y); // side effect
                return true;
            }
        }

        return false;
    }

    canMoveTo(start, angle, radius) {
        const maxWallCeiling = start.y + this.obstacleOvercomeHeight;
        let xWallMaxHeight = 0;
        if (angle === 90 || angle === 270) {
            const baseX = start.clone().addX(angle === 90 ? radius : -radius);
            xWallMaxHeight = this.world.findHighestWall(
                baseX,
                this.navigationMesh.colliderHeight,
                radius,
                maxWallCeiling,
                true,
            );
        }
        let zWallMaxHeight = 0;
        if (angle === 0 || angle === 180) {
            const baseZ = start.clone().addZ(angle === 0 ? radius : -radius);
            zWallMaxHeight = this.world.findHighestWall(
                baseZ,
                this.navigationMesh.colliderHeight,
                radius,
                maxWallCeiling,
                false,
            );
        }
        if (xWallMaxHeight === 0 && zWallMaxHeight === 0) {
            // no walls
            return true;
        }

        // Try step over ONE low height wall
        let highestWallCeiling = null;
        if (xWallMaxHeight === 0 && zWallMaxHeight <= maxWallCeiling) {
            highestWallCeiling = zWallMaxHeight;
        } else if (zWallMaxHeight === 0 && xWallMaxHeight <= maxWallCeiling) {
            highestWallCeiling = xWallMaxHeight;
        }
        if (highestWallCeiling === null) {
            return false;
        }

        const floor = this.world.findFloorSquare(start.clone().setY(highestWallCeiling), radius);
        if (floor) {
            start.setY(floor.getY()); // side effect
            return true;
        }

        throw new GameException(`Wall we can step over but no floor there ${start}`);
    }

    findTile(pointOnFloor, radius) {
        const floorNavmeshPoint = pointOnFloor.clone();
        this.convertToNavMeshNode(floorNavmeshPoint);
        if (this.navigationMesh.has(floorNavmeshPoint.hash())) {
            return floorNavmeshPoint;
        }

        const maxDistance = this.navigationMesh.tileSize + this.navigationMesh.tileSize;
        const maxY = this.obstacleOvercomeHeight + this.obstacleOvercomeHeight;
        const checkAbove = (start, maxY, radius) => {
            const yCandidate = start.clone();
            const navMeshCenter = yCandidate.clone();
            this.convertToNavMeshNode(navMeshCenter);
            for (let i = 1; i <= maxY; i++) {
                yCandidate.addY(1);
                if (this.world.findFloorSquare(yCandidate, radius - 1)) {
                    return null;
                }
                if (this.navigationMesh.has(navMeshCenter.setY(yCandidate.y).hash())) {
                    return navMeshCenter;
                }
            }

            return null;
        };

        // try navmesh above
        const aboveStart = checkAbove(pointOnFloor, maxY, radius);
        if (aboveStart) {
            return aboveStart;
        }

        // try neighbour tiles
        const candidate = pointOnFloor.clone();
        const navmesh = pointOnFloor.clone();
        for (const [angle, move] of MOVES) {
            candidate.setFrom(pointOnFloor);

            for (let distance = 1; distance <= maxDistance; distance++) {
                candidate.addPart(...move);
                if (!this.canFullyMoveTo(candidate, angle, 1, radius, this.navigationMesh.colliderHeight)) {
                    break;
                }

                const prevNavmesh = navmesh.hash();
                navmesh.setFrom(candidate);
                this.convertToNavMeshNode(navmesh);
                if (prevNavmesh === navmesh.hash()) {
                    continue;
                }

                if (this.navigationMesh.has(navmesh.hash())) {
                    return navmesh;
                }
                const above = checkAbove(candidate, maxY, radius);
                if (above) {
                    return above;
                }
            }
        }

        return null;
    }

    convertToNavMeshNode(point) {
        this.navigationMesh.convertToNavMeshNode(point);
    }

    buildNavigationMesh(start, objectHeight, maxNodeCount = 2000) {
        const startPoint = start.clone();
        this.convertToNavMeshNode(startPoint);
        if (!this.world.findFloorSquare(startPoint, 1)) {
            throw new GameException(`No floor on start: ${start}`);
        }

        /** @type {Point[]} SplQueue -> JS array queue */
        const queue = [];
        queue.push(startPoint);
        const candidate = new Point();

        let nodeCount = 0;
        while (queue.length > 0) {
            const current = queue.shift();
            const currentKey = current.hash();
            if (this.visited.has(currentKey)) {
                continue;
            }

            this.visited.add(currentKey);
            let currentNode = this.graph.getNodeById(currentKey);
            if (currentNode === null) {
                currentNode = new Node(currentKey, current);
                this.graph.addNode(currentNode);
            }

            for (const [angle, _move] of MOVES) {
                candidate.setFrom(current);
                if (
                    !this.canFullyMoveTo(
                        candidate,
                        angle,
                        this.navigationMesh.tileSize,
                        this.navigationMesh.tileSizeHalf,
                        objectHeight,
                    )
                ) {
                    continue;
                }

                const newNeighbour = candidate.clone();
                let newNode = this.graph.getNodeById(newNeighbour.hash());
                if (newNode === null) {
                    newNode = new Node(newNeighbour.hash(), newNeighbour);
                    this.graph.addNode(newNode);
                }
                this.graph.addEdge(new DirectedEdge(currentNode, newNode, 1));
                queue.push(newNeighbour);
            }
            if (++nodeCount === maxNodeCount) {
                GameException.notImplementedYet(
                    "MaxNodeCount hit - new map, tileSize or bad test (no boundary box, bad starting point)?",
                );
            }
        }
    }

    saveAndClear() {
        this.visited = new Set();
        this.navigationMesh.setData(this.getGraph().generateNeighbors());
    }

    getGraph() {
        return this.graph;
    }

    getNavigationMesh() {
        return this.navigationMesh;
    }
}
