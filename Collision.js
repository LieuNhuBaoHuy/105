import * as THREE from 'three';

export class Collision {
    /**
     * @param {THREE.Object3D} mesh
     * @param {number}         mass
     * @param {number|null}    eyeHeight
     */
    constructor(mesh, mass = 1.0, eyeHeight = null) {
        this.mesh     = mesh;
        this.mass     = mass;
        this.velocity = new THREE.Vector3(0, 0, 0);

        this.gravity          = -0.012;
        this.terminalVelocity = -0.9;
        this.isGrounded       = false;

        this._hasGeometry  = !!(mesh.geometry);
        this._playerRadius = 0.35;
        this._headMargin   = 0.25;
        this._skin         = 0.015;

        if (eyeHeight !== null) {
            this.eyeHeight = eyeHeight;
        } else if (this._hasGeometry && mesh.geometry.parameters?.height) {
            this.eyeHeight = mesh.geometry.parameters.height / 2;
        } else {
            this.eyeHeight = 0.9;
        }

        this.box = new THREE.Box3();
        this._prevBox = new THREE.Box3();
        this._platformBox = new THREE.Box3();
        this._center = new THREE.Vector3();
    }

    _updateBox() {
        if (this._hasGeometry) {
            this.box.setFromObject(this.mesh);
        } else {
            const p = this.mesh.position;
            const r = this._playerRadius;
            this.box.min.set(p.x - r, p.y - this.eyeHeight, p.z - r);
            this.box.max.set(p.x + r, p.y + this._headMargin, p.z + r);
        }
    }

    update(platforms) {
        this._updateBox();
        this._prevBox.copy(this.box);

        if (!this.isGrounded) {
            this.velocity.y += this.gravity;
            if (this.velocity.y < this.terminalVelocity) {
                this.velocity.y = this.terminalVelocity;
            }
        }

        this.mesh.position.y += this.velocity.y;
        this._updateBox();
        this.isGrounded = false;

        this._resolveVertical(platforms);
        this._resolveHorizontal(platforms);
    }

    _resolveVertical(platforms) {
        for (const platform of platforms) {
            this._platformBox.setFromObject(platform);
            if (!this.box.intersectsBox(this._platformBox)) continue;

            const wasAbove = this._prevBox.min.y >= this._platformBox.max.y - this._skin;
            const wasBelow = this._prevBox.max.y <= this._platformBox.min.y + this._skin;

            if (this.velocity.y <= 0 && wasAbove) {
                this.mesh.position.y = this._platformBox.max.y + this.eyeHeight;
                this.velocity.y = 0;
                this.isGrounded = true;
                this._updateBox();
            } else if (this.velocity.y > 0 && wasBelow) {
                this.mesh.position.y = this._platformBox.min.y - this._headMargin;
                this.velocity.y = 0;
                this._updateBox();
            }
        }
    }

    _resolveHorizontal(platforms) {
        for (const platform of platforms) {
            this._platformBox.setFromObject(platform);
            if (!this.box.intersectsBox(this._platformBox)) continue;

            const ox = Math.min(this.box.max.x, this._platformBox.max.x)
                     - Math.max(this.box.min.x, this._platformBox.min.x);
            const oz = Math.min(this.box.max.z, this._platformBox.max.z)
                     - Math.max(this.box.min.z, this._platformBox.min.z);
            const oy = Math.min(this.box.max.y, this._platformBox.max.y)
                     - Math.max(this.box.min.y, this._platformBox.min.y);

            if (ox <= 0 || oz <= 0 || oy <= this._skin) continue;

            this._platformBox.getCenter(this._center);
            if (ox <= oz) {
                const sign = this.mesh.position.x < this._center.x ? -1 : 1;
                this.mesh.position.x += sign * (ox + this._skin);
            } else {
                const sign = this.mesh.position.z < this._center.z ? -1 : 1;
                this.mesh.position.z += sign * (oz + this._skin);
            }

            this._updateBox();
        }
    }

    applyImpulse(forceY) {
        this.velocity.y = forceY;
        this.isGrounded = false;
    }
}