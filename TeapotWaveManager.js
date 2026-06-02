// TeapotWaveManager.js
import * as THREE from 'three';
import { TeapotGeometry } from 'three/addons/geometries/TeapotGeometry.js';

const CONFIG = {
    width  : 6,
    height : 3,
    length : 20,

    speed         : 0.08,
    spawnInterval : 50,

    teapotRadius : 0.28,
    teapotColor  : 0xd4956a,

    explosionPoolSize    : 72,
    explosionParticles   : 6,
    explosionLife        : 34,
    explosionRadius      : 1,
    explosionSpeed       : 0.020,
    explosionMinScale    : 0.5,
    explosionMaxScale    : 2.0,
    explosionParticleGeo : 0.18,
    explosionFlashPoolSize : 12,
    explosionFlashColor    : 0xff7a18,
    explosionFlashIntensity: 55,
    explosionFlashDistance : 9,
};

const _GEO = new TeapotGeometry(CONFIG.teapotRadius, 6);
const _MAT = new THREE.MeshStandardMaterial({
    color    : CONFIG.teapotColor,
    metalness: 0.15,
    roughness: 0.65,
});

const _EXP_GEO = new THREE.SphereGeometry(CONFIG.explosionParticleGeo, 8, 6);
const _EXP_START_COLOR = new THREE.Color(0xff8a1f);
const _EXP_HOT_COLOR   = new THREE.Color(0xffd45a);
const _EXP_END_COLOR   = new THREE.Color(0x030201);

function randomUnitVector() {
    const v = new THREE.Vector3(
        Math.random() * 2 - 1,
        Math.random() * 2 - 1,
        Math.random() * 2 - 1,
    );

    if (v.lengthSq() < 0.0001) v.set(0, 1, 0);
    return v.normalize();
}

class ExplosionParticle {
    constructor(scene) {
        this.material = new THREE.MeshBasicMaterial({
            color       : _EXP_START_COLOR.clone(),
            transparent : true,
            opacity     : 1,
            depthWrite  : false,
        });
        this.mesh = new THREE.Mesh(_EXP_GEO, this.material);
        this.mesh.visible = false;
        this.mesh.frustumCulled = true;
        this.mesh.userData.ignoreBulletRaycast = true;
        scene.add(this.mesh);

        this.active = false;
        this.life = 0;
        this.duration = CONFIG.explosionLife;
        this.maxScale = CONFIG.explosionMaxScale;
        this.velocity = new THREE.Vector3();
        this._color = new THREE.Color();
    }

    activate(center, index = 0, total = 1) {
        const isCore = index === 0;
        const dir = isCore ? new THREE.Vector3(0, 1, 0) : randomUnitVector();
        const angle = (index / Math.max(1, total - 1)) * Math.PI * 2;
        const ring = new THREE.Vector3(Math.cos(angle), Math.random() * 0.55, Math.sin(angle)).normalize();
        const offset = isCore
            ? new THREE.Vector3(0, 0, 0)
            : ring.multiplyScalar(CONFIG.explosionRadius * (0.45 + Math.random() * 0.55));

        this.mesh.position.copy(center).add(offset);
        this.mesh.scale.setScalar(CONFIG.explosionMinScale);
        this.mesh.visible = true;
        this.material.opacity = 1;

        this.velocity.copy(isCore ? dir : offset.clone().normalize()).multiplyScalar(
            CONFIG.explosionSpeed * (isCore ? 0.35 : 0.75 + Math.random() * 0.65),
        );
        this.maxScale = isCore
            ? CONFIG.explosionMaxScale
            : THREE.MathUtils.lerp(0.52, 0.82, Math.random());
        this.duration = CONFIG.explosionLife + (isCore ? 0 : Math.floor(Math.random() * 8));
        this.life = 0;
        this.active = true;
    }

