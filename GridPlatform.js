// GridPlatform.js
import * as THREE from 'three';
import { Collision } from './Collision.js';

export class GridPlatform {
    /**
     * @param {number} width - Chiều rộng sàn
     * @param {number} depth - Chiều sâu sàn
     * @param {string} texturePath - Đường dẫn tới file ảnh grid của bạn
     */
    constructor(width = 500, depth = 500, texturePath = './resource/sl_072622_51930_13.jpg') {
        // 1. Tạo Geometry (Giữ nguyên dạng hình hộp để không lỗi logic Collision của bạn)
        const geometry = new THREE.BoxGeometry(width, 2, depth);

        // 2. Nạp và xử lý Texture sàn lưới
        const textureLoader = new THREE.TextureLoader();
        const gridTexture = textureLoader.load(texturePath);
        
        // Bật chế độ lặp lại vô hạn theo 2 chiều S (X) và T (Y)
        gridTexture.wrapS = THREE.RepeatWrapping;
        gridTexture.wrapT = THREE.RepeatWrapping;
        
        // QUYẾT ĐỊNH KÍCH THƯỚC Ô LƯỚI:
        // Cứ mỗi 2 đơn vị trong Three.js sẽ là 1 ô lưới đầy đủ của bức ảnh.
        // Bạn có thể tăng/giảm số này để chỉnh ô lưới to hay nhỏ (Ví dụ: 1, 2, 5, 10...)
        const unitPerGridTile = 2; 
        gridTexture.repeat.set(width / unitPerGridTile, depth / unitPerGridTile);

        // 3. Tạo bộ vật liệu (Materials) cho các mặt
        // Vật liệu dành cho các cạnh bên và mặt đáy (Màu xám đen lỳ cao cấp)
        const sideMaterial = new THREE.MeshStandardMaterial({
            color: 0x15151c,
            roughness: 0.8,
            metalness: 0.2
        });

        // Vật liệu dành riêng cho mặt trên cùng (Chứa texture lưới Unreal)
        const topMaterial = new THREE.MeshStandardMaterial({
            map: gridTexture,
            roughness: 0.7,
            metalness: 0.1
        });

        // Thứ tự mảng vật liệu của BoxGeometry trong Three.js bắt buộc là:
        // [ +X (phải), -X (trái), +Y (trên), -Y (dưới), +Z (trước), -Z (sau) ]
        const materials = [
            sideMaterial, // +X
            sideMaterial, // -X
            topMaterial,  // +Y (Mặt sàn người chơi đứng lên)
            sideMaterial, // -Y
            sideMaterial, // +Z
            sideMaterial  // -Z
        ];

        // 4. Tạo Mesh tích hợp mảng vật liệu
        this.mesh = new THREE.Mesh(geometry, materials);
        
        // Đặt platform hơi thấp xuống để mặt sàn trên cùng nằm chính xác tại y = 0
        this.mesh.position.y = -1; 

        // Đổ bóng kĩ thuật số
        this.mesh.castShadow = true;
        this.mesh.receiveShadow = true;

        // 5. Khai báo Collision (Giữ nguyên để hệ thống nhân vật không bị lọt sàn)
        this.physics = new Collision(this.mesh, Infinity);
    }

    // Thêm vào scene dễ dàng hơn
    addTo(scene) {
        scene.add(this.mesh);
    }
}