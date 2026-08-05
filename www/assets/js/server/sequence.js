/**
 * Port of server/src/Core/Sequence.php
 */
let value = 0;

export class Sequence {
    static next() {
        return `id-${++value}`;
    }
}
