import * as THREE from 'three';
import { TransformControls } from 'three/addons/controls/TransformControls.js';

/**
 * AffineEditor — 2-level transform system
 *
 * Workflow:
 *   1. Click object  → LOCKED (level 1, xanh lá)
 *   2. Click part    → LOCKED (level 2, vàng)
 *   3a. CONFIRM      → lưu level.json qua server, unlock, deselect
 *   3b. HỦY BỎ       → revert về trạng thái trước khi kéo, unlock, deselect
 *   3c. Reset gốc    → revert về vị trí hard-code trong file JS (giữ selected)
 *
 * Khi LOCKED: click ra ngoài bị chặn — phải dùng Confirm hoặc Hủy bỏ.
 *
 * Data lưu: level.json (qua POST /save-level) — key "affine_saves"
 *           Format: { saveId: { p, r, s }, ... }
 *
 * Constructor nhận thêm:
 *   levelData    — object level.json đã được main.js load sẵn
 *   saveFn       — async function(levelData) → ghi level.json qua server
 */
export class AffineEditor {
    /**
     * @param {THREE.Scene}   scene
     * @param {THREE.Camera}  camera
     * @param {HTMLElement}   domElement
     * @param {object}        levelData   — dữ liệu level.json hiện tại (shared với ShootingRange)
     * @param {Function}      saveFn      — async (levelData) => boolean
     */
    constructor(scene, camera, domElement, levelData, saveFn) {
        this.scene      = scene;
        this.camera     = camera;
        this.domElement = domElement;

        // Tham chiếu đến object level.json dùng chung — KHÔNG copy, để ShootingRange
        // thấy được thay đổi khi ghi và ngược lại.
        this._level  = levelData;
        this._saveFn = saveFn;

        this.enabled    = false;
        this.isDragging = false;
        this.isLocked   = false;

        this.raycaster = new THREE.Raycaster();
        this.mouse     = new THREE.Vector2();

        this.selectedGroup = null;
        this.selectedPart  = null;
        this.hoveredGroup  = null;
        this.hoveredPart   = null;

        // ── TransformControls ────────────────────────────────────────────────
        this.controls = new TransformControls(camera, domElement);
        this.controls.addEventListener('dragging-changed', (e) => {
            this.isDragging = e.value;

            if (e.value) {
                const target = this.selectedPart || this.selectedGroup;
                if (target) this._snapshotPreDrag(target);
            } else {
                this._refreshHighlights();
            }
        });
        this.scene.add(this.controls);

        // ── Highlight boxes ──────────────────────────────────────────────────
        this.hlGroup = new THREE.BoxHelper(new THREE.Object3D(), 0x00ff88);
        this.hlGroup.visible = false;
        this.scene.add(this.hlGroup);

        this.hlPart = new THREE.BoxHelper(new THREE.Object3D(), 0xffdd00);
        this.hlPart.visible = false;
        this.scene.add(this.hlPart);

        this.hlHover = new THREE.BoxHelper(new THREE.Object3D(), 0x00ccff);
        this.hlHover.visible = false;
        this.scene.add(this.hlHover);

        this._initUI();
        this._initEvents();
    }

