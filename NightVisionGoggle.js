import * as THREE from 'three';

export class NightVisionGoggle {
    static OFF = 0;
    static SOLID = 1;
    static LINES = 2;
    static POINTS = 3;

    constructor(scene, camera) {
        this.scene = scene;
        this.camera = camera;
        this.mode = NightVisionGoggle.OFF;
        this.lastMode = NightVisionGoggle.SOLID;

        this._managed = new Map();
        this._lineGeometryCache = new Map();

        this._solidMat = new THREE.MeshBasicMaterial({
            color: 0x74ff5c,
            transparent: true,
            opacity: 0.86,
            depthWrite: true,
        });
        this._hiddenMat = new THREE.MeshBasicMaterial({
            color: 0x000000,
            transparent: true,
            opacity: 0,
            colorWrite: false,
            depthWrite: false,
        });
        this._lineMat = new THREE.LineBasicMaterial({
            color: 0x72ff63,
            transparent: true,
            opacity: 0.95,
            depthWrite: false,
        });
        this._pointMat = new THREE.PointsMaterial({
            color: 0x82ff68,
            size: 0.045,
            sizeAttenuation: true,
            transparent: true,
            opacity: 0.95,
            depthWrite: false,
        });

        this._light = new THREE.PointLight(0x77ff66, 0, 18, 1.7);
        this.camera.add(this._light);

        this._buildHud();
    }

    toggleLastMode() {
        if (this.mode === NightVisionGoggle.OFF) {
            this.setMode(this.lastMode);
        } else {
            this.turnOff();
        }
    }

    setMode(mode) {
        if (mode === this.mode) return;

        this._restoreAll();
        this.mode = mode;
        if (mode !== NightVisionGoggle.OFF) this.lastMode = mode;

        this._light.intensity = this.mode === NightVisionGoggle.OFF ? 0 : 0.65;
        this._updateHud();

        if (this.mode !== NightVisionGoggle.OFF) this.update();
    }

    turnOff() {
        this.setMode(NightVisionGoggle.OFF);
    }

    update() {
        if (this.mode === NightVisionGoggle.OFF) return;

        this.scene.traverse(obj => {
            if (!this._isTargetMesh(obj)) return;
            this._applyMesh(obj);
        });

        for (const [mesh, entry] of this._managed) {
            if (!mesh.parent) {
                this._removeEntry(entry);
                this._managed.delete(mesh);
                continue;
            }
            this._syncOverlay(mesh, entry);
        }
    }

    _isTargetMesh(obj) {
        if (!obj.isMesh || !obj.geometry) return false;
        if (obj.userData.ignoreNightVision) return false;
        return true;
    }

    _applyMesh(mesh) {
        let entry = this._managed.get(mesh);
        if (!entry) {
            entry = {
                material: mesh.material,
                line: null,
                points: null,
                activeOverlay: null,
            };
            this._managed.set(mesh, entry);
        }

        if (this.mode === NightVisionGoggle.SOLID) {
            mesh.material = this._solidMat;
            this._setOverlay(entry, null);
            return;
        }

        mesh.material = this._hiddenMat;

        if (this.mode === NightVisionGoggle.LINES) {
            if (!entry.line) entry.line = this._createLineOverlay(mesh);
            this._setOverlay(entry, entry.line);
        } else if (this.mode === NightVisionGoggle.POINTS) {
            if (!entry.points) entry.points = this._createPointOverlay(mesh);
            this._setOverlay(entry, entry.points);
        }
    }

    _createLineOverlay(mesh) {
        let lineGeo = this._lineGeometryCache.get(mesh.geometry.uuid);
        if (!lineGeo) {
            lineGeo = new THREE.WireframeGeometry(mesh.geometry);
            this._lineGeometryCache.set(mesh.geometry.uuid, lineGeo);
        }

        const line = new THREE.LineSegments(lineGeo, this._lineMat);
        line.userData.ignoreBulletRaycast = true;
        line.userData.ignoreNightVision = true;
        this._attachOverlay(mesh, line);
        return line;
    }

    _createPointOverlay(mesh) {
        const points = new THREE.Points(mesh.geometry, this._pointMat);
        points.userData.ignoreBulletRaycast = true;
        points.userData.ignoreNightVision = true;
        this._attachOverlay(mesh, points);
        return points;
    }

    _attachOverlay(mesh, overlay) {
        if (!mesh.parent) return;
        mesh.parent.add(overlay);
        this._copyLocalTransform(mesh, overlay);
    }

    _syncOverlay(mesh, entry) {
        const overlay = entry.activeOverlay;
        if (!overlay) return;

        if (overlay.parent !== mesh.parent && mesh.parent) {
            mesh.parent.add(overlay);
        }
        this._copyLocalTransform(mesh, overlay);
        overlay.visible = mesh.visible;
    }

    _copyLocalTransform(mesh, overlay) {
        overlay.position.copy(mesh.position);
        overlay.quaternion.copy(mesh.quaternion);
        overlay.scale.copy(mesh.scale);
        overlay.renderOrder = mesh.renderOrder + 1;
    }

    _setOverlay(entry, overlay) {
        if (entry.line) entry.line.visible = false;
        if (entry.points) entry.points.visible = false;
        entry.activeOverlay = overlay;
        if (overlay) overlay.visible = true;
    }

    _restoreAll() {
        for (const [mesh, entry] of this._managed) {
            if (mesh.parent) mesh.material = entry.material;
            this._removeEntry(entry);
        }
        this._managed.clear();
    }

    _removeEntry(entry) {
        if (entry.line?.parent) entry.line.parent.remove(entry.line);
        if (entry.points?.parent) entry.points.parent.remove(entry.points);
        entry.line = null;
        entry.points = null;
        entry.activeOverlay = null;
    }

    _buildHud() {
        this._hud = document.createElement('div');
        this._hud.style.cssText = `
            position:fixed; left:50%; bottom:24px; transform:translateX(-50%);
            z-index:99999; display:none; pointer-events:none;
            font-family:monospace; font-size:13px; color:#9cff86;
            background:rgba(0,20,0,0.72); border:1px solid rgba(120,255,90,0.65);
            padding:6px 12px; border-radius:6px; text-shadow:0 0 8px #55ff44;
        `;
        document.body.appendChild(this._hud);
        this._updateHud();
    }

    _updateHud() {
        if (!this._hud) return;
        const labels = ['OFF', 'SOLID', 'LINES', 'POINTS'];
        this._hud.style.display = this.mode === NightVisionGoggle.OFF ? 'none' : 'block';
        this._hud.textContent = `NVG: ${labels[this.mode]}  |  hold N + 1/2/3`;
    }
}