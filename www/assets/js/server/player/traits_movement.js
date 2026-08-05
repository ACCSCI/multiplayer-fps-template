import { ItemType, SoundType } from "../enums.js";
import { CallbackEvent } from "../events/callback_event.js";
import { SoundEvent } from "../events/sound_event.js";
import { GameException } from "../game_exception.js";
import { hasContract, ScopeItem } from "../interfaces.js";
import {
    flyingMovementSpeedMultiplier,
    getWeaponPrimarySpeedMultiplier,
    getWeaponSecondarySpeedMultiplier,
    jumpMovementSpeedMultiplier,
    moveDistanceCrouchPerTick,
    moveDistancePerTick,
    moveDistanceWalkPerTick,
    playerObstacleOvercomeHeight,
} from "../setting.js";
import { mapRange, movementXZ, nearbyInt, normalizeAngle, roundHalfAwayFromZero, smallestDeltaAngle } from "../util.js";

/**
 * Port of server/src/Traits/Player/MovementTrait.php.
 * Mixin: methods are mounted on the Player class prototype (see player.js).
 * Trait instance state is initialized by _initMovementState(), which the
 * Player constructor calls.
 */
export function mixinMovement(PlayerClass) {
    PlayerClass.prototype._initMovementState = function () {
        this.moveX = 0;
        this.moveZ = 0;
        this.lastMoveX = 0;
        this.lastMoveZ = 0;
        this.lastAngle = 0;
        // PHP private bool $isWalking; renamed to avoid the JS name collision
        // between the instance property and the isWalking() prototype method.
        this.walking = false;
        this.velocityPermil = 0;
    };

    PlayerClass.prototype.speedRun = function () {
        this.walking = false;
    };

    PlayerClass.prototype.speedWalk = function () {
        this.walking = true;
    };

    PlayerClass.prototype.isMoving = function () {
        return this.moveX !== 0 || this.moveZ !== 0;
    };

    PlayerClass.prototype.isWalking = function () {
        return this.walking;
    };

    PlayerClass.prototype.isRunning = function () {
        return !this.walking;
    };

    PlayerClass.prototype.getPositionClone = function () {
        return this.position.clone();
    };

    PlayerClass.prototype.getCentrePointClone = function () {
        return this.getPositionClone().addY(Math.ceil(this.headHeight / 2));
    };

    PlayerClass.prototype.getSightPositionClone = function () {
        return this.position.clone().addY(this.getSightHeight());
    };

    PlayerClass.prototype.getReferenceToPosition = function () {
        return this.position;
    };

    PlayerClass.prototype.setPosition = function (newPosition) {
        this.position.setFrom(newPosition);
        this.setActiveFloor(this.world.findFloorSquare(this.position, this.playerBoundingRadius));
    };

    PlayerClass.prototype.stop = function () {
        this.lastMoveX = this.moveX;
        this.lastMoveZ = this.moveZ;
        this.moveX = 0;
        this.moveZ = 0;
    };

    PlayerClass.prototype.moveForward = function () {
        this.moveZ = 1;
    };

    PlayerClass.prototype.moveRight = function () {
        this.moveX = 1;
    };

    PlayerClass.prototype.moveLeft = function () {
        this.moveX = -1;
    };

    PlayerClass.prototype.moveBackward = function () {
        this.moveZ = -1;
    };

    PlayerClass.prototype.createMovementEvent = function () {
        this.velocityPermil = 0;
        return new CallbackEvent(() => {
            if (!this.isMoving()) {
                this.velocityPermil = 0;
                return;
            }

            this.updateVelocity();
            this.position.setFrom(this.processMovement(this.moveX, this.moveZ, this.position));
            this.world.tryPickDropItems(this);
            this.stop();
        });
    };

    PlayerClass.prototype.updateVelocity = function () {
        if (this.velocityPermil === 1000) {
            return;
        }
        if (this.velocity === 0) {
            this.velocityPermil = 1000;
            return;
        }

        this.velocityPermil = Math.min(1000, this.velocityPermil + this.velocity);
    };

    /** @infection-ignore-all */
    PlayerClass.prototype.getMoveAngle = (moveX, moveZ, angle) => {
        if (moveX !== 0 && moveZ !== 0) {
            // diagonal move
            if (moveZ === 1) {
                angle += moveX * 45;
            } else {
                angle += moveX * (45 * 3);
            }
        } else {
            // single direction move
            if (moveZ === -1) {
                angle += 180;
            } else if (moveX === 1) {
                angle += 90;
            } else if (moveX === -1) {
                angle += -90;
            }
        }

        return angle;
    };

    /** @infection-ignore-all */
    PlayerClass.prototype.getMoveSpeed = function () {
        let speed;
        if (this.isCrouching()) {
            speed = moveDistanceCrouchPerTick();
        } else if (this.isWalking()) {
            speed = moveDistanceWalkPerTick();
        } else if (this.isRunning()) {
            speed = moveDistancePerTick();
        } else {
            throw new GameException("Wat doing?");
        }

        const equippedItem = this.getEquippedItem();
        if (equippedItem.getType() === ItemType.TYPE_WEAPON_PRIMARY) {
            speed *= getWeaponPrimarySpeedMultiplier(equippedItem.getId());
        } else if (equippedItem.getType() === ItemType.TYPE_WEAPON_SECONDARY) {
            speed *= getWeaponSecondarySpeedMultiplier(equippedItem.getId());
        }
        if (hasContract(equippedItem, ScopeItem) && equippedItem.isScopedIn()) {
            speed *= 0.5;
        }
        if (this.isJumping()) {
            speed *= jumpMovementSpeedMultiplier();
        } else if (this.isFlying()) {
            speed *= flyingMovementSpeedMultiplier();
        }
        if (this.events[this.eventIdShotSlowdown] !== undefined) {
            speed *= 0.4;
        }

        return Math.ceil((speed * this.velocityPermil) / 1000);
    };

    PlayerClass.prototype.processMovement = function (moveX, moveZ, current) {
        // If single direction move in opposite direction than previous (counter strafing) we stop
        if (
            !(moveX !== 0 && moveZ !== 0) &&
            ((moveX !== 0 && this.lastMoveX === -moveX) || (moveZ !== 0 && this.lastMoveZ === -moveZ))
        ) {
            this.velocityPermil = 0;
            return current;
        }

        const angle = normalizeAngle(this.getMoveAngle(this.moveX, this.moveZ, this.sight.getRotationHorizontal()));
        const angleInt = nearbyInt(angle);

        if (this.isFlying()) {
            if (this.lastAngle === null) {
                return current;
            }
            if (Math.abs(smallestDeltaAngle(this.lastAngle, angleInt)) > 160) {
                // stop if drastically changing direction in air
                this.lastAngle = null;
                return current;
            }
        }
        this.lastAngle = angleInt;

        const target = this.move(current.clone(), this.getMoveSpeed(), angle, false);

        if (this.isRunning() && !this.isCrouching() && !this.isFlying() && !current.equals(target)) {
            const soundEvent = new SoundEvent(target, SoundType.PLAYER_STEP);
            this.world.makeSound(soundEvent.setPlayer(this));
        }

        return target;
    };

    PlayerClass.prototype.move = function (orig, distanceTarget, angle, looseFloor) {
        const target = orig.clone();
        let candidate = target.clone();
        const angleInt = nearbyInt(angle);

        for (let i = 1; i <= distanceTarget; i++) {
            const [x, z] = movementXZ(angle, i);
            candidate.setX(orig.x + x).setZ(orig.z + z);
            if (candidate.equals(target)) {
                continue;
            }

            const canMove = this.canMoveTo(target, candidate, angleInt);
            if (!canMove) {
                if (canMove === null) {
                    // if move is possible in one axis at least
                    const targetAngle = roundHalfAwayFromZero(
                        normalizeAngle(
                            this.getMoveAngle(Math.sign(candidate.x - target.x), Math.sign(candidate.z - target.z), 0),
                        ),
                    );
                    const delta = Math.abs(smallestDeltaAngle(angleInt, targetAngle));
                    if (delta < 90 && distanceTarget - i > 1) {
                        const newDistanceTarget = mapRange(20, 80, distanceTarget - i, 1, delta);
                        candidate = this.move(candidate, newDistanceTarget - 1, angle, looseFloor);
                    }
                    target.setFrom(candidate);
                }
                break;
            }

            if (this.activeFloor && !this.activeFloor.intersect(this.position, this.playerBoundingRadius)) {
                this.setActiveFloor(null);
            }
            if (!looseFloor && !this.activeFloor && !this.isJumping()) {
                // do initial (one-shot) gravity bump
                candidate.setY(this.calculateGravity(candidate, 1));
                looseFloor = null === this.activeFloor;
            }
            target.setFrom(candidate);
        }

        return target;
    };

    PlayerClass.prototype.canMoveTo = function (start, candidate, angle) {
        const radius = this.playerBoundingRadius;
        if (this.collisionWithPlayer(candidate, radius)) {
            return false;
        }
        const height = this.headHeight;
        const xMove = start.x !== candidate.x;
        const zMove = start.z !== candidate.z;
        const maxWallCeiling = candidate.y + playerObstacleOvercomeHeight();

        let xWallMaxHeight = 0;
        if (xMove) {
            const xGrowing = start.x < candidate.x;
            const baseX = candidate.clone().addX(xGrowing ? radius : -radius);
            xWallMaxHeight = this.world.findHighestWall(baseX, height, radius, maxWallCeiling, true);
        }
        let zWallMaxHeight = 0;
        if (zMove) {
            const zGrowing = start.z < candidate.z;
            const baseZ = candidate.clone().addZ(zGrowing ? radius : -radius);
            zWallMaxHeight = this.world.findHighestWall(baseZ, height, radius, maxWallCeiling, false);
        }
        if (xWallMaxHeight === 0 && zWallMaxHeight === 0) {
            // no walls
            return true;
        }
        if (xWallMaxHeight > maxWallCeiling && zWallMaxHeight > maxWallCeiling) {
            // tall walls everywhere
            return false;
        }
        if (xMove && xWallMaxHeight === 0 && zWallMaxHeight > maxWallCeiling) {
            // can move in X direction
            candidate.setZ(start.z); // side effect
            return null;
        }
        if (zMove && zWallMaxHeight === 0 && xWallMaxHeight > maxWallCeiling) {
            // can move in Z direction
            candidate.setX(start.x); // side effect
            return null;
        }
        if (this.isFlying()) {
            // wall touch in air is stop
            return false;
        }

        // Try step over ONE low height wall
        let highestWallCeiling = null;
        if (xWallMaxHeight === 0 && zWallMaxHeight <= maxWallCeiling) {
            highestWallCeiling = zWallMaxHeight;
        } else if (zWallMaxHeight === 0 && xWallMaxHeight <= maxWallCeiling) {
            highestWallCeiling = xWallMaxHeight;
        }
        if (highestWallCeiling !== null) {
            const floor = this.world.findFloorSquare(candidate.clone().setY(highestWallCeiling), radius);
            if (floor) {
                const candidateY = candidate.clone().setY(floor.getY());
                if (!this.collisionWithPlayer(candidateY, radius)) {
                    candidate.setY(floor.getY()); // side effect
                    this.setActiveFloor(floor);
                    return true;
                }
            }
        }

        // Try to move 1 unit from start in one axis at least if possible
        if (angle % 90 === 0) {
            // If moving in 90s angles against wall we stop
            return false;
        }
        // Try to move in X axis
        let oneSideCandidate = start.clone().addX(angle > 180 ? -1 : 1);
        const oneSideCandidateX = oneSideCandidate.clone().addX(angle > 180 ? -radius : radius);
        let wallCeiling = this.world.findHighestWall(oneSideCandidateX, height, radius, maxWallCeiling, true);
        if (wallCeiling > maxWallCeiling) {
            // X too tall, try to move in Z axis
            oneSideCandidate = start.clone().addZ(angle > 270 || angle < 90 ? 1 : -1);
            const oneSideCandidateZ = oneSideCandidate.clone().addZ(angle > 270 || angle < 90 ? radius : -radius);
            wallCeiling = this.world.findHighestWall(oneSideCandidateZ, height, radius, maxWallCeiling, false);
        }
        if (wallCeiling > maxWallCeiling) {
            // tall walls everywhere
            return false;
        }
        if (wallCeiling === 0 && this.collisionWithPlayer(oneSideCandidate, radius)) {
            // no wall but player
            return false;
        }

        if (wallCeiling > 0) {
            // wall we can try step over
            oneSideCandidate.setY(wallCeiling);
            const floor = this.world.findFloorSquare(oneSideCandidate, radius);
            if (!floor || this.collisionWithPlayer(oneSideCandidate, radius)) {
                // no floor or player
                return false;
            }
            this.setActiveFloor(floor);
        }
        candidate.setFrom(oneSideCandidate); // side effect
        return null;
    };

    PlayerClass.prototype.collisionWithPlayer = function (candidate, radius) {
        return null !== this.world.isCollisionWithOtherPlayers(this.id, candidate, radius, this.headHeight);
    };
}