    // ─────────────────────────────────────────────────────────────────────────
    // UI
    // ─────────────────────────────────────────────────────────────────────────
    _initUI() {
        this.ui = document.createElement('div');
        this.ui.id = 'affine-panel';
        this.ui.style.cssText = `
            position:fixed; top:10px; right:10px; z-index:9999;
            background:rgba(10,10,10,0.93); color:#e0e0e0; padding:14px;
            display:none; flex-direction:column; gap:6px;
            font-family:monospace; border-radius:8px; min-width:200px;
            border:1px solid #333; box-shadow:0 4px 24px rgba(0,0,0,0.7);
            user-select:none; transition: border-color 0.2s;
        `;
        this.ui.innerHTML = `
            <b style="font-size:13px;color:#fff">🛠 AFFINE EDITOR</b>
            <div id="aff-breadcrumb" style="font-size:10px;color:#888;min-height:14px"></div>

            <hr style="border-color:#333;margin:2px 0">
            <div style="font-size:10px;color:#aaa;margin-bottom:2px">MODE TRANSFORM</div>
            <div style="display:flex;gap:4px">
                <button id="aff-t" style="${this._bs()}">↔ Move&nbsp;<kbd>T</kbd></button>
                <button id="aff-r" style="${this._bs()}">↻ Rotate&nbsp;<kbd>R</kbd></button>
            </div>
            <button id="aff-s" style="${this._bs()}">⤡ Scale&nbsp;&nbsp;<kbd>Y</kbd></button>

            <hr style="border-color:#333;margin:2px 0">

            <div id="aff-lock-bar" style="
                display:none; align-items:center; gap:6px;
                background:rgba(255,200,0,0.1); border:1px solid #555;
                border-radius:4px; padding:5px 8px; font-size:10px; color:#ffcc00;
            ">
                🔒 <span>Đang chỉnh sửa — Confirm hoặc Hủy để thoát</span>
            </div>

            <button id="aff-confirm" style="${this._bs('#1a6b30')}">✔ CONFIRM &amp; lưu</button>
            <button id="aff-cancel"  style="${this._bs('#7b2a1a')}">✘ HỦY BỎ &amp; hoàn tác</button>
            <button id="aff-reset"   style="${this._bs('#2a2a2a')}; color:#aaa; font-size:10px">
                ↺ Reset về code gốc
            </button>

            <hr style="border-color:#333;margin:2px 0">
            <button id="aff-up" style="${this._bs('#0e2e1a')}">↑ Lên Group &nbsp;<kbd>Esc</kbd></button>

            <hr style="border-color:#333;margin:2px 0">
            <div style="font-size:10px;color:#555;line-height:1.6">
                💾 Lưu thẳng vào <b style="color:#777">level.json</b><br>
                Chuyển zip → máy khác vẫn giữ nguyên
            </div>
            <button id="aff-save-all" style="${this._bs('#1a2a4a')}; font-size:10px">
                💾 Lưu tất cả ngay
            </button>

            <hr style="border-color:#333;margin:2px 0">
            <div style="font-size:10px;color:#555;line-height:1.6">
                <span style="color:#00ff88">■</span> Group &nbsp;
                <span style="color:#ffdd00">■</span> Part &nbsp;
                <span style="color:#00ccff">■</span> Hover
            </div>

            <hr style="border-color:#333;margin:2px 0">
            <div style="font-size:10px;color:#aaa;margin-bottom:3px">THÔNG SỐ HIỆN TẠI</div>
            <div id="aff-params" style="
                font-size:11px; font-family:monospace; line-height:1.8;
                background:rgba(255,255,255,0.04); border-radius:4px;
                padding:6px 8px; color:#ccc;
            ">—</div>

            <div id="aff-status" style="font-size:10px;color:#aaa;min-height:13px"></div>
        `;
        document.body.appendChild(this.ui);

        this.statusEl     = this.ui.querySelector('#aff-status');
        this.paramsEl     = this.ui.querySelector('#aff-params');
        this.breadcrumbEl = this.ui.querySelector('#aff-breadcrumb');
        this.upBtn        = this.ui.querySelector('#aff-up');
        this.lockBar      = this.ui.querySelector('#aff-lock-bar');

        this.ui.querySelector('#aff-t').onclick        = () => this._setMode('translate');
        this.ui.querySelector('#aff-r').onclick        = () => this._setMode('rotate');
        this.ui.querySelector('#aff-s').onclick        = () => this._setMode('scale');
        this.ui.querySelector('#aff-confirm').onclick  = () => this.confirm();
        this.ui.querySelector('#aff-cancel').onclick   = () => this.cancelEdit();
        this.ui.querySelector('#aff-reset').onclick    = () => this.resetToDefault();
        this.ui.querySelector('#aff-up').onclick       = () => this._goUpToGroup();
        this.ui.querySelector('#aff-save-all').onclick = () => this._saveAll();
    }

    _bs(bg = '#2a2a2a') {
        return `background:${bg};color:#fff;border:1px solid #444;border-radius:4px;
                padding:5px 8px;cursor:pointer;font-family:monospace;font-size:11px;
                text-align:left;width:100%;box-sizing:border-box`;
    }

    _setMode(mode) { this.controls.setMode(mode); this._status(`Mode: ${mode}`); }

    _updateParams() {
        if (!this.paramsEl) return;
        const target = this.selectedPart || this.selectedGroup;
        if (!target) { this.paramsEl.textContent = '—'; return; }

        const p = target.position;
        const r = target.rotation;
        const s = target.scale;
        const deg = (rad) => (rad * 180 / Math.PI).toFixed(1) + '°';
        const n   = (v)   => v.toFixed(3);

        this.paramsEl.innerHTML =
            `<span style="color:#888">P</span>  ` +
            `<span style="color:#f88">X</span>${n(p.x)} ` +
            `<span style="color:#8f8">Y</span>${n(p.y)} ` +
            `<span style="color:#88f">Z</span>${n(p.z)}<br>` +

            `<span style="color:#888">R</span>  ` +
            `<span style="color:#f88">X</span>${deg(r.x)} ` +
            `<span style="color:#8f8">Y</span>${deg(r.y)} ` +
            `<span style="color:#88f">Z</span>${deg(r.z)}<br>` +

            `<span style="color:#888">S</span>  ` +
            `<span style="color:#f88">X</span>${n(s.x)} ` +
            `<span style="color:#8f8">Y</span>${n(s.y)} ` +
            `<span style="color:#88f">Z</span>${n(s.z)}`;
    }

