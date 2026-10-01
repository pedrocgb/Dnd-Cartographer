"use client";

import { useState, useSyncExternalStore } from "react";
import { Search } from "lucide-react";
import { SettingsHeader } from "./parts";
import { filterShortcutGroups, SHORTCUT_GROUPS } from "@/components/shortcuts";

const noSubscribe = () => () => {};
const isMacPlatform = () => /Mac|iPhone|iPad/.test(navigator.platform || navigator.userAgent);

/** "Ctrl+Shift+Z" as key caps; Ctrl and Alt read ⌘ and ⌥ on macOS. */
function Combo({ combo, mac }: { combo: string; mac: boolean }) {
  const keys = combo === "+" ? ["+"] : combo.split("+");
  return (
    <span className="shortcut-combo">
      {keys.map((key, i) => (
        <kbd key={i}>{mac ? (key === "Ctrl" ? "⌘" : key === "Alt" ? "⌥" : key) : key}</kbd>
      ))}
    </span>
  );
}

export default function ShortcutsReference() {
  const [query, setQuery] = useState("");
  // The server can't know the platform: Ctrl there, ⌘ after hydration on a Mac.
  const mac = useSyncExternalStore(noSubscribe, isMacPlatform, () => false);
  const groups = filterShortcutGroups(SHORTCUT_GROUPS, query);

  return (
    <>
      <SettingsHeader title="Shortcuts & hotkeys" description="Every keyboard shortcut in the app. Map tool keys work when you're not typing in a field." />
      <label className="settings-search">
        <Search size={15} strokeWidth={2.25} aria-hidden />
        <input type="search" placeholder="Search shortcuts…" aria-label="Search shortcuts" value={query} onChange={(e) => setQuery(e.target.value)} />
      </label>
      {groups.length === 0 && <p className="settings-empty">No shortcut matches &ldquo;{query}&rdquo;.</p>}
      {groups.map((group) => (
        <section key={group.title} className="settings-card">
          <div className="settings-card-head">
            <h2>{group.title}</h2>
            <p>{group.description}</p>
          </div>
          <table className="shortcut-table">
            <tbody>
              {group.shortcuts.map((s, i) => (
                <tr key={i}>
                  <td className="shortcut-keys">
                    {s.keys.map((combo, j) => (
                      <span key={combo + j} className="shortcut-alt">
                        {j > 0 && <span className="shortcut-or">or</span>}
                        <Combo combo={combo} mac={mac} />
                      </span>
                    ))}
                  </td>
                  <td>
                    {s.action}
                    {s.context && <span className="shortcut-context">{s.context}</span>}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </section>
      ))}
    </>
  );
}
