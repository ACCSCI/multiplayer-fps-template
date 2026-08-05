import { GameException } from "./game_exception.js";

/**
 * Ports of GraphPHP\Node\Node and GraphPHP\Edge\DirectedEdge
 * (actived/graphphp 0.2.2) with the adjacency-list Graph from
 * server/src/Core/Graph.php (DiGraph subclass).
 * Pure Map/Set implementation; Map preserves insertion order so
 * getNeighbors()/generateNeighbors() keep the PHP edge insertion order.
 */
export class Node {
    constructor(id, data = null) {
        this.id = id;
        this.data = data;
    }

    getId() {
        return this.id;
    }

    getData() {
        return this.data;
    }

    setData(data) {
        this.data = data;
        return this;
    }
}

export class DirectedEdge {
    constructor(nodeA, nodeB, weight = 0.0, id = "") {
        this.nodeA = nodeA;
        this.nodeB = nodeB;
        this.weight = weight;
        this.id = id === "" ? `${nodeA.getId()}-${nodeB.getId()}` : id;
    }

    getId() {
        return this.id;
    }

    getNodes() {
        return [this.nodeA, this.nodeB];
    }

    getWeight() {
        return this.weight;
    }

    setWeight(weight) {
        this.weight = weight;
        return this;
    }

    getSource() {
        return this.nodeA;
    }

    getTarget() {
        return this.nodeB;
    }

    getNodeA() {
        return this.nodeA;
    }

    getNodeB() {
        return this.nodeB;
    }
}

/** Max-heap on priority; FIFO among equal priorities (like PHP SplPriorityQueue). */
class PriorityQueue {
    constructor() {
        this.heap = [];
        this.seq = 0;
    }

    isEmpty() {
        return this.heap.length === 0;
    }

    insert(value, priority) {
        const item = { priority, seq: this.seq++, value };
        this.heap.push(item);
        let i = this.heap.length - 1;
        while (i > 0) {
            const parent = (i - 1) >> 1;
            if (this.above(this.heap[i], this.heap[parent])) {
                const tmp = this.heap[i];
                this.heap[i] = this.heap[parent];
                this.heap[parent] = tmp;
                i = parent;
            } else {
                break;
            }
        }
    }

    extract() {
        const top = this.heap[0];
        const last = this.heap.pop();
        if (this.heap.length > 0) {
            this.heap[0] = last;
            let i = 0;
            const n = this.heap.length;
            while (true) {
                const left = 2 * i + 1;
                const right = 2 * i + 2;
                let largest = i;
                if (left < n && this.above(this.heap[left], this.heap[largest])) {
                    largest = left;
                }
                if (right < n && this.above(this.heap[right], this.heap[largest])) {
                    largest = right;
                }
                if (largest === i) {
                    break;
                }
                const tmp = this.heap[i];
                this.heap[i] = this.heap[largest];
                this.heap[largest] = tmp;
                i = largest;
            }
        }
        return top.value;
    }

    above(a, b) {
        return a.priority > b.priority || (a.priority === b.priority && a.seq < b.seq);
    }
}

/**
 * Port of server/src/Core/Graph.php (extends GraphPHP\Graph\DiGraph).
 * Directed graph backed by an adjacency list: Map<sourceId, Map<targetId, weight>>.
 */
export class Graph {
    constructor() {
        this.nodes = new Map();
        this.adjacency = new Map();
        this.edgeCount = 0;
    }

    getNodes() {
        return [...this.nodes.values()];
    }

    getNodesCount() {
        return this.nodes.size;
    }

    getEdgeCount() {
        return this.edgeCount;
    }

    addNode(node) {
        if (this.nodes.has(node.getId())) {
            throw new GameException(`A node with the ID '${node.getId()}' already exists.`);
        }
        this.nodes.set(node.getId(), node);
        return this;
    }

    getNodeById(nodeId) {
        return this.nodes.get(nodeId) ?? null;
    }

