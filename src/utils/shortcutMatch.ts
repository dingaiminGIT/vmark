export type ShortcutPlatform = "mac" | "other";

const KEY_ALIASES: Record<string, string> = {
  up: "arrowup",
  down: "arrowdown",
  left: "arrowleft",
  right: "arrowright",
  esc: "escape",
  escape: "escape",
  return: "enter",
};

export function isMacPlatform(): boolean {
  if (typeof navigator === "undefined") return false;
  return /Mac|iPod|iPhone|iPad/.test(navigator.platform);
}

function normalizeKeyToken(token: string): string {
  const normalized = token.trim().toLowerCase();
  return KEY_ALIASES[normalized] ?? normalized;
}

function normalizeEventKey(key: string): string {
  return normalizeKeyToken(key);
}

function matchesShiftedSymbol(event: KeyboardEvent, token: string): boolean {
  if (!event.shiftKey) return false;
  const normalized = normalizeKeyToken(token);
  if (normalized === "/" && event.key === "?") return true;
  if (normalized === "=" && event.key === "+") return true;
  if (normalized === "-" && event.key === "_") return true;
  if (normalized === "." && event.key === ">") return true;
  return false;
}

export function matchesShortcutEvent(
  event: KeyboardEvent,
  shortcut: string,
  platform: ShortcutPlatform = isMacPlatform() ? "mac" : "other"
): boolean {
  if (!shortcut) return false;

  const parts = shortcut.split("-").filter(Boolean);
  if (parts.length === 0) return false;

  const keyToken = parts[parts.length - 1];
  const modifiers = new Set(parts.slice(0, -1).map((part) => part.toLowerCase()));

  const wantsMod = modifiers.has("mod");
  const wantsCtrl = modifiers.has("ctrl");
  const wantsAlt = modifiers.has("alt");
  const wantsShift = modifiers.has("shift");

  const modPressed = platform === "mac" ? event.metaKey : event.ctrlKey;

  if (wantsMod) {
    if (!modPressed) return false;
  } else if (platform === "mac" && modPressed) {
    return false;
  }

  if (platform === "mac") {
    if (wantsCtrl !== event.ctrlKey) return false;
  } else {
    const ctrlRequired = wantsCtrl || wantsMod;
    if (ctrlRequired !== event.ctrlKey) return false;
  }
  if (wantsAlt !== event.altKey) return false;
  if (wantsShift !== event.shiftKey) return false;

  const targetKey = normalizeKeyToken(keyToken);
  if (matchesShiftedSymbol(event, keyToken)) return true;

  const eventKey = normalizeEventKey(event.key);
  return eventKey === targetKey;
}
