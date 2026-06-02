import * as THREE from 'three';

// ═══════════════════════════════════════════════════════════════════════════
//  HẰNG SỐ
// ═══════════════════════════════════════════════════════════════════════════
const MAX_BULLETS = 16;
const TRACER_LIFE = 10;    // frame tồn tại
const MAX_RANGE   = 150;

// ─── TUNING ──────────────────────────────────────────────────────────────
const LIGHT_COLOR      = 0x99ff55;
const LIGHT_INTENSITY  = 80;   // tăng cao vì bắn lên trời không có gì phản chiếu
const LIGHT_DISTANCE   = 18;
const LIGHT_SHADOW_RES = 512;

const BULLET_SPRITE_SIZE  = 0.22;  // kích thước chấm sáng di chuyển
const MUZZLE_FLASH_SIZE   = 0.6;   // kích thước muzzle flash
const MUZZLE_FLASH_FRAMES = 2;     // số frame muzzle flash tồn tại
const HIT_GLOW_SIZE       = 0.35;  // kích thước glow tại điểm chạm

// ── Vùng fade gần camera ─────────────────────────────────────────────────
//    Sprite & light bị ẩn dần khi quá gần camera để tránh đốm sáng màn hình
//    FADE_START: bắt đầu mờ dần (unit)
//    FADE_END:   hoàn toàn ẩn   (unit) — nên < camera.near hoặc ≈ 1.0
const CAM_FADE_START = 2.5;   // ← tăng nếu vẫn thấy đốm, giảm nếu mất sớm quá
const CAM_FADE_END   = 0.8;

// ═══════════════════════════════════════════════════════════════════════════
//  TEXTURES DÙNG CHUNG (build 1 lần)
// ═══════════════════════════════════════════════════════════════════════════
const _TEX_BULLET = _buildRadialTexture('rgba(200,255,160,1)', 'rgba(80,255,40,0)');
const _TEX_FLASH  = _buildRadialTexture('rgba(255,255,220,1)', 'rgba(255,200,50,0)');
const _TEX_HIT    = _buildRadialTexture('rgba(255,255,200,1)', 'rgba(60,255,30,0)');

function _buildRadialTexture(innerColor, outerColor) {
    const cv = document.createElement('canvas');
    cv.width = cv.height = 64;
    const ctx = cv.getContext('2d');
    const g = ctx.createRadialGradient(32, 32, 0, 32, 32, 32);
    g.addColorStop(0,    innerColor);
    g.addColorStop(0.4,  innerColor.replace(/[\d.]+\)$/, '0.6)'));
    g.addColorStop(1,    outerColor);
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, 64, 64);
    return new THREE.CanvasTexture(cv);
}

// ═══════════════════════════════════════════════════════════════════════════
//  BULLET ENTRY
// ═══════════════════════════════════════════════════════════════════════════
class BulletEntry {
    constructor() {
        // ── Chấm sáng di chuyển (bullet sprite) ──────────────────────────
        this._bulletMat = new THREE.SpriteMaterial({
            map       : _TEX_BULLET,
            blending  : THREE.AdditiveBlending,
            depthWrite: false,
        });
        this._bullet = new THREE.Sprite(this._bulletMat);
        this._bullet.scale.setScalar(BULLET_SPRITE_SIZE);
        this._bullet.frustumCulled = false;

        // ── Muzzle flash (tại họng súng, tắt sau 2 frame) ────────────────
        this._flashMat = new THREE.SpriteMaterial({
            map       : _TEX_FLASH,
            blending  : THREE.AdditiveBlending,
            depthWrite: false,
        });
        this._flash = new THREE.Sprite(this._flashMat);
        this._flash.scale.setScalar(MUZZLE_FLASH_SIZE);
        this._flash.frustumCulled = false;

        // ── Glow tại hit point ────────────────────────────────────────────
        this._hitMat = new THREE.SpriteMaterial({
            map       : _TEX_HIT,
            blending  : THREE.AdditiveBlending,
            depthWrite: false,
        });
        this._hit = new THREE.Sprite(this._hitMat);
        this._hit.scale.setScalar(HIT_GLOW_SIZE);
        this._hit.frustumCulled = false;

        // ── PointLight di chuyển cùng bullet sprite ───────────────────────
        this._light = new THREE.PointLight(LIGHT_COLOR, 0, LIGHT_DISTANCE, 2);
        this._light.castShadow = true;
        this._light.shadow.mapSize.set(LIGHT_SHADOW_RES, LIGHT_SHADOW_RES);
        this._light.shadow.camera.near = 0.05;
        this._light.shadow.camera.far  = LIGHT_DISTANCE;

        // ── Trạng thái ───────────────────────────────────────────────────
        this.active    = false;
        this.life      = 0;
        this._scene    = null;
        this._startPos = new THREE.Vector3();
        this._endPos   = new THREE.Vector3();
    }

