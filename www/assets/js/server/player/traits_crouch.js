import { CrouchEvent } from "../events/crouch_event.js";
import { playerHeadHeightCrouch, playerHeadHeightStand } from "../setting.js";

/**
 * Port of server/src/Traits/Player/CrouchTrait.php.
 * Mixin: methods are mounted on the Player class prototype (see player.js).
 */
export function mixinCrouch(PlayerClass) {
    PlayerClass.prototype.createCrouchEvent = function (directionDown) {
        if (this.eventsCache[this.eventIdCrouch]) {
            /** @type {CrouchEvent} */
            const event = this.eventsCache[this.eventIdCrouch];
            event.reset();
            event.directionDown = directionDown;
            this.addEvent(event, this.eventIdCrouch);
            return;
        }

        const event = new CrouchEvent(directionDown, (crouchEvent) => {
            const headHeightCrouch = playerHeadHeightCrouch();
            if (crouchEvent.directionDown) {
                this.headHeight -= crouchEvent.moveOffset;
                if (this.headHeight < headHeightCrouch) {
                    this.headHeight = headHeightCrouch;
                }
                return;
            }

            const targetHeadHeight = Math.min(playerHeadHeightStand(), this.headHeight + crouchEvent.moveOffset);
            const candidate = this.position.clone();
            for (let h = this.headHeight + 1; h <= targetHeadHeight; h++) {
                candidate.setY(this.position.y + h);
                if (this.world.findFloorSquare(candidate, this.getBoundingRadius())) {
                    crouchEvent.restartTimer();
                    break;
                }
                if (this.world.isCollisionWithOtherPlayers(this.getId(), candidate, this.getBoundingRadius(), 2)) {
                    crouchEvent.restartTimer();
                    this.headHeight = headHeightCrouch;
                    break;
                }
                this.headHeight = h;
            }
        });

        this.addEvent(event, this.eventIdCrouch);
        this.eventsCache[this.eventIdCrouch] = event;
    };

    PlayerClass.prototype.stand = function () {
        if (this.getHeadHeight() === playerHeadHeightStand()) {
            return;
        }

        this.createCrouchEvent(false);
    };

    PlayerClass.prototype.crouch = function () {
        if (this.getHeadHeight() === playerHeadHeightCrouch()) {
            return;
        }
        if (!this.canCrouch()) {
            return;
        }

        this.createCrouchEvent(true);
    };

    PlayerClass.prototype.isCrouching = function () {
        return this.getHeadHeight() !== playerHeadHeightStand();
    };

    PlayerClass.prototype.canCrouch = function () {
        return this.events[this.eventIdCrouch] === undefined;
    };
}