    update() {
        if (!this.active) return false;

        this.life++;
        const t = this.life / this.duration;
        const blast = THREE.MathUtils.smoothstep(t, 0.0, 0.12);
        const collapse = 1 - THREE.MathUtils.smoothstep(t, 0.56, 1.0);
        const scale = blast * collapse * this.maxScale;
        const hot = 1 - Math.abs(t - 0.10) / 0.10;
        const burn = THREE.MathUtils.smoothstep(t, 0.16, 0.74);

        this.mesh.position.add(this.velocity);
        this.velocity.multiplyScalar(0.935);
        this.mesh.scale.setScalar(Math.max(0.001, scale));

        this._color.copy(_EXP_START_COLOR).lerp(_EXP_HOT_COLOR, Math.max(0, hot));
        this._color.lerp(_EXP_END_COLOR, burn);
        this.material.color.copy(this._color);
        this.material.opacity = 1 - THREE.MathUtils.smoothstep(t, 0.62, 1.0);

        if (this.life >= this.duration) {
            this.deactivate();
            return false;
        }
        return true;
    }

    deactivate() {
        this.mesh.visible = false;
        this.mesh.scale.setScalar(0.001);
        this.material.opacity = 0;
        this.active = false;
    }
}

class ExplosionFlash {
    constructor(scene) {
        this.light = new THREE.PointLight(
            CONFIG.explosionFlashColor,
            0,
            CONFIG.explosionFlashDistance,
            2,
        );
        this.light.castShadow = false;
        scene.add(this.light);

        this.active = false;
        this.life = 0;
        this.duration = CONFIG.explosionLife;
    }

    activate(center) {
        this.light.position.copy(center);
        this.light.intensity = 0;
        this.life = 0;
        this.duration = CONFIG.explosionLife;
        this.active = true;
    }

    update() {
        if (!this.active) return false;

        this.life++;
        const t = this.life / this.duration;
        this.light.intensity = Math.sin(t * Math.PI) * CONFIG.explosionFlashIntensity;

        if (this.life >= this.duration) {
            this.deactivate();
            return false;
        }
        return true;
    }

    deactivate() {
        this.light.intensity = 0;
        this.active = false;
    }
}
class ExplosionPool {
    constructor(scene) {
        this._pool = Array.from(
            { length: CONFIG.explosionPoolSize },
            () => new ExplosionParticle(scene),
        );
        this._active = [];
        this._flashPool = Array.from(
            { length: CONFIG.explosionFlashPoolSize },
            () => new ExplosionFlash(scene),
        );
        this._activeFlashes = [];

        console.info(
            `[TeapotWaveManager] reserved ${CONFIG.explosionPoolSize} sphere meshes for teapot explosion effects.`,
        );
    }

    spawn(center) {
        let spawned = 0;
        this._spawnFlash(center);

        for (const particle of this._pool) {
            if (spawned >= CONFIG.explosionParticles) break;
            if (particle.active) continue;

            particle.activate(center, spawned, CONFIG.explosionParticles);
            this._active.push(particle);
            spawned++;
        }
    }


    _spawnFlash(center) {
        const flash = this._flashPool.find(f => !f.active);
        if (!flash) return;

        flash.activate(center);
        this._activeFlashes.push(flash);
    }
    update() {
        for (let i = this._active.length - 1; i >= 0; i--) {
            if (!this._active[i].update()) this._active.splice(i, 1);
        }

        for (let i = this._activeFlashes.length - 1; i >= 0; i--) {
            if (!this._activeFlashes[i].update()) this._activeFlashes.splice(i, 1);
        }
    }

    clearAll() {
        for (const particle of this._active) particle.deactivate();
        for (const flash of this._activeFlashes) flash.deactivate();
        this._active = [];
        this._activeFlashes = [];
    }
}

