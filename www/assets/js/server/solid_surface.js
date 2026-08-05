/**
 * Port of server/src/Core/SolidSurface.php
 */
export class SolidSurface {
    // abstract in PHP
    getHitAntiForce(_point) {
        throw new Error("Not implemented: abstract method");
    }

    getMoneyAward() {
        return 0;
    }

    playerWasKilled() {
        return false;
    }

    getPlayer() {
        return null;
    }

    wasHeadShot() {
        return false;
    }

    getDamage() {
        return 0;
    }

    // abstract in PHP
    getPlane() {
        throw new Error("Not implemented: abstract method");
    }
}
