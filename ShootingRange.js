// ShootingRange.js
import * as THREE from 'three';

// ─── Kích thước mặc định khi spawn box mới ───────────────────────────────────
const DEFAULT_W = 1.2;
const DEFAULT_H = 2.0;
const DEFAULT_D = 1.2;

// ─── Màu sắc vật cản ─────────────────────────────────────────────────────────
const BOX_COLOR     = 0x7a8fa6;
const BOX_ROUGHNESS = 0.85;

// ═══════════════════════════════════════════════════════════════════════════════
//  SHOOTING RANGE
// ═══════════════════════════════════════════════════════════════════════════════
export class ShootingRange {
    /**
     * @param {THREE.Scene}  scene
     * @param {object}       affineEditor  - instance AffineEditor
     * @param {THREE.Camera} camera        - dùng để spawn box trước mặt
     * @param {Array}        platforms     - mảng platforms của Collision
     * @param {object}       levelData     - object level.json dùng chung với AffineEditor
     * @param {Function}     saveFn        - async (levelData) => boolean
     */
    constructor(scene, affineEditor, camera, platforms, levelData, saveFn) {
        this._scene     = scene;
        this._affine    = affineEditor;
        this._camera    = camera;
        this._platforms = platforms;
        this._level     = levelData;
        this._saveFn    = saveFn;

        // { id → { mesh, cfg } }
        this._boxes = new Map();

        this._loadFromLevel();
        this._buildUI();
    }

    // ═══════════════════════════════════════════════════════════════════════════
    //  PUBLIC
    // ═══════════════════════════════════════════════════════════════════════════

    /** Thêm box mới tại vị trí 2m trước camera, đáy trên mặt sàn */
    addBox(w = DEFAULT_W, h = DEFAULT_H, d = DEFAULT_D) {
        const id  = 'srbox_' + Date.now();
        const cfg = { id, w, h, d };

        const spawnPos = new THREE.Vector3();
        this._camera.getWorldPosition(spawnPos);
        const fwd = new THREE.Vector3();
        this._camera.getWorldDirection(fwd);
        fwd.y = 0;
        fwd.normalize();
        spawnPos.addScaledVector(fwd, 3);
        spawnPos.y = h / 2;

        const mesh = this._createMesh(cfg, spawnPos);

        // Cập nhật sr_boxes trong levelData và ghi file
        this._saveToLevel();

        // Đăng ký với AffineEditor — box mới chưa có saved transform → dùng vị trí spawn
        this._affine.loadAll([mesh]);

        return mesh;
    }

    /** Xóa box theo id */
    removeBox(id) {
        const entry = this._boxes.get(id);
        if (!entry) return;

        // Gỡ khỏi scene
        this._scene.remove(entry.mesh);

        // Gỡ khỏi platforms (collision)
        const idx = this._platforms.indexOf(entry.mesh);
        if (idx !== -1) this._platforms.splice(idx, 1);

        // Gỡ transform khỏi affine_saves trong levelData
        if (this._level.affine_saves) {
            delete this._level.affine_saves[id];
        }

        this._boxes.delete(id);

        // Ghi file
        this._saveToLevel();
        this._refreshDeleteButtons();
    }

    /** Trả về mảng tất cả mesh */
    get meshes() {
        return [...this._boxes.values()].map(e => e.mesh);
    }

    /** Gọi từ main.js khi đổi mode */
    setVisible(v) {
        this._panel.style.display = v ? 'flex' : 'none';
    }

    // ═══════════════════════════════════════════════════════════════════════════
    //  PRIVATE — load
    // ═══════════════════════════════════════════════════════════════════════════

    _loadFromLevel() {
        const list = this._getSrBoxList();
        list.forEach(cfg => {
            const mesh = this._createMesh(cfg);
            // AffineEditor sẽ tự apply transform từ levelData.affine_saves
            this._affine.loadAll([mesh]);
        });
    }

    /** Lấy mảng sr_boxes từ levelData, tạo nếu chưa có */
    _getSrBoxList() {
        if (!Array.isArray(this._level.sr_boxes)) {
            this._level.sr_boxes = [];
        }
        return this._level.sr_boxes;
    }

    // ═══════════════════════════════════════════════════════════════════════════
    //  PRIVATE — save
    // ═══════════════════════════════════════════════════════════════════════════

    /** Cập nhật sr_boxes trong levelData và ghi file */
    async _saveToLevel() {
        this._level.sr_boxes = [...this._boxes.values()].map(e => e.cfg);
        const ok = await this._saveFn(this._level);
        if (!ok) {
            console.error('[ShootingRange] Lưu level.json thất bại!');
            this._showToast('❌ Lưu thất bại! (server chạy chưa?)');
        } else {
            this._showToast('🎯 Đã lưu vào level.json');
        }
    }