    // ─── Kích hoạt ───────────────────────────────────────────────────────
    activate(muzzlePos, dir, scene, range = MAX_RANGE) {
        this._scene = scene;
        this._startPos.copy(muzzlePos);
        this._endPos.copy(muzzlePos).addScaledVector(dir, range);

        // Muzzle flash tại họng súng
        this._flash.position.copy(this._startPos);
        this._flashMat.opacity = 1;

        // Bullet & light bắt đầu tại muzzle
        this._bullet.position.copy(this._startPos);
        this._bulletMat.opacity = 1;
        this._light.position.copy(this._startPos);
        this._light.intensity = LIGHT_INTENSITY;

        // Hit glow tại điểm cuối (ẩn cho đến khi bullet đến nơi)
        this._hit.position.copy(this._endPos);
        this._hitMat.opacity = 0;

        this.life   = TRACER_LIFE;
        this.active = true;

        scene.add(this._flash);
        scene.add(this._bullet);
        scene.add(this._hit);
        scene.add(this._light);
    }

    // ─── Mỗi frame ───────────────────────────────────────────────────────
    tick(camera) {
        if (!this.active) return false;

        this.life--;
        const t        = this.life / TRACER_LIFE;   // 1 → 0
        const progress = 1 - t;                      // 0 → 1

        // ── Bullet sprite & light di chuyển từ start → end ───────────────
        this._bullet.position.lerpVectors(this._startPos, this._endPos, progress);
        this._light.position.copy(this._bullet.position);

        // ── Fade dựa theo khoảng cách đến camera ─────────────────────────
        //    Khi sprite quá gần (< CAM_FADE_START), mờ dần về 0
        //    → triệt tiêu đốm sáng màn hình khi giật lùi sau khi bắn
        const camDist  = this._bullet.position.distanceTo(camera.position);
        const camFade  = THREE.MathUtils.smoothstep(
            camDist,
            CAM_FADE_END,    // = 0 khi dist ≤ FADE_END
            CAM_FADE_START   // = 1 khi dist ≥ FADE_START
        );
        //    smoothstep cho đường cong mượt hơn linear, không bị cắt đột ngột

        // ── Muzzle flash: tắt sau MUZZLE_FLASH_FRAMES frame ──────────────
        //    Flash không áp dụng camFade vì nó cố định tại muzzle,
        //    không di chuyển theo camera → không gây đốm màn hình
        const flashT = this.life / MUZZLE_FLASH_FRAMES;
        this._flashMat.opacity = Math.max(0, Math.min(1, flashT));

        // ── Áp dụng fade ─────────────────────────────────────────────────
        this._bulletMat.opacity       = t * camFade;
        this._light.intensity         = LIGHT_INTENSITY
                                        * Math.sin(progress * Math.PI)
                                        * camFade;

        // ── Hit glow xuất hiện khi bullet gần đến nơi (progress > 0.7) ───
        const hitT = Math.max(0, (progress - 0.7) / 0.3);
        this._hitMat.opacity = hitT * t;

        if (this.life <= 0) {
            this._scene.remove(this._flash);
            this._scene.remove(this._bullet);
            this._scene.remove(this._hit);
            this._scene.remove(this._light);
            this.active = false;
            return false;
        }
        return true;
    }

    forceRemove() {
        if (!this._scene) return;
        this._scene.remove(this._flash);
        this._scene.remove(this._bullet);
        this._scene.remove(this._hit);
        this._scene.remove(this._light);
        this.active = false;
    }
}

// ═══════════════════════════════════════════════════════════════════════════
//  BULLET POOL
// ═══════════════════════════════════════════════════════════════════════════
export class BulletPool {
    constructor() {
        this._pool   = Array.from({ length: MAX_BULLETS }, () => new BulletEntry());
        this._active = [];
    }

    _getFree() {
        return this._pool.find(e => !e.active) ?? null;
    }

    fire(muzzlePos, dir, scene, range = MAX_RANGE) {
        const entry = this._getFree();
        if (!entry) return;
        entry.activate(muzzlePos, dir.clone().normalize(), scene, range);
        this._active.push(entry);
    }

    update(camera) {
        for (let i = this._active.length - 1; i >= 0; i--) {
            const alive = this._active[i].tick(camera);
            if (!alive) this._active.splice(i, 1);
        }
    }

    dispose() {
        for (const entry of this._active) entry.forceRemove();
        this._active = [];
    }
}