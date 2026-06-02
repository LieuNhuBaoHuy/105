// TesterUI.js
// Quản lý 2 nút chuyển mode — tách ra khỏi main.js cho gọn
export class TesterUI {
    /**
     * @param {Function} onTester  - callback khi bấm nút Tester
     * @param {Function} onPlayer  - callback khi bấm nút Player
     */
    constructor(onTester, onPlayer) {
        this._container = document.createElement('div');
        this._container.style.cssText = `
            position:fixed; top:10px; left:10px; z-index:99999;
            display:flex; gap:10px;
        `;
        document.body.appendChild(this._container);

        this._btnTester = this._makeBtn('🛠 Mode: TESTER', onTester);
        this._btnPlayer = this._makeBtn('🎮 Mode: PLAYER', onPlayer);
    }

    /** Cập nhật highlight nút active */
    setMode(mode) {
        const isTester = mode === 'tester';
        this._highlight(this._btnTester, isTester);
        this._highlight(this._btnPlayer, !isTester);
    }

    // ── Private ───────────────────────────────────────────────────────────
    _makeBtn(text, onClick) {
        const btn = document.createElement('button');
        btn.textContent = text;
        btn.style.cssText = `
            background:rgba(20,20,20,0.85); color:#fff;
            border:1px solid #555; border-radius:6px;
            padding:7px 14px; font-family:monospace; font-size:13px;
            cursor:pointer; transition:border-color 0.2s, color 0.2s;
        `;
        btn.onclick = onClick;
        this._container.appendChild(btn);
        return btn;
    }

    _highlight(btn, active) {
        btn.style.borderColor = active ? '#00ff88' : '#555';
        btn.style.color       = active ? '#00ff88' : '#fff';
    }
}