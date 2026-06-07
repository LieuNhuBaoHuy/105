// ShootingRange.js
import * as THREE from 'three';

// ─── Key lưu danh sách box trong localStorage ────────────────────────────────
//     Transform của từng box do AffineEditor tự lưu vào 'affine_saves'
const LIST_KEY = 'sr_boxes';

// ─── Kích thước mặc định khi spawn box mới ───────────────────────────────────
const DEFAULT_W = 1.2;
const DEFAULT_H = 2.0;
const DEFAULT_D = 1.2;

// ─── Màu sắc vật cản ─────────────────────────────────────────────────────────
const BOX_COLOR    = 0x7a8fa6;
const BOX_ROUGHNESS = 0.85;

// ═══════════════════════════════════════════════════════════════════════════════
//  SHOOTING RANGE
// ═══════════════════════════════════════════════════════════════════════════════
export class ShootingRange {
    /**
     * @param {THREE.Scene}  scene
     * @param {object}       affineEditor  - instance AffineEditor (có loadAll())
     * @param {THREE.Camera} camera        - dùng để spawn box trước mặt
     * @param {Array}        platforms     - mảng platforms của Collision (thêm vào để va chạm)
     */
    constructor(scene, affineEditor, camera, platforms) {
        this._scene        = scene;
        this._affine       = affineEditor;
        this._camera       = camera;
        this._platforms    = platforms;

        // { id → { mesh, cfg } }
        this._boxes = new Map();

        this._loadFromStorage();
        this._buildUI();
    }

    // ═══════════════════════════════════════════════════════════════════════════
    //  PUBLIC
    // ═══════════════════════════════════════════════════════════════════════════

    /** Thêm box mới tại vị trí 2m trước camera, ngang tầm mắt → mặt sàn */
    addBox(w = DEFAULT_W, h = DEFAULT_H, d = DEFAULT_D) {
        const id  = 'srbox_' + Date.now();
        const cfg = { id, w, h, d };

        // Spawn ngay trước camera, đặt đáy lên mặt sàn (y = 0)
        const spawnPos = new THREE.Vector3();
        this._camera.getWorldPosition(spawnPos);
        const fwd = new THREE.Vector3();
        this._camera.getWorldDirection(fwd);
        fwd.y = 0;
        fwd.normalize();
        spawnPos.addScaledVector(fwd, 3);
        spawnPos.y = h / 2;   // đáy box nằm tại y = 0

        const mesh = this._createMesh(cfg, spawnPos);

        // Lưu danh sách → AffineEditor sẽ pick up transform sau
        this._saveList();

        // Đăng ký với AffineEditor (loadAll với 1 object, không có saved data → dùng vị trí hiện tại)
        this._affine.loadAll([mesh]);

        return mesh;
    }

    /** Xóa box theo id — gỡ khỏi scene, collision, AffineEditor, localStorage */
    removeBox(id) {
        const entry = this._boxes.get(id);
        if (!entry) return;

        // Gỡ khỏi scene
        this._scene.remove(entry.mesh);

        // Gỡ khỏi platforms
        const idx = this._platforms.indexOf(entry.mesh);
        if (idx !== -1) this._platforms.splice(idx, 1);

        // Gỡ khỏi affine_saves
        try {
            const saves = JSON.parse(localStorage.getItem('affine_saves') || '{}');
            delete saves[id];
            localStorage.setItem('affine_saves', JSON.stringify(saves));
        } catch (_) {}

        this._boxes.delete(id);
        this._saveList();
        this._refreshDeleteButtons();
    }

    /** Trả về mảng tất cả mesh (dùng để truyền vào affineEditor.loadAll nếu cần) */
    get meshes() {
        return [...this._boxes.values()].map(e => e.mesh);
    }

    // ═══════════════════════════════════════════════════════════════════════════
    //  PRIVATE — khởi tạo
    // ═══════════════════════════════════════════════════════════════════════════

    _loadFromStorage() {
        let list = [];
        try {
            list = JSON.parse(localStorage.getItem(LIST_KEY) || '[]');
        } catch (_) {}

        list.forEach(cfg => {
            const mesh = this._createMesh(cfg);
            // loadAll → AffineEditor tự apply transform đã lưu từ 'affine_saves'
            this._affine.loadAll([mesh]);
        });
    }

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

        // ── Metadata cho AffineEditor ────────────────────────────────────
        mesh.userData.isTransformable = true;
        mesh.userData.saveId          = cfg.id;
        mesh.name                     = cfg.id;

        if (initialPos) mesh.position.copy(initialPos);

        this._scene.add(mesh);
        this._platforms.push(mesh);   // va chạm với player
        this._boxes.set(cfg.id, { mesh, cfg });

        return mesh;
    }

    // ═══════════════════════════════════════════════════════════════════════════
    //  PRIVATE — lưu
    // ═══════════════════════════════════════════════════════════════════════════

    _saveList() {
        const list = [...this._boxes.values()].map(e => e.cfg);
        localStorage.setItem(LIST_KEY, JSON.stringify(list));
    }

    // ═══════════════════════════════════════════════════════════════════════════
    //  PRIVATE — UI
    // ═══════════════════════════════════════════════════════════════════════════

    _buildUI() {
        // ── Panel chính ──────────────────────────────────────────────────────
        this._panel = document.createElement('div');
        this._panel.style.cssText = `
            position: fixed; bottom: 12px; right: 12px; z-index: 9998;
            background: rgba(10,10,15,0.92); color: #ddd;
            border: 1px solid #333; border-radius: 8px;
            padding: 10px 12px; font-family: monospace; font-size: 12px;
            display: none; flex-direction: column; gap: 6px; min-width: 180px;
            box-shadow: 0 4px 20px rgba(0,0,0,0.6);
        `;

        // ── Tiêu đề ──────────────────────────────────────────────────────────
        const title = document.createElement('b');
        title.style.color = '#fff';
        title.textContent = '🎯 SHOOTING RANGE';
        this._panel.appendChild(title);

        // ── Nút + Box ────────────────────────────────────────────────────────
        const btnAdd = this._makeBtn('+ Thêm Box', '#1a4a2a', () => {
            this.addBox();
            this._refreshDeleteButtons();
        });
        this._panel.appendChild(btnAdd);

        // ── Divider ──────────────────────────────────────────────────────────
        const hr = document.createElement('hr');
        hr.style.cssText = 'border-color:#333; margin:2px 0';
        this._panel.appendChild(hr);

        // ── Danh sách nút xóa (dynamic) ──────────────────────────────────────
        this._listEl = document.createElement('div');
        this._listEl.style.cssText = 'display:flex; flex-direction:column; gap:4px; max-height:200px; overflow-y:auto;';
        this._panel.appendChild(this._listEl);
        this._refreshDeleteButtons();

        document.body.appendChild(this._panel);

        // ── Toggle hiển thị panel theo mode (chỉ hiện ở Tester) ─────────────
        //    GameScene sẽ gọi shootingRange.setVisible(true/false) khi đổi mode
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
            btnDel.style.padding = '2px 7px';
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

    /** Gọi từ main.js khi đổi mode: true = tester, false = player */
    setVisible(v) {
        this._panel.style.display = v ? 'flex' : 'none';
    }
}