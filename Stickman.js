
import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { USPS } from './USPS.js';

export class Stickman extends THREE.Group {
    constructor(audio = null) {
        super();

        // ✅ AffineEditor nhận diện Group này là level-1 target
        this.userData.isTransformable = true;
        this.userData.saveId = 'stickman';

        const material = new THREE.MeshStandardMaterial({
            color: 0xffffff,
            roughness: 0.95,
            metalness: 0,
            flatShading: true
        });

        // ─── Tạo từng bộ phận ───────────────────────────────────────────────
        const head = new THREE.Mesh(new THREE.SphereGeometry(0.45, 8, 8), material);
        head.position.y = 2.03;

        const body = new THREE.Mesh(new THREE.CylinderGeometry(0.16, 0.16, 0.95, 8), material);
        body.position.y = 1.25;

        const leftArm = new THREE.Mesh(new THREE.CapsuleGeometry(0.05, 0.55, 2, 4), material);
        leftArm.position.set(-0.2, 1.45, 0.25);
        leftArm.rotation.set(Math.PI / 2, 0, Math.PI);

        const rightArm = new THREE.Mesh(new THREE.CapsuleGeometry(0.05, 0.55, 2, 4), material);
        rightArm.position.set(0.2, 1.45, 0.25);
        rightArm.rotation.set(Math.PI / 2, 0, Math.PI);

        const leftLeg = new THREE.Mesh(new THREE.CapsuleGeometry(0.055, 0.7, 2, 4), material);
        leftLeg.position.set(-0.12, 0.38, 0);

        const rightLeg = new THREE.Mesh(new THREE.CapsuleGeometry(0.055, 0.7, 2, 4), material);
        rightLeg.position.set(0.12, 0.38, 0);

        const gun = new USPS(audio);
        gun.position.set(0, 1.45, 0.35);
        gun.scale.set(0.05, 0.05, 0.05);

        // ─── Gán metadata cho từng part ─────────────────────────────────────
        //     isPart  = true  → AffineEditor nhận ra đây là level-2 target
        //     saveId         → key lưu vào localStorage (phải unique toàn cục)
        //     name           → hiển thị trong status bar của editor
        const parts = [
            { mesh: head,     saveId: 'stickman__head',      name: 'Đầu'      },
            { mesh: body,     saveId: 'stickman__body',      name: 'Thân'     },
            { mesh: leftArm,  saveId: 'stickman__left_arm',  name: 'Tay trái' },
            { mesh: rightArm, saveId: 'stickman__right_arm', name: 'Tay phải' },
            { mesh: leftLeg,  saveId: 'stickman__left_leg',  name: 'Chân trái'},
            { mesh: rightLeg, saveId: 'stickman__right_leg', name: 'Chân phải'},
            { mesh: gun,      saveId: 'gun',                 name: 'Súng'     },
        ];

        parts.forEach(({ mesh, saveId, name }) => {
            mesh.userData.isPart  = true;   // ← đánh dấu level-2
            mesh.userData.saveId  = saveId;
            mesh.name             = name;
            mesh.castShadow       = true;
            mesh.receiveShadow    = true;
            this.add(mesh);
        });

        this.position.set(2, 0, -5);
    }

    moveTo(x, y, z) { this.position.set(x, y, z); }
}