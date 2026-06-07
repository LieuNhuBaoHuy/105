import * as THREE from 'three';

export class DayNightToggle {
    constructor(scene) {
        this.scene = scene;
        this.isNight = false;

        this.ambient = new THREE.AmbientLight(0xffffff, 0.5);
        this.scene.add(this.ambient);

        this.sun = new THREE.DirectionalLight(0xfff5e0, 1.2);
        this.sun.position.set(60, 100, 40);
        this.sun.castShadow = true;
        this.sun.shadow.mapSize.set(2048, 2048);
        Object.assign(this.sun.shadow.camera, {
            near: 0.5,
            far: 600,
            left: -250,
            right: 250,
            top: 250,
            bottom: -250,
        });
        this.scene.add(this.sun);

        this.scene.background = new THREE.Color();
        this.scene.fog = new THREE.Fog(0x87ceeb, 80, 350);

        this._buildButton();
        this.setNight(false);
    }

    _buildButton() {
        this.button = document.createElement('button');
        this.button.style.cssText = `
            position:fixed; top:48px; left:10px; z-index:99999;
            background:rgba(20,20,20,0.85); color:#ffd27a;
            border:1px solid #ffd27a; border-radius:6px;
            padding:7px 14px; font-family:monospace; font-size:13px;
            cursor:pointer; min-width:120px; text-align:left;
        `;
        this.button.onclick = () => this.toggle();
        document.body.appendChild(this.button);

        window.addEventListener('keydown', e => {
            if (e.code === 'KeyL') this.toggle();
        });
    }

    setNight(isNight) {
        this.isNight = isNight;

        if (isNight) {
            this.scene.background.set(0x050814);
            this.scene.fog.color.set(0x050814);
            this.scene.fog.near = 35;
            this.scene.fog.far = 190;

            this.ambient.color.set(0x26345c);
            this.ambient.intensity = 0.16;

            this.sun.color.set(0x8fa8ff);
            this.sun.intensity = 0.28;
            this.sun.position.set(-40, 85, -55);

            this.button.innerHTML = 'LIGHT: NIGHT <span style="font-size:9px;opacity:0.5">[L]</span>';
            this.button.style.color = '#b8c8ff';
            this.button.style.borderColor = '#8fa8ff';
        } else {
            this.scene.background.set(0x87ceeb);
            this.scene.fog.color.set(0x87ceeb);
            this.scene.fog.near = 80;
            this.scene.fog.far = 350;

            this.ambient.color.set(0xffffff);
            this.ambient.intensity = 0.5;

            this.sun.color.set(0xfff5e0);
            this.sun.intensity = 1.2;
            this.sun.position.set(60, 100, 40);

            this.button.innerHTML = 'LIGHT: DAY <span style="font-size:9px;opacity:0.5">[L]</span>';
            this.button.style.color = '#ffd27a';
            this.button.style.borderColor = '#ffd27a';
        }
    }

    toggle() {
        this.setNight(!this.isNight);
        return this.isNight;
    }
}