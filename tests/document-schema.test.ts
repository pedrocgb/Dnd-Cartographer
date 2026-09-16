import { describe, it, expect } from "vitest";
import { validateDocument, deriveText, DocumentValidationError } from "../src/server/documents/schema";

describe("validateDocument", () => {
  it("accepts a well-formed document", () => {
    const doc = {
      type: "doc",
      content: [
        { type: "heading", attrs: { level: 2 }, content: [{ type: "text", text: "Title" }] },
        {
          type: "paragraph",
          content: [
            { type: "text", text: "Hello ", marks: [{ type: "bold" }] },
            { type: "text", text: "world", marks: [{ type: "link", attrs: { href: "https://example.com" } }] },
          ],
        },
      ],
    };
    expect(() => validateDocument(doc)).not.toThrow();
  });

  it("rejects a non-doc root", () => {
    expect(() => validateDocument({ type: "paragraph", content: [] })).toThrow(DocumentValidationError);
  });

  it("rejects an unknown node type", () => {
    const doc = { type: "doc", content: [{ type: "codeBlock", content: [] }] };
    expect(() => validateDocument(doc)).toThrow(DocumentValidationError);
  });

  it("rejects an unknown mark type", () => {
    const doc = {
      type: "doc",
      content: [{ type: "paragraph", content: [{ type: "text", text: "x", marks: [{ type: "highlight" }] }] }],
    };
    expect(() => validateDocument(doc)).toThrow(DocumentValidationError);
  });

  it("rejects a javascript: link", () => {
    const doc = {
      type: "doc",
      content: [
        {
          type: "paragraph",
          content: [{ type: "text", text: "x", marks: [{ type: "link", attrs: { href: "javascript:alert(1)" } }] }],
        },
      ],
    };
    expect(() => validateDocument(doc)).toThrow(DocumentValidationError);
  });

  it("accepts a mailto: link", () => {
    const doc = {
      type: "doc",
      content: [
        {
          type: "paragraph",
          content: [{ type: "text", text: "x", marks: [{ type: "link", attrs: { href: "mailto:a@b.com" } }] }],
        },
      ],
    };
    expect(() => validateDocument(doc)).not.toThrow();
  });

  it("rejects excessive nesting depth", () => {
    let node: Record<string, unknown> = { type: "text", text: "x" };
    for (let i = 0; i < 20; i++) {
      node = { type: "blockquote", content: [node] };
    }
    const doc = { type: "doc", content: [node] };
    expect(() => validateDocument(doc)).toThrow(DocumentValidationError);
  });

  it("rejects an oversized document", () => {
    const doc = {
      type: "doc",
      content: [{ type: "paragraph", content: [{ type: "text", text: "x".repeat(300_000) }] }],
    };
    expect(() => validateDocument(doc)).toThrow(DocumentValidationError);
  });
});

describe("deriveText", () => {
  it("joins block text with newlines", () => {
    const doc = {
      type: "doc",
      content: [
        { type: "heading", content: [{ type: "text", text: "Title" }] },
        { type: "paragraph", content: [{ type: "text", text: "Body text." }] },
      ],
    };
    expect(deriveText(doc)).toBe("Title\nBody text.");
  });

  it("returns an empty string for an empty document", () => {
    expect(deriveText({ type: "doc", content: [{ type: "paragraph" }] })).toBe("");
  });
});
