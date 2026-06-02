// PlayerHUD.js
export class PlayerHUD {
    constructor() {
        this._container = document.createElement('div');
        this._container.style.cssText = `
            position: fixed; top: 18px; left: 50%; transform: translateX(-50%);
            display: none; gap: 18px; z-index: 9999; pointer-events: none;
            align-items: flex-start;
        `;
        document.body.appendChild(this._container);

        // 3 circles: Đèn — NVG — Mode NVG
        this._fl  = this._makeCircle('J',        '🔦', 'ĐÈN',  '#ffdd44');
        this._nvg = this._makeCircle('N',        '👁', 'NVG',  '#77ff66');
        this._mode= this._makeCircle('+1 +2 +3', '◉', '—',    '#77ff66');

        [this._fl, this._nvg, this._mode].forEach(c =>
            this._container.appendChild(c.el)
        );

        // Khởi tạo mặc định: tất cả tắt
        this._setActive(this._fl,   false, 'TẮT',  '#ffdd44');
        this._setActive(this._nvg,  false, 'TẮT',  '#77ff66');
        this._setActive(this._mode, false, '—',    '#77ff66');

        this._crosshair = this._makeCrosshair();
    }

    // ── Public ────────────────────────────────────────────────────────────
    show() {
        this._container.style.display = 'flex';
        this._crosshair.style.display = 'block';
    }
    hide() {
        this._container.style.display = 'none';
        this._crosshair.style.display = 'none';
    }

    updateFlashlight(isOn) {
        this._setActive(this._fl, isOn, isOn ? 'BẬT' : 'TẮT', '#ffdd44');
    }

    /** mode: 0=OFF 1=SOLID 2=LINES 3=POINTS */
    updateNVG(mode) {
        const isOn = mode !== 0;
        const modeLabel = ['—', 'SOLID', 'LINES', 'POINTS'][mode] ?? '—';
        this._setActive(this._nvg,  isOn, isOn ? 'BẬT' : 'TẮT', '#77ff66');
        this._setActive(this._mode, isOn, modeLabel,              '#77ff66');
    }

    // ── Private ───────────────────────────────────────────────────────────
    _makeCircle(keybind, icon, label, activeColor) {
        const el = document.createElement('div');
        el.style.cssText = 'display:flex;flex-direction:column;align-items:center;gap:5px;';

        // Keybind — nhỏ, trên vòng tròn
        const kbd = document.createElement('div');
        kbd.textContent = keybind;
        kbd.style.cssText = `
            font-family:monospace; font-size:9px; letter-spacing:0.5px;
            color:rgba(255,255,255,0.35);
        `;

        // Vòng tròn
        const circle = document.createElement('div');
        circle.style.cssText = `
            width:48px; height:48px; border-radius:50%;
            border:2px solid rgba(255,255,255,0.18);
            display:flex; align-items:center; justify-content:center;
            font-size:20px; opacity:0.3;
            transition: border-color 0.25s, opacity 0.25s, box-shadow 0.25s;
        `;
        circle.textContent = icon;

        // Nhãn trạng thái — dưới vòng tròn
        const status = document.createElement('div');
        status.textContent = label;
        status.style.cssText = `
            font-family:monospace; font-size:10px; letter-spacing:1.5px;
            color:rgba(255,255,255,0.25);
            transition: color 0.25s;
        `;

        el.append(kbd, circle, status);
        return { el, circle, status, activeColor };
    }

    _setActive(indicator, active, label, color) {
        indicator.circle.style.borderColor  = active ? color          : 'rgba(255,255,255,0.18)';
        indicator.circle.style.opacity      = active ? '1'            : '0.3';
        indicator.circle.style.boxShadow    = active ? `0 0 8px ${color}55` : 'none';
        indicator.status.textContent        = label;
        indicator.status.style.color        = active ? color          : 'rgba(255,255,255,0.25)';
    }

    _makeCrosshair() {
        const el = document.createElement('div');
        el.style.cssText = `
            position: fixed; top: 50%; left: 50%;
            transform: translate(-50%, -50%);
            width: 20px; height: 20px;
            pointer-events: none; z-index: 9999;
            display: none;
        `;

        const hLine = document.createElement('div');
        hLine.style.cssText = `
            position: absolute; top: 50%; left: 0;
            width: 100%; height: 2px;
            background: #00ff88; transform: translateY(-50%);
            box-shadow: 0 0 4px #00ff8888;
        `;

        const vLine = document.createElement('div');
        vLine.style.cssText = `
            position: absolute; left: 50%; top: 0;
            width: 2px; height: 100%;
            background: #00ff88; transform: translateX(-50%);
            box-shadow: 0 0 4px #00ff8888;
        `;

        // Chấm giữa
        const dot = document.createElement('div');
        dot.style.cssText = `
            position: absolute; top: 50%; left: 50%;
            width: 3px; height: 3px; border-radius: 50%;
            background: #00ff88; transform: translate(-50%, -50%);
        `;

        el.append(hLine, vLine, dot);
        document.body.appendChild(el);
        return el;
    }
}