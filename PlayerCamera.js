import * as THREE from 'three';
import { Collision } from './Collision.js';
import { NightVisionGoggle } from './NightVisionGoggle.js';

const EYE_HEIGHT  = 1.8;
const MOVE_SPEED  = 0.12;
const JUMP_FORCE  = 0.28;
const SENSITIVITY = 0.002;

// Offset đèn pin trong camera-space: sang phải một chút, xuống dưới một chút
// → shadow đổ lệch, player nhìn thấy được thay vì luôn rơi ra sau vật thể
const FL_OFFSET = new THREE.Vector3(
    0.30,
   -0.18,
   -0.45
);

export class PlayerCamera {
    constructor(camera, scene, domElement, stickman, playerHUD) {
        this._camera     = camera;
        this._scene      = scene;
        this._domElement = domElement;
        this._stickman   = stickman;
        this._hud        = playerHUD;

        // Physics body — invisible point used for collision
        // position.y = eye height (feet = y - EYE_HEIGHT)
        this._body = new THREE.Object3D();
        this._body.position.set(stickman.position.x, stickman.position.y + EYE_HEIGHT, stickman.position.z);
        scene.add(this._body);

        this._collision = new Collision(this._body, 1.0, EYE_HEIGHT);

        // FPS rotation (YXZ tránh gimbal lock)
        this._euler = new THREE.Euler(0, 0, 0, 'YXZ');

        // Night vision
        this._nvg = new NightVisionGoggle(scene, camera);

        // Tìm khẩu USPS trên stickman
        this._gun = null;
        stickman.traverse(child => {
            if (child.userData?.saveId === 'gun') this._gun = child;
        });

        this._keys          = { KeyW: false, KeyS: false, KeyA: false, KeyD: false };
        this._nHeld         = false;
        this._active        = false;
        this._fpsFlashlight = null;

        // Vector tái sử dụng mỗi frame — tránh tạo object mới trong update()
        this._flFwd    = new THREE.Vector3();
        this._flOffset = new THREE.Vector3();

        window.addEventListener('keydown',   e => this._onKeyDown(e));
        window.addEventListener('keyup',     e => this._onKeyUp(e));
        window.addEventListener('mousemove', e => this._onMouseMove(e));
    }

    enable() {
        this._active = true;
        this._domElement.requestPointerLock();
        this._hud.show();

        // Đặt body về vị trí stickman, cộng eye height để đứng trên sàn
        this._body.position.set(
            this._stickman.position.x,
            this._stickman.position.y + EYE_HEIGHT,
            this._stickman.position.z,
        );

        // Ẩn stickman (không clip vào mặt camera)
        this._stickman.visible = false;

        // Gắn gun vào camera như viewmodel FPS
        if (this._gun) {
            this._gunOrigParent   = this._gun.parent;
            this._gunOrigPosition = this._gun.position.clone();
            this._gunOrigScale    = this._gun.scale.clone();
            this._gunOrigRotation = this._gun.rotation.clone();

            this._camera.add(this._gun);
            this._gun.position.set(0.2, -0.5, -0.35);
            this._gun.rotation.set(0, Math.PI, 0);
            this._gun.scale.setScalar(0.05);

            // Tránh bullet raycast tự bắn vào viewmodel
            this._gun.traverse(obj => {
                if (obj.isMesh) obj.userData.ignoreBulletRaycast = true;
            });

            this._gun.active  = true;
            this._gun._scene  = this._scene;
            this._gun._camera = this._camera;

            // Tách flashlight ra khỏi camera-subtree, đặt thẳng vào scene
            // để WebGL shadow pass cập nhật được matrixWorld đúng thứ tự
            if (this._gun.flashlight) {
                const fl = this._gun.flashlight;
                this._scene.add(fl.light);
                this._scene.add(fl.target);
                this._fpsFlashlight = fl;
            }
        }
    }

