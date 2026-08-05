import { SoundType } from "../enums.js";
import { CallbackEvent } from "../events/callback_event.js";
import { SoundEvent } from "../events/sound_event.js";
import { fallAmountPerTick, playerFallDamageThreshold, playerObstacleOvercomeHeight } from "../setting.js";
import { mapRange } from "../util.js";

/**
 * Port of server/src/Traits/Player/GravityTrait.php.
 * Mixin: methods are mounted on the Player class prototype (see player.js).
 * Trait instance state is initialized by _initGravityState(), which the
 * Player constructor calls.
 */
export function mixinGravity(PlayerClass) {
    PlayerClass.prototype._initGravityState = function () {
        this.fallHeight = 0;
    };

    PlayerClass.prototype.createGravityEvent = function () {
        return new CallbackEvent(() => this.processGravity(this.position));
    };

    PlayerClass.prototype.processGravity = function (point) {
        if (this.isJumping() || this.activeFloor || this.world.isPaused()) {
            return;
        }

        point.setY(this.calculateGravity(point, fallAmountPerTick()));
    };

    PlayerClass.prototype.calculateGravity = function (start, amount) {
        let targetYPosition = start.y - amount;
        const candidate = start.clone();
        for (let y = start.y; y >= targetYPosition; y--) {
            candidate.y = y;
            let floorCandidate = this.world.findFloorSquare(candidate, this.playerBoundingRadius);
            if (!floorCandidate) {
                floorCandidate = this.world.findPlayersHeadFloor(candidate, this.playerBoundingRadius);
            }
            if (floorCandidate) {
                this.setActiveFloor(floorCandidate);
                targetYPosition = y;
                break;
            }
        }

        return targetYPosition;
    };

    PlayerClass.prototype.setActiveFloor = function (floor) {
        this.activeFloor = floor;
        if (floor) {
            this.checkFallDamage(floor);
            this.removeEvent(this.eventIdJump);
            this.fallHeight = 0;
        } else {
            this.fallHeight = this.position.y;
        }
    };

    PlayerClass.prototype.checkFallDamage = function (floor) {
        const floorHeight = floor.getY();
        const fallHeight = this.fallHeight - floorHeight;
        if (fallHeight > 3 * playerObstacleOvercomeHeight()) {
            const soundEvent = new SoundEvent(this.getPositionClone().setY(floorHeight), SoundType.PLAYER_GROUND_TOUCH);
            this.world.makeSound(soundEvent.setPlayer(this));
        }

        const threshold = playerFallDamageThreshold();
        if (fallHeight < threshold) {
            return;
        }

        this.lowerHealth(mapRange(threshold, 2 * threshold, 1, 180, fallHeight));
        if (!this.isAlive()) {
            this.world.playerDiedToFallDamage(this);
        }
    };

    PlayerClass.prototype.isFlying = function () {
        return this.activeFloor === null || this.isJumping();
    };
}
