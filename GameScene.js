// GameScene.js
import * as THREE from 'three';
import { GridPlatform }      from './GridPlatform.js';
import { InvisibleBox }      from './InvisibleBox.js';
import { Stickman }          from './Stickman.js';
import { TeapotWaveManager } from './TeapotWaveManager.js';
import { ToggleButton }      from './ToggleButton.js';
import { DayNightToggle }   from './DayNightToggle.js';

export class GameScene {
    constructor(scene, audio = null) {
        this.scene = scene;
        this.audio = audio;

        this.dayNightToggle = new DayNightToggle(scene);

        // ─── Sàn & tường biên ─────────────────────────────────────────────
        this.platform = new GridPlatform(500, 500);
        this.platform.addTo(scene);

        this.bounds = new InvisibleBox(500, 25, 500);
        scene.add(this.bounds.group);

        // ─── Stickman ─────────────────────────────────────────────────────
        this.stickman = new Stickman(audio);
        this.stickman.position.set(0, 0, 4);
        scene.add(this.stickman);

        // ─── Platforms cho Collision ───────────────────────────────────────
        this.platforms = [
            this.platform.mesh,
            ...this.bounds.meshes,
        ];

        // ─── Wave system ───────────────────────────────────────────────────
        this.teapotWave = new TeapotWaveManager(scene, audio);

        this.waveBtn = new ToggleButton(scene, () => this.teapotWave.toggle());
        this.waveBtn.place(3, 0, 2);
    }

    get transformables() {
        return [
            this.stickman,
            this.teapotWave.zoneGroup,
            this.waveBtn.group,
        ];
    }

    /** Gọi mỗi frame từ main.js */
    update(mode) {
        this.teapotWave.update();
        this.teapotWave.setHelperVisible(mode === 'tester');
    }
}