    disable() {
        this._active = false;
        if (document.pointerLockElement === this._domElement) {
            document.exitPointerLock();
        }
        this._hud.hide();
        this._stickman.visible = true;

        // Trả gun về stickman
        if (this._gun) {
            this._gun.active = false;
            this._gun.traverse(obj => {
                if (obj.isMesh) delete obj.userData.ignoreBulletRaycast;
            });

            // Trả flashlight về gun, phục hồi vị trí local ban đầu
            if (this._gun.flashlight) {
                const fl = this._gun.flashlight;
                this._gun.add(fl.light);
                this._gun.add(fl.target);
                fl.light.position.set(0, -0.2, -0.8);
                fl.target.position.set(0, -0.2, -20);
            }
            this._fpsFlashlight = null;

            if (this._gunOrigParent) {
                this._gunOrigParent.add(this._gun);
                this._gun.position.copy(this._gunOrigPosition);
                this._gun.scale.copy(this._gunOrigScale);
                this._gun.rotation.copy(this._gunOrigRotation);
            }
        }

        // Tắt NVG khi thoát player mode
        this._nvg.turnOff();
        this._hud.updateNVG(0);
    }

    update(platforms) {
        if (!this._active) return;

        // Di chuyển WASD theo hướng nhìn (chỉ trục XZ)
        const sinY = Math.sin(this._euler.y);
        const cosY = Math.cos(this._euler.y);

        let dx = 0, dz = 0;
        if (this._keys.KeyW) { dx -= sinY; dz -= cosY; }
        if (this._keys.KeyS) { dx += sinY; dz += cosY; }
        if (this._keys.KeyA) { dx -= cosY; dz += sinY; }
        if (this._keys.KeyD) { dx += cosY; dz -= sinY; }

        const len = Math.sqrt(dx * dx + dz * dz);
        if (len > 0) {
            this._body.position.x += (dx / len) * MOVE_SPEED;
            this._body.position.z += (dz / len) * MOVE_SPEED;
        }

        // Trọng lực + va chạm
        this._collision.update(platforms);

        // Gắn camera vào mắt player
        this._camera.position.copy(this._body.position);
        this._camera.quaternion.setFromEuler(this._euler);

        // Stickman theo body, quay mặt về phía camera nhìn
        this._stickman.position.copy(this._body.position);
        this._stickman.position.y -= EYE_HEIGHT;
        this._stickman.rotation.y  = this._euler.y + Math.PI;

        if (this._gun) this._gun.update();
        this._nvg.update();

        // Sync flashlight vào scene mỗi frame
        if (this._fpsFlashlight) {

            const fl = this._fpsFlashlight;

            this._flOffset
                .copy(FL_OFFSET)
                .applyQuaternion(this._camera.quaternion);

            fl.light.position
                .copy(this._camera.position)
                .add(this._flOffset);

            this._flFwd
                .set(0, 0, -20)
                .applyQuaternion(this._camera.quaternion);

            fl.target.position
                .copy(fl.light.position)
                .add(this._flFwd);

            fl.light.updateMatrixWorld(true);
            fl.target.updateMatrixWorld(true);
        }
    }

    _onKeyDown(e) {
        if (this._keys.hasOwnProperty(e.code)) this._keys[e.code] = true;
        if (!this._active) return;

        if (e.code === 'Space' && this._collision.isGrounded) {
            this._collision.applyImpulse(JUMP_FORCE);
        }

        // Đèn pin
        if (e.code === 'KeyJ' && this._gun?.flashlight) {
            this._gun.flashlight.toggle();
            this._hud.updateFlashlight(this._gun.flashlight.enabled);
        }

        // NVG toggle + chọn mode
        if (e.code === 'KeyN') {
            this._nHeld = true;
            this._nvg.toggleLastMode();
            this._hud.updateNVG(this._nvg.mode);
        }

        if (this._nHeld) {
            if (e.code === 'Digit1') { this._nvg.setMode(NightVisionGoggle.SOLID);  this._hud.updateNVG(NightVisionGoggle.SOLID);  }
            if (e.code === 'Digit2') { this._nvg.setMode(NightVisionGoggle.LINES);  this._hud.updateNVG(NightVisionGoggle.LINES);  }
            if (e.code === 'Digit3') { this._nvg.setMode(NightVisionGoggle.POINTS); this._hud.updateNVG(NightVisionGoggle.POINTS); }
        }
    }

    _onKeyUp(e) {
        if (this._keys.hasOwnProperty(e.code)) this._keys[e.code] = false;
        if (e.code === 'KeyN') this._nHeld = false;
    }

    _onMouseMove(e) {
        if (!this._active || document.pointerLockElement !== this._domElement) return;
        this._euler.y -= e.movementX * SENSITIVITY;
        this._euler.x -= e.movementY * SENSITIVITY;
        this._euler.x = Math.max(-Math.PI / 2, Math.min(Math.PI / 2, this._euler.x));
    }
}