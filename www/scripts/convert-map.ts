import { readFileSync, statSync, writeFileSync } from "node:fs";
import path from "node:path";

const SCRIPT_DIR = import.meta.dir;
const SOURCE_PATH = path.join(SCRIPT_DIR, "..", "..", "server", "src", "Map", "DefaultMap.php");
const OUTPUT_PATH = path.join(SCRIPT_DIR, "..", "resources", "map", "default-map.json");

type Point3 = [number, number, number];
type AreaBox = { a: Point3; b: Point3 };
type Quad = {
    points: [Point3, Point3, Point3, Point3 | null];
    jaggedness: number | null;
    penetrable: boolean | null;
    navmesh: boolean | null;
};

function assert(condition: unknown, message: string): asserts condition {
    if (!condition) {
        throw new Error(`[convert-map] assertion failed: ${message}`);
    }
}

function extractPoints(body: string): Point3[] {
    const pointRe = /new Point\((-?\d+),\s*(-?\d+),\s*(-?\d+)\)/g;
    const points: Point3[] = [];
    for (const match of body.matchAll(pointRe)) {
        points.push([Number(match[1]), Number(match[2]), Number(match[3])]);
    }
    return points;
}

function parseNamed(body: string): Pick<Quad, "jaggedness" | "penetrable" | "navmesh"> {
    const named: Pick<Quad, "jaggedness" | "penetrable" | "navmesh"> = {
        jaggedness: null,
        penetrable: null,
        navmesh: null,
    };

    const jaggedness = body.match(/jaggedness:\s*(-?\d+(?:\.\d+)?|null)/);
    if (jaggedness !== null) {
        named.jaggedness = jaggedness[1] === "null" ? null : Number(jaggedness[1]);
    }
    const penetrable = body.match(/penetrable:\s*(true|false)/);
    if (penetrable !== null) {
        named.penetrable = penetrable[1] === "true";
    }
    const navmesh = body.match(/navmesh:\s*(true|false)/);
    if (navmesh !== null) {
        named.navmesh = navmesh[1] === "true";
    }
    return named;
}

function parseBoxes(member: string): AreaBox[] {
    const boxRe = new RegExp(
        `\\$this->${member}->add\\(new Box\\(new Point\\((-?\\d+),\\s*(-?\\d+),\\s*(-?\\d+)\\),\\s*(-?\\d+),\\s*(-?\\d+),\\s*(-?\\d+)\\)\\)`,
        "g",
    );
    const boxes: AreaBox[] = [];
    for (const match of source.matchAll(boxRe)) {
        const [x, y, z, width, height, depth] = [match[1], match[2], match[3], match[4], match[5], match[6]].map(
            Number,
        );
        boxes.push({ a: [x, y, z], b: [x + width, y + height, z + depth] });
    }
    return boxes;
}

// A single box is kept as a plain {a, b} object; multiple boxes (e.g. the 3 plant
// spots of DefaultMap) are kept as an array of {a, b} objects; empty is null.
function toArea(boxes: AreaBox[]): AreaBox | AreaBox[] | null {
    if (boxes.length === 0) {
        return null;
    }
    if (boxes.length === 1) {
        return boxes[0];
    }
    return boxes;
}

const source = readFileSync(SOURCE_PATH, "utf8");

// Each `$add(...)` call is multi-line and ends with `);`; none of the interior
// tokens (new Point(...), null, penetrable:, navmesh:, jaggedness:) ever end
// with `);`, so the first `);` after `$add(` always closes the call.
const callRe = /\$add\(([\s\S]*?)\);/g;
const callBodies: string[] = [];
for (const match of source.matchAll(callRe)) {
    callBodies.push(match[1]);
}
assert(callBodies.length === 1139, `expected 1139 $add calls, got ${callBodies.length}`);

const quads: Quad[] = [];
let triangleCount = 0;
let withJaggedness = 0;
let withPenetrable = 0;
let withNavmesh = 0;
for (const body of callBodies) {
    const points = extractPoints(body);
    assert(
        points.length === 3 || points.length === 4,
        `expected 3 or 4 Point arguments per $add call, got ${points.length}: ${body.trim().slice(0, 80)}`,
    );

    const named = parseNamed(body);
    if (named.jaggedness !== null) {
        withJaggedness++;
    }
    if (named.penetrable !== null) {
        withPenetrable++;
    }
    if (named.navmesh !== null) {
        withNavmesh++;
    }

    const quad: Quad = {
        points: [points[0], points[1], points[2], points[3] ?? null],
        jaggedness: named.jaggedness,
        penetrable: named.penetrable,
        navmesh: named.navmesh,
    };
    if (points.length === 3) {
        assert(/\bnull\b/.test(body), `triangle $add call missing its null 4th argument: ${body.trim().slice(0, 80)}`);
        triangleCount++;
    }
    quads.push(quad);
}

const spawnRe = (member: string): RegExp =>
    new RegExp(`\\$this->${member}\\[\\]\\s*=\\s*new Point\\((-?\\d+),\\s*(-?\\d+),\\s*(-?\\d+)\\)`, "g");

const spawnToPoints = (member: string): Point3[] => {
    const points: Point3[] = [];
    for (const match of source.matchAll(spawnRe(member))) {
        points.push([Number(match[1]), Number(match[2]), Number(match[3])]);
    }
    return points;
};

const spawnAttackers = spawnToPoints("spawnPositionAttacker");
assert(spawnAttackers.length === 10, `expected 10 attacker spawn points, got ${spawnAttackers.length}`);
const spawnDefenders = spawnToPoints("spawnPositionDefender");
assert(spawnDefenders.length === 10, `expected 10 defender spawn points, got ${spawnDefenders.length}`);

const plantAreaBoxes = parseBoxes("plantArea");
assert(plantAreaBoxes.length === 3, `expected 3 plant area boxes, got ${plantAreaBoxes.length}`);
const buyAreaAttackerBoxes = parseBoxes("buyAreaAttackers");
assert(buyAreaAttackerBoxes.length === 1, `expected 1 attacker buy area box, got ${buyAreaAttackerBoxes.length}`);
const buyAreaDefenderBoxes = parseBoxes("buyAreaDefenders");
assert(buyAreaDefenderBoxes.length === 1, `expected 1 defender buy area box, got ${buyAreaDefenderBoxes.length}`);

const output = {
    quads,
    spawnAttackers,
    spawnDefenders,
    buyAreaAttackers: toArea(buyAreaAttackerBoxes),
    buyAreaDefenders: toArea(buyAreaDefenderBoxes),
    plantArea: toArea(plantAreaBoxes),
};

writeFileSync(OUTPUT_PATH, `${JSON.stringify(output, null, 2)}\n`, "utf8");

console.log(`Converted ${SOURCE_PATH}`);
console.log(`  quads: ${quads.length} (${triangleCount} triangles)`);
console.log(`  quads with jaggedness: ${withJaggedness}`);
console.log(`  quads with penetrable: ${withPenetrable}`);
console.log(`  quads with navmesh: ${withNavmesh}`);
console.log(`  spawnAttackers: ${spawnAttackers.length}`);
console.log(`  spawnDefenders: ${spawnDefenders.length}`);
console.log(`  buyAreaAttackers: ${buyAreaAttackerBoxes.length} box`);
console.log(`  buyAreaDefenders: ${buyAreaDefenderBoxes.length} box`);
console.log(`  plantArea: ${plantAreaBoxes.length} boxes`);
console.log(`Wrote ${OUTPUT_PATH} (${statSync(OUTPUT_PATH).size} bytes)`);
