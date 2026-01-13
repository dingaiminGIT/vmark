import { describe, it, expect } from "vitest";
import { installToolbarNavigation } from "./tiptapToolbarNavigation";

function dispatchKey(key: string) {
  const event = new KeyboardEvent("keydown", { key, bubbles: true });
  document.dispatchEvent(event);
}

describe("installToolbarNavigation", () => {
  it("triggers shortcut buttons when toolbar is open", () => {
    const container = document.createElement("div");
    const button = document.createElement("button");
    button.dataset.shortcutKey = "b";
    let clicked = false;
    button.addEventListener("click", () => {
      clicked = true;
    });
    container.appendChild(button);
    document.body.appendChild(container);

    const cleanup = installToolbarNavigation({
      container,
      isOpen: () => true,
      onClose: () => {},
    });

    dispatchKey("b");

    expect(clicked).toBe(true);

    cleanup();
    container.remove();
  });
});