    // ═══════════════════════════════════════════════════════════════════════════
    //  PRIVATE — mesh
    // ═══════════════════════════════════════════════════════════════════════════

    _createMesh(cfg, initialPos = null) {
        const geo  = new THREE.BoxGeometry(cfg.w, cfg.h, cfg.d);
        const mat  = new THREE.MeshStandardMaterial({
            color    : BOX_COLOR,
            roughness: BOX_ROUGHNESS,
            metalness: 0.1,
        });
        const mesh = new THREE.Mesh(geo, mat);
        mesh.castShadow    = true;
        mesh.receiveShadow = true;

        mesh.userData.isTransformable = true;
        mesh.userData.saveId          = cfg.id;
        mesh.name                     = cfg.id;

        if (initialPos) mesh.position.copy(initialPos);

        this._scene.add(mesh);
        this._platforms.push(mesh);
        this._boxes.set(cfg.id, { mesh, cfg });

        return mesh;
    }

    // ═══════════════════════════════════════════════════════════════════════════
    //  PRIVATE — UI
    // ═══════════════════════════════════════════════════════════════════════════

    _buildUI() {
        this._panel = document.createElement('div');
        this._panel.style.cssText = `
            position: fixed; bottom: 12px; right: 12px; z-index: 9998;
            background: rgba(10,10,15,0.92); color: #ddd;
            border: 1px solid #333; border-radius: 8px;
            padding: 10px 12px; font-family: monospace; font-size: 12px;
            display: none; flex-direction: column; gap: 6px; min-width: 180px;
            box-shadow: 0 4px 20px rgba(0,0,0,0.6);
        `;

        const title = document.createElement('b');
        title.style.color = '#fff';
        title.textContent = '🎯 SHOOTING RANGE';
        this._panel.appendChild(title);

        const btnAdd = this._makeBtn('+ Thêm Box', '#1a4a2a', () => {
            this.addBox();
            this._refreshDeleteButtons();
        });
        this._panel.appendChild(btnAdd);

        const hr = document.createElement('hr');
        hr.style.cssText = 'border-color:#333; margin:2px 0';
        this._panel.appendChild(hr);

        this._listEl = document.createElement('div');
        this._listEl.style.cssText = 'display:flex; flex-direction:column; gap:4px; max-height:200px; overflow-y:auto;';
        this._panel.appendChild(this._listEl);
        this._refreshDeleteButtons();

        document.body.appendChild(this._panel);
    }

    _refreshDeleteButtons() {
        this._listEl.innerHTML = '';
        if (this._boxes.size === 0) {
            const empty = document.createElement('div');
            empty.style.cssText = 'color:#555; font-size:11px; padding:2px 0';
            empty.textContent = 'Chưa có box nào';
            this._listEl.appendChild(empty);
            return;
        }

        for (const [id, { cfg }] of this._boxes) {
            const row = document.createElement('div');
            row.style.cssText = 'display:flex; justify-content:space-between; align-items:center; gap:6px';

            const label = document.createElement('span');
            label.style.cssText = 'color:#888; font-size:10px; flex:1; overflow:hidden; text-overflow:ellipsis; white-space:nowrap';
            label.textContent = id.replace('srbox_', '#');
            label.title = `${cfg.w}×${cfg.h}×${cfg.d}`;

            const btnDel = this._makeBtn('✕', '#4a1a1a', () => this.removeBox(id));
            btnDel.style.padding  = '2px 7px';
            btnDel.style.fontSize = '11px';

            row.appendChild(label);
            row.appendChild(btnDel);
            this._listEl.appendChild(row);
        }
    }

    _makeBtn(text, bg, onClick) {
        const btn = document.createElement('button');
        btn.textContent = text;
        btn.style.cssText = `
            background: ${bg}; color: #fff; border: 1px solid #444;
            border-radius: 4px; padding: 5px 8px; cursor: pointer;
            font-family: monospace; font-size: 11px; text-align: left;
            width: 100%; box-sizing: border-box;
        `;
        btn.onclick = onClick;
        return btn;
    }

    _showToast(msg) {
        let el = document.getElementById('sr-toast');
        if (!el) {
            el = document.createElement('div');
            el.id = 'sr-toast';
            el.style.cssText = `
                position:fixed; bottom:60px; left:50%; transform:translateX(-50%);
                background:rgba(0,0,0,0.85); color:#fff; padding:8px 20px;
                border-radius:20px; font-family:monospace; font-size:13px;
                pointer-events:none; z-index:99999; transition:opacity 0.3s;
            `;
            document.body.appendChild(el);
        }
        el.textContent = msg;
        el.style.opacity = '1';
        clearTimeout(el._t);
        el._t = setTimeout(() => { el.style.opacity = '0'; }, 2000);
    }
}
