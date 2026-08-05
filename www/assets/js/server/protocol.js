/**
 * Port of server/src/Net/Protocol.php
 * PHP abstract class: serialization + command parsing contract for the net layer.
 */
export class Protocol {
    /** @type {Record<string, number>} PHP array<string,positive-int> [methodName => maxCallCountPerTick] */
    static playerControlMethods = Object.freeze({
        attack: 1,
        attack2: 1,
        backward: 1,
        buy: 9,
        crouch: 1,
        drop: 1,
        equip: 1,
        forward: 1,
        jump: 1,
        left: 1,
        look: 1,
        reload: 1,
        right: 1,
        run: 1,
        stand: 1,
        use: 1,
        walk: 1,
    });

    /** @type {Record<string, number>} PHP array<string,non-negative-int> [methodName => paramCount] */
    static playerControlMethodParamCount = Object.freeze({
        attack: 0,
        attack2: 0,
        backward: 0,
        buy: 1,
        crouch: 0,
        drop: 0,
        equip: 1,
        forward: 0,
        jump: 0,
        left: 0,
        look: 2,
        reload: 0,
        right: 0,
        run: 0,
        stand: 0,
        use: 0,
        walk: 0,
    });

    /** @type {Record<string, Record<number, boolean>>} PHP array<string,array<int,bool>> [methodName => [paramNumber => true]] */
    static methodParamFloat = Object.freeze({
        look: Object.freeze({
            1: true,
            2: true,
        }),
    });

    /** @type {Record<string, number>} PHP array<string,non-negative-int> [methodName => methodNumber] */
    static playerMethodByName = Object.freeze({
        attack: 0,
        attack2: 1,
        backward: 2,
        buy: 3,
        crouch: 4,
        drop: 5,
        equip: 6,
        forward: 7,
        jump: 8,
        left: 9,
        look: 10,
        reload: 11,
        right: 12,
        run: 13,
        stand: 14,
        use: 17,
        walk: 18,
    });

    /** @type {Record<number, string>} PHP array<non-negative-int,string> [methodNumber => methodName] */
    static playerMethodByNumber = Object.freeze({
        0: "attack",
        1: "attack2",
        2: "backward",
        3: "buy",
        4: "crouch",
        5: "drop",
        6: "equip",
        7: "forward",
        8: "jump",
        9: "left",
        10: "look",
        11: "reload",
        12: "right",
        13: "run",
        14: "stand",
        17: "use",
        18: "walk",
    });

    // PHP abstract methods
    serializeGameSetting(_player, _setting, _game) {
        throw new Error("Not implemented: abstract method");
    }

    serializeGameState(_game) {
        throw new Error("Not implemented: abstract method");
    }

    getRequestMaxSizeBytes() {
        throw new Error("Not implemented: abstract method");
    }

    parsePlayerControlCommands(_msg) {
        throw new Error("Not implemented: abstract method");
    }
}
