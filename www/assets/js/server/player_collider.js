import { cylinderWithCylinder, pointWithCylinder } from "./collision.js";
import { HitBoxType } from "./enums.js";
import { HitBox } from "./hit_box.js";
import { HitBoxBack } from "./hit_geometry/hit_box_back.js";
import { HitBoxChest } from "./hit_geometry/hit_box_chest.js";
import { HitBoxHead } from "./hit_geometry/hit_box_head.js";
import { HitBoxLegs } from "./hit_geometry/hit_box_legs.js";
import { HitBoxStomach } from "./hit_geometry/hit_box_stomach.js";

/**
 * Port of server/src/Core/PlayerCollider.php
 * The Player/Bullet/Backtrack dependencies are duck-typed (passed in, only
 * methods are called). HitBox and the HitGeometry classes are constructed
 * here and imported per the class-per-file naming contract.
 */
export class PlayerCollider {
    constructor(player) {
        this.player = player;
        this.hitBoxes = [];
        this.playerId = player.getId();

        // NOTE: only first hit box count so do good geometry and array priorities
        this.hitBoxes.push(new HitBox(this.player, HitBoxType.HEAD, new HitBoxHead()));
        this.hitBoxes.push(new HitBox(this.player, HitBoxType.BACK, new HitBoxBack()));
        this.hitBoxes.push(new HitBox(this.player, HitBoxType.STOMACH, new HitBoxStomach()));
        this.hitBoxes.push(new HitBox(this.player, HitBoxType.CHEST, new HitBoxChest()));
        this.hitBoxes.push(new HitBox(this.player, HitBoxType.LEG, new HitBoxLegs()));
    }

    roundReset() {
        for (const hitBox of this.hitBoxes) {
            hitBox.reset();
        }
    }

    tryHitPlayer(bullet, bulletPosition, backtrack) {
        for (const state of backtrack.getStates()) {
            backtrack.apply(state, this.playerId);

            if (
                !pointWithCylinder(
                    bulletPosition,
                    this.player.getReferenceToPosition(),
                    this.player.getBoundingRadius(),
                    this.player.getHeadHeight(),
                )
            ) {
                continue;
            }

            for (const hitBox of this.hitBoxes) {
                if (hitBox.intersect(bulletPosition)) {
                    hitBox.registerHit(bullet);
                    return hitBox;
                }
            }
        }

        return null;
    }

    isBoundaryCollision(point, radius, height) {
        return (
            this.player.isAlive() &&
            cylinderWithCylinder(
                this.player.getReferenceToPosition(),
                this.player.getBoundingRadius(),
                this.player.getHeadHeight(),
                point,
                radius,
                height,
            )
        );
    }

    /** @internal @codeCoverageIgnore */
    getHitBoxes() {
        return this.hitBoxes;
    }

    getPlayer() {
        return this.player;
    }
}
