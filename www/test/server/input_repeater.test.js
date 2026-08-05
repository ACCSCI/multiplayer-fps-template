import { expect, test } from "bun:test";
import { InputRepeater } from "../../assets/js/sim/input_repeater.js";

test("holds are replayed each tick, edges fire once", () => {
    const repeater = new InputRepeater();
    repeater.onCommand(1, "forward|look 90.50 -12.00|attack");

    // tick 1: new input -> held + edges
    expect(repeater.getCommand(1)).toBe("forward|look 90.50 -12.00|attack");
    // tick 2/3: no new input -> held replay only(attack 是保持态,扫射语义)
    expect(repeater.getCommand(1)).toBe("forward|look 90.50 -12.00|attack");
    expect(repeater.getCommand(1)).toBe("forward|look 90.50 -12.00|attack");

    // 新包以新保持态整体替换;边沿(这里 jump)只发一次
    repeater.onCommand(1, "left|look 91.00 -10.00|jump|reload");
    expect(repeater.getCommand(1)).toBe("left|look 91.00 -10.00|jump|reload");
    expect(repeater.getCommand(1)).toBe("left|look 91.00 -10.00");
});

test("attack/attack2/use are held commands (weapon rate limits fire rate)", () => {
    const repeater = new InputRepeater();
    repeater.onCommand(2, "attack|attack2|use");
    expect(repeater.getCommand(2)).toBe("attack|attack2|use");
    expect(repeater.getCommand(2)).toBe("attack|attack2|use");
});

test("equip/buy/drop are edges", () => {
    const repeater = new InputRepeater();
    repeater.onCommand(3, "equip 1|buy 3|drop");
    expect(repeater.getCommand(3)).toBe("equip 1|buy 3|drop");
    expect(repeater.getCommand(3)).toBe("");
});

test("unknown player returns empty, drop clears state", () => {
    const repeater = new InputRepeater();
    expect(repeater.getCommand(99)).toBe("");
    repeater.onCommand(4, "forward");
    repeater.drop(4);
    expect(repeater.getCommand(4)).toBe("");
});

test("empty string and edge-only packets behave", () => {
    const repeater = new InputRepeater();
    repeater.onCommand(5, "");
    expect(repeater.getCommand(5)).toBe("");
    repeater.onCommand(5, "buy 1");
    expect(repeater.getCommand(5)).toBe("buy 1");
    expect(repeater.getCommand(5)).toBe("");
});
