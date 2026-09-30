import { describe, expect, it } from "vitest";
import { Schema } from "@tiptap/pm/model";
import { EditorState, TextSelection } from "@tiptap/pm/state";
import { triggerMatch } from "../src/components/rich-editor/menu-keys";

const schema = new Schema({ nodes: { doc: { content: "paragraph+" }, paragraph: { content: "text*" }, text: {} } });

/** An editable editor whose caret sits at the end of `text`. */
function editorAt(text: string) {
  const doc = schema.node("doc", null, [schema.node("paragraph", null, text ? [schema.text(text)] : [])]);
  const state = EditorState.create({ doc, selection: TextSelection.create(doc, text.length + 1) });
  return { isEditable: true, state };
}

describe("triggerMatch", () => {
  it("opens at the start of the line and anywhere after a space", () => {
    expect(triggerMatch(editorAt("@ara"), "@", 40)?.query).toBe("ara");
    expect(triggerMatch(editorAt("Met with @ara"), "@", 40)?.query).toBe("ara");
    expect(triggerMatch(editorAt("Then we /head"), "/", 40)?.query).toBe("head");
    expect(triggerMatch(editorAt("Mists of @"), "@", 40)).toMatchObject({ from: 10, query: "" });
  });
  it("opens after brackets, quotes and dashes", () => {
    expect(triggerMatch(editorAt("the (@ara"), "@", 40)?.query).toBe("ara");
    expect(triggerMatch(editorAt('she said "@ara'), "@", 40)?.query).toBe("ara");
    expect(triggerMatch(editorAt("home — @ara"), "@", 40)?.query).toBe("ara");
  });
  it("stays closed right after a letter or digit", () => {
    expect(triggerMatch(editorAt("mail@host"), "@", 40)).toBeNull();
    expect(triggerMatch(editorAt("yes/no"), "/", 40)).toBeNull();
    expect(triggerMatch(editorAt("12/3"), "/", 40)).toBeNull();
  });
});
