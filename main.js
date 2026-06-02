// main.js
import * as THREE from 'three';
import { GameScene }    from './GameScene.js';
import { TesterCamera } from './TesterCamera.js';
import { PlayerCamera } from './PlayerCamera.js';
import { AffineEditor } from './AffineEditor.js';
import { ShootingRange } from './ShootingRange.js';
import { AudioManager } from './AudioManager.js';
import { TesterUI }     from './TesterUI.js';
import { PlayerHUD }    from './PlayerHUD.js';

(async () => {

// ─── Load level.json từ server ────────────────────────────────────────────
// Trả về object level (có thể rỗng {} nếu file chưa có hoặc lỗi)
async function loadLevelJson() {
    try {
        const res   = await fetch('./resource/level.json');
        const level = await res.json();
        console.log('[Level] Loaded level.json —', Object.keys(level).length, 'entries');
        return level;
    } catch (err) {
        console.warn('[Level] Cannot load level.json, starting fresh.', err);
        return {};
    }
}

// ─── Ghi level.json qua server endpoint ──────────────────────────────────
// Gọi từ AffineEditor và ShootingRange mỗi khi có thay đổi cần lưu.
// Trả về true nếu thành công.
async function saveLevelJson(levelData) {
    try {
        const res = await fetch('/save-level', {
            method : 'POST',
            headers: { 'Content-Type': 'application/json' },
            body   : JSON.stringify(levelData),
        });
        const json = await res.json();
        if (!json.ok) throw new Error(json.error || 'unknown');
        return true;
    } catch (err) {
        console.error('[Level] Save failed:', err);
        return false;
    }
}

// ─── Renderer ─────────────────────────────────────────────────────────────
const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.shadowMap.enabled = true;
renderer.shadowMap.type    = THREE.PCFSoftShadowMap;
document.body.appendChild(renderer.domElement);

// ─── Scene & Camera ───────────────────────────────────────────────────────
const gameScene = new THREE.Scene();
const camera    = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 2000);
camera.position.set(0, 4, 12);

// ─── Audio ────────────────────────────────────────────────────────────────
const audio = new AudioManager();
audio.registerRestarting('gunshot',          './resource/shot.mp3',    0.7);
audio.registerOneShot(   'teapot_explosion', './resource/shatter.mp3', 4, 0.8);

// ─── Load level data ──────────────────────────────────────────────────────
const levelData = await loadLevelJson();

// ─── World ────────────────────────────────────────────────────────────────
const world = new GameScene(gameScene, audio);

// ─── UI ───────────────────────────────────────────────────────────────────
const playerHUD = new PlayerHUD();
const testerUI  = new TesterUI(
    () => setMode('tester'),
    () => setMode('player'),
);

// ─── Camera systems ───────────────────────────────────────────────────────
const testerCamera = new TesterCamera(camera, renderer.domElement);
const playerCamera = new PlayerCamera(camera, gameScene, renderer.domElement, world.stickman, playerHUD);

// ─── AffineEditor ─────────────────────────────────────────────────────────
// Truyền levelData và hàm saveLevelJson để editor đọc/ghi thẳng vào JSON
const affineEditor = new AffineEditor(
    gameScene, camera, renderer.domElement,
    levelData, saveLevelJson
);
affineEditor.loadAll(world.transformables);
affineEditor.controls.addEventListener('dragging-changed', (e) => {
    testerCamera.lookEnabled = !e.value;
});

// ─── ShootingRange ────────────────────────────────────────────────────────
const shootingRange = new ShootingRange(
    gameScene, affineEditor, camera, world.platforms,
    levelData, saveLevelJson
);

// ─── Mode management ──────────────────────────────────────────────────────
let currentMode = 'tester';

function setMode(mode) {
    currentMode = mode;
    const isTester = mode === 'tester';

    testerUI.setMode(mode);
    affineEditor.toggle(isTester);
    shootingRange.setVisible(isTester);

    if (isTester) {
        playerCamera.disable();
        testerCamera.isActive = true;

        const worldPos  = new THREE.Vector3();
        const worldQuat = new THREE.Quaternion();
        camera.getWorldPosition(worldPos);
        camera.getWorldQuaternion(worldQuat);
        gameScene.add(camera);
        camera.position.copy(worldPos);
        camera.quaternion.copy(worldQuat);
        testerCamera.euler.setFromQuaternion(worldQuat, 'YXZ');
    } else {
        testerCamera.isActive = false;
        playerCamera.enable();
    }
}

setMode('tester');

document.addEventListener('pointerlockchange', () => {
    if (currentMode === 'player' && document.pointerLockElement !== renderer.domElement) {
        setMode('tester');
    }
});

// ─── Resize ───────────────────────────────────────────────────────────────
window.addEventListener('resize', () => {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
});

// ─── Animate ──────────────────────────────────────────────────────────────
function animate() {
    requestAnimationFrame(animate);

    if (currentMode === 'tester') {
        testerCamera.update();
        affineEditor.update();
    } else {
        playerCamera.update(world.platforms);
    }

    world.update(currentMode);
    renderer.render(gameScene, camera);
}

animate();

})();
