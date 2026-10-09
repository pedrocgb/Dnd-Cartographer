import { describe, expect, it } from "vitest";
import { textDocument } from "../src/server/documents/from-text";
import { deriveText, validateDocument } from "../src/server/documents/schema";

describe("note text as an article body", () => {
  it("makes one valid paragraph per line, blank lines included", () => {
    const doc = textDocument("Who poisoned the king?\n\nThe cook knows.");
    expect(() => validateDocument(doc)).not.toThrow();
    expect(doc.content).toHaveLength(3);
    expect(doc.content[1]).toEqual({ type: "paragraph" });
    expect(deriveText(doc)).toContain("The cook knows.");
  });
});
