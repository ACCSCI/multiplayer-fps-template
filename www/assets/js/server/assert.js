/**
 * Port of PHP assert() (dev-mode behavior: throws when the condition is false).
 * The PHP test suite runs with assertions enabled, so a faithful port throws.
 */
export function assert(condition, message = "Assertion failed") {
    if (!condition) {
        throw new Error(message);
    }
}
