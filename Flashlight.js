import * as THREE from 'three';

const BEAM_DIST  = 20;
const BEAM_ANGLE = Math.PI / 7;

export class Flashlight {

    constructor() {

        this.enabled = false;

        this.light = new THREE.SpotLight(
            0xffffff,
            0,
            BEAM_DIST,
            BEAM_ANGLE,
            0.15,
            1.5
        );

        this.target = new THREE.Object3D();

        this.light.castShadow = true;
        this.light.target = this.target;

        this.light.shadow.mapSize.set(1024, 1024);

        this.light.shadow.camera.near = 0.1;
        this.light.shadow.camera.far  = 20;

        this.light.shadow.bias       = -0.00002;
        this.light.shadow.normalBias = 0.004;

        this.light.shadow.radius = 0.75;

        // TẮT HOÀN TOÀN CONE TẠM THỜI
        // Cone đang gây nhầm hướng.
    }

    attach(parent) {

        parent.add(this.light);
        parent.add(this.target);

        this.light.position.set(0, -0.2, -0.8);
        this.target.position.set(0, -0.2, -20);
    }

    toggle() {

        this.enabled = !this.enabled;

        this.light.intensity =
            this.enabled ? 25 : 0;
    }

    update() {}
}
