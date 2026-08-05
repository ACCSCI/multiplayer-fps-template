import { expect, test } from "bun:test";
import { Backtrack } from "../../assets/js/server/backtrack.js";
import { GameException } from "../../assets/js/server/game_exception.js";
import { Point } from "../../assets/js/server/point.js";
import { MockGame, MockPlayer } from "./helpers/mocks.js";

function expectPoint(point, x, y, z) {
    expect([point.x, point.y, point.z]).toEqual([x, y, z]);
}

test("Backtrack save/apply/restore", () => {
    const player = new MockPlayer(1, new Point(), 190);
    const game = new MockGame([player]);
    player.getSight().look(123, -9);
    const origPosition = player.getPositionClone();
    const origPlayerHeadHeight = player.getHeadHeight();
    const modifiedHeadHeight = origPlayerHeadHeight - 3;

    const backtrack = new Backtrack(game, 123);
    expect(backtrack.getStates()).toEqual([0]);

    backtrack.startState();
    backtrack.addStateData(player);
    backtrack.finishState();
    expect(backtrack.getStates()).toEqual([0]);

    player.setPosition(origPosition.clone().addX(10));
    player.setHeadHeight(modifiedHeadHeight);
    player.getSight().look(12, 13);

    backtrack.startState();
    backtrack.addStateData(player);
    backtrack.finishState();

    expect(backtrack.getStates()).toEqual([1]);

    expect(player.getHeadHeight()).toBe(modifiedHeadHeight);
    expect(player.getSight().getRotationHorizontal()).toBe(12);
    expect(player.getSight().getRotationVertical()).toBe(13);
    expectPoint(player.getPositionClone(), origPosition.x + 10, origPosition.y, origPosition.z);

    backtrack.saveState();
    const states = backtrack.getStates();
    expect(states).toHaveLength(1);
    backtrack.apply(states[0], player.getId());
    expect(player.getHeadHeight()).toBe(origPlayerHeadHeight);
    expect(player.getSight().getRotationHorizontal()).toBe(123);
    expect(player.getSight().getRotationVertical()).toBe(-9);
    expectPoint(player.getPositionClone(), origPosition.x, origPosition.y, origPosition.z);
    backtrack.restoreState();

    expect(player.getHeadHeight()).toBe(modifiedHeadHeight);
    expect(player.getSight().getRotationHorizontal()).toBe(12);
    expect(player.getSight().getRotationVertical()).toBe(13);
    expectPoint(player.getPositionClone(), origPosition.x + 10, origPosition.y, origPosition.z);
});

test("Backtrack empty states are skipped in getStates", () => {
    const player = new MockPlayer(1, new Point(), 190);
    const game = new MockGame([player]);
    const backtrack = new Backtrack(game, 5);
    expect(backtrack.getStates()).toEqual([0]);

    backtrack.startState();
    backtrack.addStateData(player);
    backtrack.finishState();
    expect(backtrack.getStates()).toEqual([0]);

    backtrack.startState();
    backtrack.finishState();
    expect(backtrack.getStates()).toEqual([1]);

    backtrack.startState();
    backtrack.addStateData(player);
    backtrack.finishState();
    expect(backtrack.getStates()).toEqual([2]);

    backtrack.startState();
    backtrack.finishState();
    expect(backtrack.getStates()).toEqual([1, 3]);

    backtrack.startState();
    backtrack.addStateData(player);
    backtrack.finishState();
    expect(backtrack.getStates()).toEqual([2, 4]);

    backtrack.startState();
    backtrack.addStateData(player);
    backtrack.finishState();
    expect(backtrack.getStates()).toEqual([1, 3, 5]);

    backtrack.startState();
    backtrack.finishState();
    expect(backtrack.getStates()).toEqual([1, 2, 4]);

    backtrack.startState();
    backtrack.finishState();
    expect(backtrack.getStates()).toEqual([2, 3, 5]);

    backtrack.startState();
    backtrack.finishState();
    expect(backtrack.getStates()).toEqual([3, 4]);

    backtrack.startState();
    backtrack.addStateData(player);
    backtrack.finishState();
    expect(backtrack.getStates()).toEqual([4, 5]);

    backtrack.startState();
    backtrack.finishState();
    expect(backtrack.getStates()).toEqual([1, 5]);

    backtrack.apply(2, player.getId());
    backtrack.apply(1, -1);
});

test("Backtrack getAllPlayerPositions newest first", () => {
    const player = new MockPlayer(1, new Point(10, 10, 10), 190);
    const game = new MockGame([player]);
    const backtrack = new Backtrack(game, 10);

    backtrack.startState();
    backtrack.addStateData(player);
    backtrack.finishState();
    expect(backtrack.getAllPlayerPositions(1)).toEqual([[10, 10, 10]]);

    player.setPosition(new Point(20, 20, 20));
    backtrack.startState();
    backtrack.addStateData(player);
    backtrack.finishState();
    expect(backtrack.getAllPlayerPositions(1)).toEqual([
        [20, 20, 20],
        [10, 10, 10],
    ]);

    // only this player's positions are returned
    expect(backtrack.getAllPlayerPositions(2)).toEqual([]);
});

test("Backtrack disabled with zero history states", () => {
    const player = new MockPlayer(1, new Point(10, 10, 10), 190);
    const game = new MockGame([player]);
    const backtrack = new Backtrack(game, 0);

    backtrack.startState();
    backtrack.addStateData(player);
    backtrack.finishState();
    expect(backtrack.getStates()).toEqual([0]);
    expect(backtrack.getAllPlayerPositions(1)).toEqual([]);

    backtrack.saveState();
    backtrack.restoreState();
    backtrack.apply(1, 1);
    expectPoint(player.getPositionClone(), 10, 10, 10);
});

test("Backtrack invalid history count", () => {
    const game = new MockGame([new MockPlayer(1)]);
    expect(() => new Backtrack(game, -1)).toThrow(GameException);
    expect(() => new Backtrack(game, -1)).toThrow(/bigger or equal zero/);
});

test("Backtrack reset", () => {
    const player = new MockPlayer(1, new Point(), 190);
    const game = new MockGame([player]);
    const backtrack = new Backtrack(game, 5);

    backtrack.startState();
    backtrack.addStateData(player);
    backtrack.finishState();
    expect(backtrack.getStates()).toEqual([0]);

    backtrack.reset();
    expect(backtrack.getStates()).toEqual([0]);
    expect(backtrack.getAllPlayerPositions(1)).toEqual([]);
});
