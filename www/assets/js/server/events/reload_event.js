import { TimeoutEvent } from "./timeout_event.js";

/**
 * Port of server/src/Event/ReloadEvent.php
 * NOTE: provisional port created for fleet integration; the events agent owns this file.
 */
export class ReloadEvent extends TimeoutEvent {}