    _status(msg)   { if (this.statusEl)     this.statusEl.textContent     = msg; }
    _crumb(msg)    { if (this.breadcrumbEl) this.breadcrumbEl.textContent = msg; }

    _setLocked(locked) {
        this.isLocked = locked;
        this.lockBar.style.display   = locked ? 'flex'    : 'none';
        this.ui.style.borderColor    = locked ? '#ffcc00' : '#333';
    }

    // ─────────────────────────────────────────────────────────────────────────
    // Snapshots
    // ─────────────────────────────────────────────────────────────────────────
    _snapshotPreDrag(obj) {
        obj.userData.preDragTransform = {
            p: obj.position.toArray(),
            r: [obj.rotation.x, obj.rotation.y, obj.rotation.z, obj.rotation.order],
            s: obj.scale.toArray()
        };
    }

    _snapshotPreEdit(obj) {
        obj.userData.preEditTransform = {
            p: obj.position.toArray(),
            r: [obj.rotation.x, obj.rotation.y, obj.rotation.z, obj.rotation.order],
            s: obj.scale.toArray()
        };
        this._snapshotPreDrag(obj);
    }

    _applySnapshot(obj, key) {
        const snap = obj.userData[key];
        if (!snap) return;
        obj.position.fromArray(snap.p);
        obj.rotation.set(snap.r[0], snap.r[1], snap.r[2], snap.r[3]);
        obj.scale.fromArray(snap.s);
    }

    // ─────────────────────────────────────────────────────────────────────────
    // Events
    // ─────────────────────────────────────────────────────────────────────────
    _initEvents() {
        window.addEventListener('mousemove', (e) => {
            if (!this.enabled) return;
            this.mouse.x =  (e.clientX / window.innerWidth)  * 2 - 1;
            this.mouse.y = -(e.clientY / window.innerHeight) * 2 + 1;
        });

        window.addEventListener('mousedown', (e) => {
            if (e.button !== 0 || !this.enabled || this.isDragging) return;

            if (this.isLocked) {
                if (this.hoveredPart && this.selectedGroup) {
                    this._selectPart(this.hoveredPart);
                }
                return;
            }

            if (this.hoveredPart && this.selectedGroup) {
                this._selectPart(this.hoveredPart);
            } else if (this.hoveredGroup) {
                if (this.hoveredGroup !== this.selectedGroup || this.selectedPart) {
                    this._selectGroup(this.hoveredGroup);
                }
            } else {
                this._deselect();
            }
        });

        window.addEventListener('keydown', (e) => {
            if (!this.enabled) return;
            if (e.code === 'KeyT') this._setMode('translate');
            if (e.code === 'KeyR') this._setMode('rotate');
            if (e.code === 'KeyY') this._setMode('scale');
            if (e.code === 'Escape') {
                if (this.selectedPart)       this._goUpToGroup();
                else if (this.selectedGroup) this.cancelEdit();
            }
        });
    }

    // ─────────────────────────────────────────────────────────────────────────
    // Selection
    // ─────────────────────────────────────────────────────────────────────────
    _selectGroup(group) {
        this._snapshotPreEdit(group);
        this.selectedGroup = group;
        this.selectedPart  = null;
        this.controls.attach(group);
        this._refreshHighlights();
        this._setLocked(true);
        this._crumb(`▶ ${group.userData.saveId || '?'}`);
        this._status('Kéo để di chuyển — Confirm hoặc Hủy để xong');
        this.upBtn.style.display = 'none';
    }

    _selectPart(part) {
        this._snapshotPreEdit(part);
        this.selectedPart = part;
        this.controls.attach(part);
        this._refreshHighlights();
        this._setLocked(true);
        const g = this.selectedGroup?.userData.saveId || '?';
        const p = part.name || part.userData.saveId || '?';
        this._crumb(`▶ ${g} › ${p}`);
        this._status(`Đang chỉnh: ${p}`);
        this.upBtn.style.display = 'block';
    }

    _goUpToGroup() {
        if (!this.selectedGroup) return;
        this._snapshotPreEdit(this.selectedGroup);
        this.selectedPart = null;
        this.controls.attach(this.selectedGroup);
        this._refreshHighlights();
        const id = this.selectedGroup.userData.saveId || '?';
        this._crumb(`▶ ${id}`);
        this._status('Click bộ phận để tinh chỉnh');
        this.upBtn.style.display = 'none';
    }

