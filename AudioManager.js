// AudioManager.js
export class AudioManager {
    constructor() {
        this._unlocked = false;
        this._sounds = new Map();

        window.addEventListener('pointerdown', () => this.unlock(), { once: true });
        window.addEventListener('keydown', () => this.unlock(), { once: true });
    }

    registerOneShot(name, url, maxVoices = 4, volume = 1) {
        const voices = Array.from({ length: maxVoices }, () => {
            const a = new Audio(url);
            a.preload = 'auto';
            a.volume = volume;
            return a;
        });

        this._sounds.set(name, {
            type: 'one-shot',
            voices,
            next: 0,
        });
    }

    registerRestarting(name, url, volume = 1) {
        const voice = new Audio(url);
        voice.preload = 'auto';
        voice.volume = volume;

        this._sounds.set(name, {
            type: 'restart',
            voice,
            lastPlayTime: 0 // Thêm dòng này để lưu mốc thời gian (mili-giây)
        });
    }

    play(name) {
        const s = this._sounds.get(name);
        if (!s || !this._unlocked) return;

        if (s.type === 'restart') {
            const now = Date.now(); // Lấy thời gian hiện tại (mili-giây)

            // CHÍNH LÀ ĐÂY: Nếu âm thanh này phát chưa đủ 400ms, 
            // KHÔNG ĐƯỢC NGẮT NÓ. Bỏ qua lệnh click này để âm thanh tiếp tục chạy.
            if (now - s.lastPlayTime < 80) {
                return; 
            }

            // Nếu đã ăn trọn 400ms "rộng lượng" rồi (hoặc mới click phát đầu tiên):
            // Tiến hành ngắt âm thanh cũ VÀ lập tức phát lại từ đầu như bạn muốn.
            s.voice.pause();
            s.voice.currentTime = 0;
            s.voice.play().catch(() => {});
            
            // Cập nhật lại mốc thời gian vừa ngắt-phát lại
            s.lastPlayTime = now; 
            return;
        }

        // ... (Giữ nguyên phần code xử lý một-shot ở dưới của bạn)
        const voice = s.voices[s.next];
        s.next = (s.next + 1) % s.voices.length;
        if (!voice.paused && !voice.ended) return; 
        voice.currentTime = 0;
        voice.play().catch(() => {});
    }

    unlock() {
        this._unlocked = true;
    }
}