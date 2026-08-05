export const Utils = {
    tickMs: 0,
    LAYER_ALL: 0,
    LAYER_WORLD: 1,
    LAYER_ITEMS: 2,
    LAYER_PLAYERS: 3,

    degreeToRadian(degree) {
        return (degree * Math.PI) / 180;
    },

    radianToDegree(radian) {
        return Math.round((radian * 180) / Math.PI);
    },

    threeRotationToServer(eulerYXZ) {
        const horizontal = (eulerYXZ.y * 180) / Math.PI;
        const vertical = (eulerYXZ.x * 180) / Math.PI;

        if (horizontal === 0) {
            return [0, vertical];
        }

        if (horizontal < 0) {
            return [Math.abs(horizontal), vertical];
        }

        return [360 - horizontal, vertical];
    },

    serverHorizontalRotationToThreeRadian(angleDegree) {
        return Utils.degreeToRadian(360 - angleDegree);
    },

    serverVerticalRotationToThreeRadian(angleDegree) {
        return Utils.degreeToRadian(angleDegree);
    },

    scopeLevelToZoom(scopeLevel) {
        if (!scopeLevel) {
            return 1;
        }
        if (scopeLevel === 1) {
            return 4;
        }
        if (scopeLevel === 2) {
            return 15;
        }

        return 99;
    },

    randomInt(start, end) {
        return start + Math.floor(Math.random() * (end - start + 1));
    },

    lerp(start, end, percentage) {
        return (1 - percentage) * start + percentage * end;
    },

    msToTick(timeMs) {
        return Math.ceil(timeMs / Utils.tickMs);
    },

    smallestDeltaAngle(start, target) {
        const a = (((start - target) % 360) + 360) % 360;
        const b = (((target - start) % 360) + 360) % 360;
        return a < b ? -a : b;
    },

    rotatePointY(angle, x, z, centerX = 0, centerZ = 0, clockWise = true) {
        const sin = Math.sin(Utils.degreeToRadian(angle));
        const cos = Math.cos(Utils.degreeToRadian(angle));

        return [
            centerX + cos * (x - centerX) + sin * (z - centerZ),
            centerZ + (clockWise ? -1 : 1) * sin * (x - centerX) + cos * (z - centerZ),
        ];
    },
};
