/**
 * Port of server/src/Core/ConsoleLogger.php
 * PHP printf("[%s] %s [%s]\n", date('Y-m-d H:i:s'), $message, $level)
 */
export class ConsoleLogger {
    log(level, message, _context = {}) {
        if (typeof level !== "string") {
            level = "unknown";
        }
        console.log(`[${dateTime()}] ${message} [${level}]`);
    }
}

function dateTime() {
    const now = new Date();
    const pad = (value) => String(value).padStart(2, "0");
    return (
        `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())} ` +
        `${pad(now.getHours())}:${pad(now.getMinutes())}:${pad(now.getSeconds())}`
    );
}
