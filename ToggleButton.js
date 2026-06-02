// ToggleButton.js
import * as THREE from 'three';

export class ToggleButton {
    /**
     * @param {THREE.Scene}   scene
     * @param {Function}      onToggle   - callback(isOn: boolean)
     */
    constructor(scene, onToggle) {
        this._scene    = scene;
        this._onToggle = onToggle;
        this.isOn      = false;

        this.group = new THREE.Group();
        this.group.userData.isTransformable = true;
        this.group.userData.saveId          = 'wave_toggle_button';
        this.group.name                     = 'Wave Button';

        // ── Đế trụ ──────────────────────────────────────────────────────────
        const baseMat = new THREE.MeshStandardMaterial({
            color    : 0x222222,
            metalness: 0.6,
            roughness: 0.4,
        });
        const base = new THREE.Mesh(
            new THREE.CylinderGeometry(0.28, 0.33, 0.18, 16),
            baseMat,
        );
        base.castShadow    = true;
        base.receiveShadow = true;
        this.group.add(base);

        // ── Nút bấm (mesh bắn vào) ───────────────────────────────────────────
        this._btnMat = new THREE.MeshStandardMaterial({
            color  : 0xdd2222,
            emissive      : new THREE.Color(0x440000),
            metalness: 0.1,
            roughness: 0.35,
        });
        this._btn = new THREE.Mesh(
            new THREE.CylinderGeometry(0.20, 0.20, 0.14, 16),
            this._btnMat,
        );
        this._btn.position.y = 0.16;
        this._btn.castShadow    = true;
        this._btn.receiveShadow = false;
        this.group.add(this._btn);

        // ── Đèn báo trạng thái ───────────────────────────────────────────────
        this._lightMat = new THREE.MeshBasicMaterial({ color: 0xff0000 });
        const lightDot = new THREE.Mesh(
            new THREE.SphereGeometry(0.05, 8, 8),
            this._lightMat,
        );
        lightDot.position.set(0, 0.26, 0);
        this.group.add(lightDot);

        // ── Nhãn "WAVE" bằng plane màu ──────────────────────────────────────
        //    (không dùng font loader cho đơn giản)
        const labelMat = new THREE.MeshBasicMaterial({
            color      : 0x00ccff,
            transparent: true,
            opacity    : 0.85,
            side       : THREE.DoubleSide,
        });
        const label = new THREE.Mesh(new THREE.PlaneGeometry(0.4, 0.1), labelMat);
        label.position.set(0, -0.02, 0.30);
        this.group.add(label);

        // ── Đăng ký userData.onHit cho cả nút và đế ─────────────────────────
        //    USPS._fire() sẽ gọi callback này khi raycast trúng
        const hitCb = () => this._onHit();
        this._btn.userData.onHit = hitCb;
        base.userData.onHit      = hitCb;
        lightDot.userData.onHit  = hitCb;

        scene.add(this.group);
    }

    // ── Đặt vị trí ───────────────────────────────────────────────────────────
    /** y = 0 → đáy nút nằm trên mặt sàn */
    place(x, y, z) {
        this.group.position.set(x, y + 0.09, z);
    }

    // ── Nội bộ ───────────────────────────────────────────────────────────────
    _onHit() {
        this.isOn = !this.isOn;

        // Đổi màu nút
        this._btnMat.color.set   (this.isOn ? 0x22dd22 : 0xdd2222);
        this._btnMat.emissive.set(this.isOn ? 0x004400 : 0x440000);

        // Đổi màu đèn báo
        this._lightMat.color.set(this.isOn ? 0x00ff44 : 0xff0000);

        this._onToggle(this.isOn);
    }
}