    _deselect() {
        this.controls.detach();
        this.selectedGroup = null;
        this.selectedPart  = null;
        this.hlGroup.visible = false;
        this.hlPart.visible  = false;
        this._setLocked(false);
        this._crumb('');
        this._status('Click vào object để chọn');
        this.upBtn.style.display = 'none';
    }

    _refreshHighlights() {
        if (this.selectedGroup) {
            this.hlGroup.setFromObject(this.selectedGroup);
            this.hlGroup.visible = true;
        } else {
            this.hlGroup.visible = false;
        }
        if (this.selectedPart) {
            this.hlPart.setFromObject(this.selectedPart);
            this.hlPart.visible = true;
        } else {
            this.hlPart.visible = false;
        }
    }

    // ─────────────────────────────────────────────────────────────────────────
    // Level data helpers
    // ─────────────────────────────────────────────────────────────────────────

    /** Đọc affine_saves từ levelData (phần của AffineEditor) */
    _getAffineSaves() {
        if (!this._level.affine_saves) this._level.affine_saves = {};
        return this._level.affine_saves;
    }

    /**
     * Ghi toàn bộ levelData (bao gồm affine_saves đã sửa) vào level.json.
     * Hiển thị toast kết quả.
     */
    async _persistLevel(toastSuccess, toastFail) {
        const ok = await this._saveFn(this._level);
        if (ok) {
            this._showToast(toastSuccess || '✔ Đã lưu level.json');
        } else {
            this._showToast(toastFail   || '❌ Lưu thất bại! (server chạy chưa?)');
        }
        return ok;
    }

    // ─────────────────────────────────────────────────────────────────────────
    // Public actions
    // ─────────────────────────────────────────────────────────────────────────

    /**
     * CONFIRM — lưu transform hiện tại vào level.json (qua server), unlock, deselect.
     * Lần sau mở lại (bất kỳ máy nào) sẽ load đúng vị trí này.
     */
    confirm() {
        const target = this.selectedPart || this.selectedGroup;
        if (!target) { this._status('⚠ Chưa chọn object!'); return; }

        const id = target.userData.saveId;
        if (!id) { this._status('⚠ Object thiếu saveId'); return; }

        const saves = this._getAffineSaves();
        saves[id] = {
            p: target.position.toArray(),
            r: [target.rotation.x, target.rotation.y, target.rotation.z, target.rotation.order],
            s: target.scale.toArray()
        };

        console.log('[AffineEditor] confirmed & saving:', id, saves[id]);
        this._deselect();
        this._persistLevel(`✔ Đã lưu "${id}"`, `❌ Lưu "${id}" thất bại!`);
    }

    /**
     * HỦY BỎ — hoàn tác về trạng thái trước khi kéo lần cuối, unlock, deselect.
     */
    cancelEdit() {
        const target = this.selectedPart || this.selectedGroup;
        if (target) {
            const snap = target.userData.preDragTransform || target.userData.preEditTransform;
            if (snap) {
                target.position.fromArray(snap.p);
                target.rotation.set(snap.r[0], snap.r[1], snap.r[2], snap.r[3]);
                target.scale.fromArray(snap.s);
            }
        }
        this._deselect();
        this._status('Đã hủy bỏ thay đổi');
    }

    /**
     * RESET VỀ GỐC — revert về vị trí hard-code trong file JS.
     * Xoá luôn entry trong level.json.
     */
    resetToDefault() {
        const target = this.selectedPart || this.selectedGroup;
        if (!target) { this._status('⚠ Chưa chọn object!'); return; }

        const id  = target.userData.saveId;
        const def = target.userData.defaultTransform;
        if (!def) { this._status('⚠ Không có snapshot gốc'); return; }

        // Xoá khỏi levelData
        if (id) {
            const saves = this._getAffineSaves();
            delete saves[id];
        }

        // Áp dụng transform gốc
        target.position.fromArray(def.p);
        target.rotation.set(def.r[0], def.r[1], def.r[2], def.r[3]);
        target.scale.fromArray(def.s);

        this._snapshotPreEdit(target);
        this._refreshHighlights();
        this._status(`↺ Đã reset "${id || '?'}" về code gốc`);

        this._persistLevel(`↺ Reset "${id}" + lưu OK`, `❌ Lưu thất bại!`);
    }