class Teapot {
    constructor(scene, startPos, dir, speed, maxTravel, onExplode, audio = null) {
        this._scene     = scene;
        this._dir       = dir;
        this._speed     = speed;
        this._maxTravel = maxTravel;
        this._traveled  = 0;
        this._onExplode = onExplode;
        this._audio     = audio;
        this.alive      = true;
        this._rotSpeed  = (Math.random() - 0.5) * 0.04;

        this.mesh = new THREE.Mesh(_GEO, _MAT);
        this.mesh.position.copy(startPos);
        this.mesh.castShadow    = true;
        this.mesh.receiveShadow = true;
        this.mesh.userData.onHit = () => this.explode();
        scene.add(this.mesh);
    }

    update() {
        if (!this.alive) return;
        this.mesh.position.addScaledVector(this._dir, this._speed);
        this.mesh.rotation.y += this._rotSpeed;
        this._traveled += this._speed;
        if (this._traveled >= this._maxTravel) this._remove();
    }

    explode() {
        if (!this.alive) return;

        const center = new THREE.Vector3();
        this.mesh.getWorldPosition(center);
        this._remove();
        this._audio?.play('teapot_explosion');
        this._onExplode(center);
    }

    _remove() {
        if (!this.alive) return;
        this.mesh.userData.onHit = null;
        this._scene.remove(this.mesh);
        this.alive = false;
    }
}

export class TeapotWaveManager {
    constructor(scene, audio = null) {
        this._audio      = audio;
        this._scene      = scene;
        this._teapots    = [];
        this._explosions = new ExplosionPool(scene);
        this._frame      = 0;
        this.isActive    = false;

        this.zoneGroup = new THREE.Group();
        this.zoneGroup.userData.isTransformable = true;
        this.zoneGroup.userData.saveId          = 'teapot_wave_zone';
        this.zoneGroup.name                     = 'Teapot Wave Zone';
        this.zoneGroup.position.set(0, 1.5, -10);
        scene.add(this.zoneGroup);

        this._buildVisuals();
    }

    _buildVisuals() {
        const { width, height, length } = CONFIG;
        const lineMat = (color) => new THREE.LineBasicMaterial({ color });

        const boxWire = new THREE.LineSegments(
            new THREE.EdgesGeometry(new THREE.BoxGeometry(width, height, length)),
            lineMat(0x00ff88),
        );
        this.zoneGroup.add(boxWire);

        const spawnEdge = new THREE.LineSegments(
            new THREE.EdgesGeometry(new THREE.PlaneGeometry(width, height)),
            lineMat(0xff4400),
        );
        spawnEdge.position.z = -length / 2;
        this.zoneGroup.add(spawnEdge);

        this._visuals = [boxWire, spawnEdge];
    }

    setHelperVisible(v) {
        this._visuals.forEach(o => o.visible = v);
    }

    toggle() {
        this.isActive = !this.isActive;
        if (!this.isActive) this._clearAll();
        return this.isActive;
    }

    update() {
        if (this.isActive) {
            this._frame++;
            if (this._frame % CONFIG.spawnInterval === 0) this._spawn();
        }

        for (let i = this._teapots.length - 1; i >= 0; i--) {
            this._teapots[i].update();
            if (!this._teapots[i].alive) this._teapots.splice(i, 1);
        }

        this._explosions.update();
    }

    _spawn() {
        const { width, height, length, speed } = CONFIG;

        const localPos = new THREE.Vector3(
            (Math.random() - 0.5) * width,
            (Math.random() - 0.5) * height,
            -length / 2,
        );

        const worldPos = localPos.clone();
        this.zoneGroup.localToWorld(worldPos);

        const worldDir = new THREE.Vector3(0, 0, 1)
            .transformDirection(this.zoneGroup.matrixWorld)
            .normalize();

        const worldScale = new THREE.Vector3();
        this.zoneGroup.getWorldScale(worldScale);
        const travelDist = length * worldScale.z;

        this._teapots.push(new Teapot(
            this._scene,
            worldPos,
            worldDir,
            speed,
            travelDist,
            (center) => this._explosions.spawn(center),
            this._audio,
        ));
    }

    _clearAll() {
        this._teapots.forEach(t => t._remove());
        this._teapots = [];
        this._explosions.clearAll();
    }
}