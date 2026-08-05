import { assert } from "../assert.js";
import { JumpEvent } from "../events/jump_event.js";
import { jumpDistancePerTick, playerJumpHeight, tickCountJump } from "../setting.js";

/**
 * Port of server/src/Traits/Player/JumpTrait.php.
 * Mixin: methods are mounted on the Player class prototype (see player.js).
 */
export function mixinJump(PlayerClass) {
    PlayerClass.prototype.jump = function () {
        if (!this.canJump()) {
            return;
        }

        if (!this.eventsCache[this.eventIdJump]) {
            this.eventsCache[this.eventIdJump] = new JumpEvent((jumpEvent) => {
                assert(jumpEvent instanceof JumpEvent);
                const targetYPosition = Math.min(jumpEvent.maxYPosition, this.position.y + jumpDistancePerTick());
                const candidate = this.position.clone().addY(this.headHeight);
                let y = this.position.y;
                for (; y < targetYPosition; y++) {
                    candidate.addY(1);
                    const floorCandidate = this.world.findFloorSquare(candidate, this.playerBoundingRadius);
                    if (floorCandidate) {
                        this.removeEvent(this.eventIdJump);
                        break;
                    }
                    if (this.world.isCollisionWithOtherPlayers(this.id, candidate, this.playerBoundingRadius, 2)) {
                        this.removeEvent(this.eventIdJump);
                        break;
                    }
                }

                if (this.position.y === y) {
                    this.removeEvent(this.eventIdJump);
                } else {
                    this.setActiveFloor(null);
                    this.position.setY(y);
                }
            }, tickCountJump() * 2);
        }

        /** @type {JumpEvent} */
        const event = this.eventsCache[this.eventIdJump];
        event.reset();
        event.maxYPosition = this.position.y + playerJumpHeight() + (this.isCrouching() ? 10 : 0);
        this.addEvent(event, this.eventIdJump);
    };

    PlayerClass.prototype.isJumping = function () {
        return this.events[this.eventIdJump] !== undefined;
    };

    PlayerClass.prototype.canJump = function () {
        return Boolean(this.activeFloor) && !this.isJumping();
    };
}
