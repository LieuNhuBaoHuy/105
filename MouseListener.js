export class MouseListener {
    constructor(buttonIndex) {
        this.buttonIndex = buttonIndex; // 0: LMB, 1: MMB, 2: RMB
        this.isPressed = false;

        window.addEventListener('mousedown', (event) => {
            if (event.button === this.buttonIndex) {
                this.isPressed = true;
            }
        });

        window.addEventListener('mouseup', (event) => {
            if (event.button === this.buttonIndex) {
                this.isPressed = false;
            }
        });

        // Ngăn menu ngữ cảnh khi nhấn chuột phải (RMB) để xoay camera mượt hơn
        if (buttonIndex === 2) {
            window.addEventListener('contextmenu', (e) => e.preventDefault());
        }
    }

    down() {
        return this.isPressed;
    }
}