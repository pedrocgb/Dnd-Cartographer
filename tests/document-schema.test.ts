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

describe("mention link text", () => {
  const withMention = (attrs: Record<string, unknown>) => ({
    type: "doc",
    content: [{ type: "paragraph", content: [{ type: "text", text: "See " }, { type: "mention", attrs: { kind: "character", id: "c1", label: "Aldric", campaign: null, ...attrs } }] }],
  });

  it("accepts a mention with or without custom text", () => {
    expect(() => validateDocument(withMention({}))).not.toThrow();
    expect(() => validateDocument(withMention({ text: null }))).not.toThrow();
    expect(() => validateDocument(withMention({ text: "the old king" }))).not.toThrow();
  });

  it("rejects non-string or oversized text", () => {
    expect(() => validateDocument(withMention({ text: 42 }))).toThrow(DocumentValidationError);
    expect(() => validateDocument(withMention({ text: "x".repeat(201) }))).toThrow(DocumentValidationError);
  });

  it("derives the custom text, else @label", () => {
    expect(deriveText(withMention({ text: "the old king" }))).toBe("See the old king");
    expect(deriveText(withMention({}))).toBe("See @Aldric");
    expect(deriveText(withMention({ text: "  " }))).toBe("See @Aldric");
  });
});

describe("tables", () => {
  const cell = (type: string, attrs: Record<string, unknown> = {}, text = "x") => ({
    type,
    attrs: { colspan: 1, rowspan: 1, colwidth: null, align: null, ...attrs },
    content: [{ type: "paragraph", content: [{ type: "text", text }] }],
  });
  const table = (cells: object[]) => ({ type: "doc", content: [{ type: "table", content: [{ type: "tableRow", content: cells }] }] });

  it("accepts header and body cells with spans, widths and alignment", () => {
    expect(() => validateDocument(table([cell("tableHeader", { colwidth: [120] }), cell("tableCell", { colspan: 2, colwidth: [80, 0], align: "center" })]))).not.toThrow();
  });

  it("rejects bad spans, widths and alignment", () => {
    expect(() => validateDocument(table([cell("tableCell", { colspan: 0 })]))).toThrow(DocumentValidationError);
    expect(() => validateDocument(table([cell("tableCell", { rowspan: 1.5 })]))).toThrow(DocumentValidationError);
    expect(() => validateDocument(table([cell("tableCell", { colwidth: ["100px"] })]))).toThrow(DocumentValidationError);
    expect(() => validateDocument(table([cell("tableCell", { colwidth: 100 })]))).toThrow(DocumentValidationError);
    expect(() => validateDocument(table([cell("tableCell", { align: "justify; color: red" })]))).toThrow(DocumentValidationError);
  });

  it("puts each cell's text on its own line", () => {
    expect(deriveText(table([cell("tableHeader", {}, "Name"), cell("tableCell", {}, "Aldric")]))).toBe("Name\nAldric");
  });
});

describe("table row heights", () => {
  const withRow = (attrs: Record<string, unknown>) => ({
    type: "doc",
    content: [{ type: "table", content: [{ type: "tableRow", attrs, content: [{ type: "tableCell", content: [{ type: "paragraph" }] }] }] }],
  });

  it("accepts no height or a whole number of pixels", () => {
    expect(() => validateDocument(withRow({ height: null }))).not.toThrow();
    expect(() => validateDocument(withRow({ height: 64 }))).not.toThrow();
  });

  it("rejects anything else", () => {
    for (const height of [0, -5, 12.5, "40px", 5000]) {
      expect(() => validateDocument(withRow({ height }))).toThrow(DocumentValidationError);
    }
  });
});

describe("calendar dates", () => {
  const withDate = (attrs: Record<string, unknown>) => ({ type: "doc", content: [{ type: "paragraph", content: [{ type: "text", text: "On " }, { type: "calendarDate", attrs }] }] });

  it("accepts a world day with its label, and searches by the label", () => {
    expect(() => validateDocument(withDate({ day: 1234, label: "3 Hammer 1492" }))).not.toThrow();
    expect(() => validateDocument(withDate({ day: -50, label: "" }))).not.toThrow();
    expect(deriveText(withDate({ day: 1234, label: "3 Hammer 1492" }))).toBe("On 3 Hammer 1492");
  });

  it("rejects a bad day or label", () => {
    for (const attrs of [{ day: 1.5, label: "x" }, { day: "12", label: "x" }, { day: 1e12, label: "x" }, { day: 1, label: "x".repeat(201) }]) {
      expect(() => validateDocument(withDate(attrs))).toThrow(DocumentValidationError);
    }
  });
});