    getEdges() {
        const edges = [];
        for (const [sourceId, targets] of this.adjacency) {
            for (const [targetId, weight] of targets) {
                edges.push(
                    new DirectedEdge(
                        this.nodes.get(sourceId),
                        this.nodes.get(targetId),
                        weight,
                        `${sourceId}-${targetId}`,
                    ),
                );
            }
        }
        return edges;
    }

    getEdgeById(edgeId) {
        const [sourceId, targetId] = edgeId.split("-");
        const weight = this.adjacency.get(sourceId)?.get(targetId);
        if (weight === undefined) {
            return null;
        }
        return new DirectedEdge(this.nodes.get(sourceId), this.nodes.get(targetId), weight, edgeId);
    }

    addEdge(edge) {
        const edgeId = edge.getId();
        const sourceId = edge.getSource().getId();
        const targetId = edge.getTarget().getId();
        if (this.adjacency.get(sourceId)?.has(targetId)) {
            throw new GameException(`An edge with the ID '${edgeId}' already exists.`);
        }

        if (!this.adjacency.has(sourceId)) {
            this.adjacency.set(sourceId, new Map());
        }
        this.adjacency.get(sourceId).set(targetId, edge.getWeight());
        this.edgeCount++;
        return this;
    }

    getNeighbors(node) {
        const neighbors = [];
        const targets = this.adjacency.get(node.getId());
        if (targets !== undefined) {
            for (const targetId of targets.keys()) {
                neighbors.push(this.nodes.get(targetId));
            }
        }
        return neighbors;
    }

    getEdge(nodeA, nodeB) {
        const weight = this.adjacency.get(nodeA.getId())?.get(nodeB.getId());
        if (weight === undefined) {
            return null;
        }
        return new DirectedEdge(nodeA, nodeB, weight);
    }

    getEdgeWeight(nodeA, nodeB) {
        return this.adjacency.get(nodeA.getId())?.get(nodeB.getId()) ?? Infinity;
    }

    containsNegativeWeight() {
        for (const targets of this.adjacency.values()) {
            for (const weight of targets.values()) {
                if (weight < 0) {
                    return true;
                }
            }
        }
        return false;
    }

    /** @returns {Record<string, string[]>} nodeId => list of neighbor nodeIds */
    generateNeighbors() {
        const neighbors = {};
        for (const [sourceId, targets] of this.adjacency) {
            neighbors[sourceId] = [...targets.keys()];
        }
        return neighbors;
    }

    /**
     * Port of GraphPHP\Graph\Graph::shortestPathDijkstra().
     * @returns {{path: string[], cost: number}}
     */
    shortestPathDijkstra(start, end) {
        if (this.containsNegativeWeight()) {
            throw new GameException("Dijkstra's algorithm cannot handle graphs with negative edge weights.");
        }

        const distances = new Map();
        const previous = new Map();
        for (const node of this.nodes.values()) {
            distances.set(node.getId(), Infinity);
            previous.set(node.getId(), null);
        }
        distances.set(start.getId(), 0);

        const queue = new PriorityQueue();
        for (const node of this.nodes.values()) {
            queue.insert(node.getId(), -distances.get(node.getId()));
        }

        const visited = new Set();
        while (!queue.isEmpty()) {
            const currentNodeId = queue.extract();
            if (visited.has(currentNodeId)) {
                continue;
            }
            visited.add(currentNodeId);
            if (currentNodeId === end.getId()) {
                break;
            }

            const neighbors = this.getNeighbors(this.nodes.get(currentNodeId));
            for (const neighbor of neighbors) {
                if (visited.has(neighbor.getId())) {
                    continue;
                }
                const weight = this.getEdgeWeight(this.nodes.get(currentNodeId), neighbor);
                const alt = distances.get(currentNodeId) + weight;
                if (alt < distances.get(neighbor.getId())) {
                    distances.set(neighbor.getId(), alt);
                    previous.set(neighbor.getId(), currentNodeId);
                    queue.insert(neighbor.getId(), -alt);
                }
            }
        }

        const path = [];
        let current = end.getId();
        while (current !== null) {
            path.unshift(current);
            current = previous.get(current);
        }

        const cost = distances.get(end.getId());
        return {
            path: path[0] === start.getId() ? path : [],
            cost,
        };
    }
}
