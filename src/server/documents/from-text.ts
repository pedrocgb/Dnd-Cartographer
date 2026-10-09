/** Plain text as a rich document: one paragraph per line. Pure (vitest imports it). */
export function textDocument(text: string) {
  return {
    type: "doc",
    content: text.split("\n").map((line) => (line ? { type: "paragraph", content: [{ type: "text", text: line }] } : { type: "paragraph" })),
  };
}
