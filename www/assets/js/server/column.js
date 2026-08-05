/**
 * Port of server/src/Core/Column.php
 */
export class Column {
    constructor(center, radius, height) {
        this.center = center;
        this.radius = radius;
        this.height = height;
        this.active = true;
        this.highestPoint = this.center.clone().addY(this.height);
        this.boundaryMin = this.center.clone().addX(-this.radius).addZ(-this.radius);
        this.boundaryMax = this.center.clone().addX(this.radius).addZ(this.radius).addY(this.height);
    }
}
