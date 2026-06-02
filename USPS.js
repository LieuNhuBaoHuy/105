import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { BulletPool } from './Bullet.js';
import { Flashlight } from './Flashlight.js';

const loader     = new GLTFLoader();
const MODEL_PATH = './resource/blood_shot__usp-s_skin.glb';

export class USPS extends THREE.Group {
    constructor(audio = null) {
        super();

        this.active = false;

        this._scene  = null;
        this._camera = null;
        this._audio  = audio;

        this._pool = new BulletPool();

        this._recoilCurrent = 0;
        this._recoilTarget  = 0;

        this.flashlight = new Flashlight();
        this.flashlight.attach(this);

        this._load();

        window.addEventListener('mousedown', (e) => {
            if (e.button !== 0 || !this.active) return;
            this._recoil();
            this._fire();
        });

    }

    _recoil(strength = 0.10) {
        this._recoilTarget = strength;
    }

    _fire() {
        if (!this._scene || !this._camera) return;

        this._audio?.play('gunshot');

        // ── Vị trí & hướng từ camera ─────────────────────────────────────
        const muzzlePos = new THREE.Vector3();
        this._camera.getWorldPosition(muzzlePos);

        const dir = new THREE.Vector3();
        this._camera.getWorldDirection(dir);

        // ── Raycast tìm vật thể bị bắn trúng ────────────────────────────
        const raycaster = new THREE.Raycaster(muzzlePos, dir, 0.1, 150);
        const targets   = [];
        this._scene.traverseVisible(obj => {
            if (obj.isMesh && !obj.userData.ignoreBulletRaycast) targets.push(obj);
        });

        const hits  = raycaster.intersectObjects(targets, false);
        const range = hits.length > 0 ? hits[0].distance : 150;

        // ── Gọi onHit callback nếu mesh có đăng ký ───────────────────────
        //    Bất kỳ mesh nào muốn phản hồi khi bị bắn chỉ cần set:
        //        mesh.userData.onHit = (hitInfo) => { ... }
        if (hits.length > 0) {
            const hitObj = hits[0].object;
            if (typeof hitObj.userData.onHit === 'function') {
                hitObj.userData.onHit(hits[0]);
            }
        }

        this._pool.fire(muzzlePos, dir, this._scene, range);
    }

    async _load() {
        try {
            const gltf = await loader.loadAsync(MODEL_PATH);
            const mesh = gltf.scene.children[0];
            if (mesh) this.add(mesh.clone());
        } catch (err) {
            console.error('Không thể load model USPS:', err);
        }
    }

    update() {
        this.position.y   -= this._recoilCurrent;
        this._recoilTarget *= 0.72;
        if (this._recoilTarget < 0.0005) this._recoilTarget = 0;
        this._recoilCurrent = this._recoilTarget;
        this.position.y   += this._recoilCurrent;

        if (this._camera) {
            this._pool.update(this._camera);
        }
    }
}