    /**
     * LƯU TẤT CẢ — ghi toàn bộ levelData hiện tại vào file ngay lập tức.
     * Dùng khi muốn đảm bảo file đã up-to-date trước khi zip gửi đi.
     */
    async _saveAll() {
        this._status('Đang lưu...');
        const ok = await this._saveFn(this._level);
        if (ok) {
            this._showToast('💾 Đã lưu toàn bộ level.json!');
            this._status('Lưu thành công');
        } else {
            this._showToast('❌ Lưu thất bại! Server có đang chạy không?');
            this._status('Lưu thất bại');
        }
    }

    toggle(state) {
        this.enabled = state;
        this.ui.style.display = state ? 'flex' : 'none';
        if (!state) {
            if (this.isLocked) this.cancelEdit();
            this.hlHover.visible = false;
            this.domElement.style.cursor = 'default';
        } else {
            this._status('Click vào object để chọn');
            this.upBtn.style.display = 'none';
        }
    }

    /**
     * Tải transform đã lưu từ level.json (affine_saves), áp dụng cho danh sách objects.
     * Gọi một lần sau khi scene dựng xong (trong main.js).
     */
    loadAll(objects) {
        const saves  = this._getAffineSaves();
        const visited = new Set();

        const applyTransform = (obj) => {
            if (visited.has(obj)) return;
            visited.add(obj);

            const id = obj.userData.saveId;
            if (!id) return;

            // Chụp default (hard-coded) trước khi apply saved data
            obj.userData.defaultTransform = {
                p: obj.position.toArray(),
                r: [obj.rotation.x, obj.rotation.y, obj.rotation.z, obj.rotation.order],
                s: obj.scale.toArray()
            };

            if (saves[id]) {
                const c = saves[id];
                obj.position.fromArray(c.p);
                obj.rotation.set(c.r[0], c.r[1], c.r[2], c.r[3]);
                obj.scale.fromArray(c.s);
                console.log('[AffineEditor] loaded from level.json:', id);
            }
        };

        objects.forEach(root => {
            root.traverse(obj => applyTransform(obj));
        });
    }

    // ─────────────────────────────────────────────────────────────────────────
    // Update loop
    // ─────────────────────────────────────────────────────────────────────────
    update() {
        if (this.enabled) this._updateParams();
        if (!this.enabled || this.isDragging) return;

        this.raycaster.setFromCamera(this.mouse, this.camera);
        const hits = this.raycaster.intersectObjects(this.scene.children, true);

        this.hoveredGroup = null;
        this.hoveredPart  = null;

        for (const hit of hits) {
            if (this.selectedGroup && !this.hoveredPart) {
                let anc = hit.object;
                while (anc && anc !== this.scene) {
                    if (anc.userData.isPart) {
                        let isInsideSelected = false;
                        let temp = anc;
                        while (temp) {
                            if (temp === this.selectedGroup) { isInsideSelected = true; break; }
                            temp = temp.parent;
                        }
                        if (isInsideSelected) {
                            this.hoveredPart = anc;
                            break;
                        }
                    }
                    anc = anc.parent;
                }
            }

            if (!this.hoveredGroup) {
                let obj = hit.object;
                while (obj && obj.parent) {
                    if (obj.userData.isTransformable) { this.hoveredGroup = obj; break; }
                    obj = obj.parent;
                }
            }

            if (this.hoveredPart && this.hoveredGroup) break;
        }

        const hoverTarget = this.hoveredPart ?? this.hoveredGroup;
        if (hoverTarget && hoverTarget !== this.selectedGroup && hoverTarget !== this.selectedPart) {
            this.hlHover.setFromObject(hoverTarget);
            this.hlHover.visible = true;
        } else {
            this.hlHover.visible = false;
        }

        const canInteract = hoverTarget && (!this.isLocked || this.hoveredPart);
        this.domElement.style.cursor = canInteract ? 'pointer' : 'default';

        this._refreshHighlights();
    }

    // ─────────────────────────────────────────────────────────────────────────
    // Toast helper
    // ─────────────────────────────────────────────────────────────────────────
    _showToast(msg) {
        let el = document.getElementById('ae-toast');
        if (!el) {
            el = document.createElement('div');
            el.id = 'ae-toast';
            el.style.cssText = `
                position:fixed; bottom:24px; left:50%; transform:translateX(-50%);
                background:rgba(0,0,0,0.85); color:#fff; padding:8px 20px;
                border-radius:20px; font-family:monospace; font-size:13px;
                pointer-events:none; z-index:99999; transition:opacity 0.3s;
            `;
            document.body.appendChild(el);
        }
        el.textContent = msg;
        el.style.opacity = '1';
        clearTimeout(el._t);
        el._t = setTimeout(() => { el.style.opacity = '0'; }, 2500);
    }
}
