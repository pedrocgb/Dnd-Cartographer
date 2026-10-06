import { describe, it, expect } from "vitest";
import { imageKeysOf, isBlankDoc, rewriteForShare, stripSecrets, type JsonNode } from "../src/server/share/transform";

const p = (text: string): JsonNode => ({ type: "paragraph", content: [{ type: "text", text }] });
const secret = (revealed: boolean, ...content: JsonNode[]): JsonNode => ({ type: "secret", attrs: { revealed }, content });
const doc = (...content: JsonNode[]): JsonNode => ({ type: "doc", content });
const IMG = "0123abcd-0123-4567-89ab-0123456789ab.webp";

describe("stripSecrets", () => {
  it("drops hidden secrets and unwraps revealed ones", () => {
    expect(stripSecrets(doc(p("open"), secret(false, p("hidden")), secret(true, p("told"))))).toEqual(doc(p("open"), p("told")));
  });

  it("drops a revealed secret inside a hidden one, and a hidden one inside a revealed one", () => {
    expect(stripSecrets(doc(p("a"), secret(false, secret(true, p("x")))))).toEqual(doc(p("a")));
    expect(stripSecrets(doc(secret(true, p("kept"), secret(false, p("gone")))))).toEqual(doc(p("kept")));
  });

  it("leaves an emptied container a paragraph", () => {
    expect(stripSecrets(doc(secret(false, p("all of it"))))).toEqual(doc({ type: "paragraph" }));
    const cell = (c: JsonNode[]): JsonNode => ({ type: "table", content: [{ type: "tableRow", content: [{ type: "tableCell", content: c }] }] });
    expect(stripSecrets(doc(cell([secret(false, p("x"))])))).toEqual(doc(cell([{ type: "paragraph" }])));
  });

  it("never lets hidden text through", () => {
    expect(JSON.stringify(stripSecrets(doc(p("a"), secret(false, p("The duke is a lich")))))).not.toContain("lich");
  });
});

describe("rewriteForShare", () => {
  const ctx = { mentionHref: (_kind: string, id: string) => (id === "shared" ? "/share/tok" : null), imageSrc: (key: string) => `/api/share/t/image/${key}` };
  const mention = (id: string): JsonNode => ({ type: "mention", attrs: { kind: "settlement", id, label: "Waterdeep", text: null }, marks: [{ type: "bold" }] });

  it("links a mention whose target is shared, else leaves its text", () => {
    const out = rewriteForShare(doc({ type: "paragraph", content: [mention("shared"), mention("private")] }), ctx);
    expect(out.content![0].content).toEqual([
      { type: "text", text: "Waterdeep", marks: [{ type: "bold" }, { type: "link", attrs: { href: "/share/tok", target: null, rel: null } }] },
      { type: "text", text: "Waterdeep", marks: [{ type: "bold" }] },
    ]);
  });

  it("keeps external links, drops app links, and turns dates into text", () => {
    const link = (href: string): JsonNode => ({ type: "text", text: href, marks: [{ type: "link", attrs: { href } }] });
    const out = rewriteForShare(doc({ type: "paragraph", content: [link("https://x.org"), link("/maps?id=1"), { type: "calendarDate", attrs: { day: 3, label: "3 Hammer" } }] }), ctx);
    expect(out.content![0].content).toEqual([link("https://x.org"), { type: "text", text: "/maps?id=1" }, { type: "text", text: "3 Hammer" }]);
  });

  it("serves images through the share and drops app-internal image links", () => {
    const out = rewriteForShare(doc({ type: "image", attrs: { src: `/api/article-images/${IMG}`, href: "/articles?id=1" } }), ctx);
    expect(out.content![0].attrs).toEqual({ src: `/api/share/t/image/${IMG}`, href: null });
  });
});

describe("helpers", () => {
  it("lists the image keys a document shows", () => {
    expect(imageKeysOf(doc(p("x"), { type: "image", attrs: { src: `/api/article-images/${IMG}` } }))).toEqual([IMG]);
  });

  it("tells a blank document from one with content", () => {
    expect(isBlankDoc(doc({ type: "paragraph" }, p("  ")))).toBe(true);
    expect(isBlankDoc(doc(p("hi")))).toBe(false);
  });
});
