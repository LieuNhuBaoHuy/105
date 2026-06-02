export class KeyListener {
    constructor(keyCode) {
        this.keyCode = keyCode;
        this.isPressed = false;

        window.addEventListener('keydown', (event) => {
            if (event.code === this.keyCode) {
                this.isPressed = true;
            }
        });

        window.addEventListener('keyup', (event) => {
            if (event.code === this.keyCode) {
                this.isPressed = false;
            }
        });
    }

    // Phương thức kiểm tra trạng thái nhanh
    down() {
        return this.isPressed;
    }
}