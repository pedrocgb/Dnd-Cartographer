const TEXT_INPUT_TYPES = new Set(["text", "search", "number", "email", "url", "password", "tel"]);

/** Keyboard shortcuts leave text editing alone (it has its own undo); sliders and checkboxes don't count. */
export function isTypingTarget(target: EventTarget | null): boolean {
  const el = target as HTMLElement | null;
  if (!el?.tagName) return false;
  if (el.isContentEditable || el.tagName === "TEXTAREA" || el.tagName === "SELECT") return true;
  return el.tagName === "INPUT" && TEXT_INPUT_TYPES.has((el as HTMLInputElement).type);
}
