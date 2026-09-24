import { describe, it, expect } from "vitest";
import { validateDocument, deriveText, DocumentValidationError } from "../src/server/documents/schema";
import { mapFontFamily } from "../src/server/texts/fonts";
import { sanitizeTags, parseTags, MAX_TAGS, MAX_TAG_LENGTH } from "../src/server/articles/tags";
import { articleHref } from "../src/server/articles/templates";

const IMAGE_SRC = "/api/article-images/123e4567-e89b-12d3-a456-426614174000.webp";

const doc = (...content: unknown[]) => ({ type: "doc", content });
const para = (text: string, marks?: unknown[]) => ({ type: "paragraph", content: [{ type: "text", text, ...(marks ? { marks } : {}) }] });
const image = (attrs: Record<string, unknown>) => ({ type: "image", attrs: { src: IMAGE_SRC, ...attrs } });

describe("validateDocument — article editor content", () => {
  it("accepts a title, H1–H5, alignment, color, fonts and an uploaded image", () => {
    const value = doc(
      { type: "title", attrs: { textAlign: "center" }, content: [{ type: "text", text: "The Iron Crown" }] },
      ...[1, 2, 3, 4, 5].map((level) => ({ type: "heading", attrs: { level, textAlign: "justify" }, content: [{ type: "text", text: `H${level}` }] })),
      para("Styled", [{ type: "textStyle", attrs: { color: "#AABBCC", fontFamily: mapFontFamily("cinzel") } }]),
      image({ width: 420, height: 280, align: "left", href: "https://example.com", alt: "A crown" })
    );
    expect(() => validateDocument(value)).not.toThrow();
  });

  it("accepts textStyle attributes left unset (null)", () => {
    expect(() => validateDocument(doc(para("x", [{ type: "textStyle", attrs: { color: null, fontFamily: null } }])))).not.toThrow();
  });

  it.each([
    ["an image from another site", image({ src: "https://evil.example/x.png" })],
    ["an image path outside the upload route", image({ src: "/api/article-images/../secret.webp" })],
    ["a javascript: image link", image({ href: "javascript:alert(1)" })],
    ["an unknown image alignment", image({ align: "diagonal" })],
    ["a negative image width", image({ width: -5 })],
    ["a non-hex text color", para("x", [{ type: "textStyle", attrs: { color: "red; background: url(x)" } }])],
    ["an unknown font", para("x", [{ type: "textStyle", attrs: { fontFamily: "Comic Sans MS" } }])],
    ["an unknown text alignment", { type: "paragraph", attrs: { textAlign: "middle" }, content: [] }],
    ["heading level 6", { type: "heading", attrs: { level: 6 }, content: [] }],
  ])("rejects %s", (_label, node) => {
    expect(() => validateDocument(doc(node))).toThrow(DocumentValidationError);
  });

  it("puts a title on its own line in the plain-text projection", () => {
    const value = doc({ type: "title", content: [{ type: "text", text: "Title" }] }, para("Body"));
    expect(deriveText(value)).toBe("Title\nBody");
  });
});

describe("sanitizeTags", () => {
  it("trims, collapses spaces and drops empty and case-insensitive duplicates", () => {
    expect(sanitizeTags(["  Noble  house ", "noble house", "", "War"])).toEqual(["Noble house", "War"]);
  });

  it("never stores the template tag", () => {
    expect(sanitizeTags(["character", "Villain"], "Character")).toEqual(["Villain"]);
  });

  it("caps count and length", () => {
    const many = Array.from({ length: MAX_TAGS + 5 }, (_, i) => `tag${i}`);
    expect(sanitizeTags(many)).toHaveLength(MAX_TAGS);
    expect(sanitizeTags(["x".repeat(MAX_TAG_LENGTH + 10)])![0]).toHaveLength(MAX_TAG_LENGTH);
  });

  it("returns null for a non-array (field not being patched)", () => {
    expect(sanitizeTags(undefined)).toBeNull();
    expect(sanitizeTags("a,b")).toBeNull();
  });

  it("parses stored JSON defensively", () => {
    expect(parseTags('["a", 2, "b"]')).toEqual(["a", "b"]);
    expect(parseTags("not json")).toEqual([]);
  });
});

describe("articleHref", () => {
  it("maps the politics 'person' kind to character articles", () => {
    expect(articleHref("person", "p1")).toBe("/articles?type=character&id=p1");
    expect(articleHref("territory")).toBe("/articles?type=territory");
  });
});
