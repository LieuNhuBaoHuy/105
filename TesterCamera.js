import * as THREE from 'three';
// ❌ Đã xoá: import { AffineEditor } from './AffineEditor.js';
//    Import này không được dùng và gây vòng phụ thuộc không cần thiết.

export class TesterCamera {
    constructor(camera, domElement) {
        this.camera = camera;
        this.domElement = domElement || document.body;

        this.isActive = true;//
        
        // Cấu hình thông số
        this.moveSpeed = 0.7;
        this.lookSpeed = 0.01;
        
        // Trạng thái phím bấm
        this.keys = {
            KeyW: false, KeyS: false, KeyA: false, KeyD: false,
            KeyQ: false, KeyE: false
        };
        
        // Trạng thái chuột
        this.isRMBDown = false;

        /**
         * AffineEditor sẽ đặt cờ này = false khi đang kéo TransformControls
         * để tránh camera bị xoay theo chuột trong lúc drag gizmo.
         */
        this.lookEnabled = true;
        
        // Quản lý hướng nhìn bằng Euler (thứ tự xoay YXZ để tránh xoắn camera)
        this.euler = new THREE.Euler(0, 0, 0, 'YXZ');
        
        this._initEvents();
    }

    _initEvents() {
        // Lắng nghe bàn phím
        window.addEventListener('keydown', (e) => {
            if (this.keys.hasOwnProperty(e.code)) this.keys[e.code] = true;
        });
        window.addEventListener('keyup', (e) => {
            if (this.keys.hasOwnProperty(e.code)) this.keys[e.code] = false;
        });

        // Lắng nghe chuột phải
        window.addEventListener('mousedown', (e) => {
            if (e.button === 2) {
                this.isRMBDown = true;
                this.domElement.style.cursor = 'crosshair';
            }
        });

        window.addEventListener('mouseup', (e) => {
            if (e.button === 2) {
                this.isRMBDown = false;
                this.domElement.style.cursor = 'default';
            }
        });

        // Xoay camera khi giữ RMB và di chuyển chuột
        // ✅ Kiểm tra thêm this.lookEnabled — AffineEditor sẽ tắt cờ này khi drag gizmo
        window.addEventListener('mousemove', (e) => {
            if (!this.isRMBDown || !this.lookEnabled) return;

            const movementX = e.movementX || 0;
            const movementY = e.movementY || 0;

            this.euler.y -= movementX * this.lookSpeed;
            this.euler.x -= movementY * this.lookSpeed;

            // Giới hạn góc nhìn lên/xuống để không bị lật camera
            this.euler.x = Math.max(-Math.PI / 2, Math.min(Math.PI / 2, this.euler.x));

            this.camera.quaternion.setFromEuler(this.euler);
        });

        // Chặn menu chuột phải mặc định của trình duyệt
        window.addEventListener('contextmenu', (e) => e.preventDefault());
    }

    update() {
        if (this.keys.KeyW) this.camera.translateZ(-this.moveSpeed);
        if (this.keys.KeyS) this.camera.translateZ(this.moveSpeed);
        if (this.keys.KeyA) this.camera.translateX(-this.moveSpeed);
        if (this.keys.KeyD) this.camera.translateX(this.moveSpeed);
        if (this.keys.KeyE) this.camera.translateY(this.moveSpeed);
        if (this.keys.KeyQ) this.camera.translateY(-this.moveSpeed);
    }
}