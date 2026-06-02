import * as THREE from 'three';

export class InvisibleBox {
    constructor(width, height, depth) {
        this.group = new THREE.Group();
        this.meshes = [];

        // Material tàng hình (có thể để opacity thấp để debug nếu cần)
        const material = new THREE.MeshBasicMaterial({ 
            visible: false 
        });

        const thickness = 1; // Độ dày của tường biên giới

        // 1. Tạo 4 bức tường xung quanh
        const wallGeomSide = new THREE.BoxGeometry(thickness, height, depth);
        const wallGeomFront = new THREE.BoxGeometry(width, height, thickness);

        // Tường trái & phải
        const leftWall = new THREE.Mesh(wallGeomSide, material);
        leftWall.position.set(-width / 2, height / 2, 0);
        
        const rightWall = new THREE.Mesh(wallGeomSide, material);
        rightWall.position.set(width / 2, height / 2, 0);

        // Tường trước & sau
        const frontWall = new THREE.Mesh(wallGeomFront, material);
        frontWall.position.set(0, height / 2, depth / 2);

        const backWall = new THREE.Mesh(wallGeomFront, material);
        backWall.position.set(0, height / 2, -depth / 2);

        // 2. Tạo trần nhà (ngăn nhảy quá cao)
        const ceilingGeom = new THREE.BoxGeometry(width, thickness, depth);
        const ceiling = new THREE.Mesh(ceilingGeom, material);
        ceiling.position.set(0, height, 0);

        // Thêm tất cả vào group
        this.group.add(leftWall, rightWall, frontWall, backWall, ceiling);
        
        // Lưu danh sách mesh để dùng cho va chạm
        this.meshes = [leftWall, rightWall, frontWall, backWall, ceiling];
    }
}