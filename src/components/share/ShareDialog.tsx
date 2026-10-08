"use client";

import { useEffect, useState } from "react";
import { Check, Copy, EyeOff, Link2, Link2Off, TriangleAlert } from "lucide-react";
import Modal from "@/components/Modal";
import type { ClientShare, ShareTarget } from "@/server/share/load";
import { useT } from "@/i18n/useT";
import { activeT } from "@/i18n/active";

export interface ShareScope {
  /** What the option reads as ("Whole campaign", "Chapter: The Heist"). */
  label: string;
  target: ShareTarget;
  /** Shown while this option is picked: what sharing it does that the user may not expect. */
  warning?: string;
  /** Shown while this option is picked: what the link leaves out. */
  note?: string;
}

type Status = { state: "loading" } | { state: "ready"; share: ClientShare | null };

const targetQuery = (t: ShareTarget) => new URLSearchParams({ kind: t.kind, id: t.id, ...(t.kind === "article" ? { template: t.template } : {}) }).toString();

async function errorOf(res: Response): Promise<string> {
  const data: { error?: string } = await res.json().catch(() => ({}));
  return data.error ?? activeT("articles")("share.requestFailed", { status: res.status });
}

/**
 * Creates, shows and revokes the read-only link to an article or to part
 * of the Campaign Writer. Opening it needs no login; the page stays live
 * (always the current text) and leaves unrevealed secrets out.
 */
export default function ShareDialog({ scopes, initialScope = 0, onClose }: { scopes: ShareScope[]; initialScope?: number; onClose: () => void }) {
  const ta = useT("articles");
  const tc = useT("common");
  const [index, setIndex] = useState(initialScope);
  const [status, setStatus] = useState<Status>({ state: "loading" });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const target = scopes[index].target;
  const query = targetQuery(target);

  useEffect(() => {
    let cancelled = false;
    fetch(`/api/shares?${query}`, { cache: "no-store" })
      .then(async (res) => {
        if (!res.ok) throw new Error(await errorOf(res));
        return (await res.json()).share as ClientShare | null;
      })
      .then(
        (share) => {
          if (!cancelled) setStatus({ state: "ready", share });
        },
        (err: Error) => {
          if (cancelled) return;
          setStatus({ state: "ready", share: null });
          setError(err.message);
        }
      );
    return () => {
      cancelled = true;
    };
  }, [query]);

  function pickScope(next: number) {
    setIndex(next);
    setStatus({ state: "loading" });
    setError(null);
    setCopied(false);
  }

  async function run(action: () => Promise<ClientShare | null>) {
    setBusy(true);
    setError(null);
    try {
      setStatus({ state: "ready", share: await action() });
    } catch (err) {
      setError(err instanceof Error ? err.message : tc("somethingWrong"));
    } finally {
      setBusy(false);
    }
  }

  const create = () =>
    run(async () => {
      const res = await fetch("/api/shares", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(target) });
      if (!res.ok) throw new Error(await errorOf(res));
      return (await res.json()).share;
    });

  const revoke = (share: ClientShare) =>
    run(async () => {
      const res = await fetch(`/api/shares/${share.id}`, { method: "DELETE" });
      if (!res.ok) throw new Error(await errorOf(res));
      setCopied(false);
      return null;
    });

  async function copy(url: string) {
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
    } catch {
      setError(ta("share.copyFailed"));
    }
  }

  const share = status.state === "ready" ? status.share : null;
  const url = share ? `${window.location.origin}/share/${share.token}` : "";

  return (
    <Modal open onClose={() => !busy && onClose()} title={ta("share.title")}>
      {scopes.length > 1 && (
        <label className="field">
          <span className="field-label">{ta("share.what")}</span>
          <select value={index} onChange={(e) => pickScope(Number(e.target.value))} disabled={busy}>
            {scopes.map((s, i) => (
              <option key={`${s.target.kind}:${s.target.id}`} value={i}>
                {s.label}
              </option>
            ))}
          </select>
        </label>
      )}
      {scopes[index].warning && (
        <p className="share-notice share-warning" role="alert">
          <TriangleAlert size={14} strokeWidth={2.25} aria-hidden />
          {scopes[index].warning}
        </p>
      )}
      {scopes[index].note && (
        <p className="share-notice">
          <EyeOff size={14} strokeWidth={2.25} aria-hidden />
          {scopes[index].note}
        </p>
      )}
      <p className="cal-help">{ta("share.explain")}</p>

      {status.state === "loading" ? (
        <p className="field-label" role="status">
          {ta("share.checking")}
        </p>
      ) : share ? (
        <div className="share-link-row">
          <input type="text" readOnly value={url} aria-label={ta("share.linkLabel")} onFocus={(e) => e.currentTarget.select()} />
          <button type="button" className="btn btn-sm" onClick={() => void copy(url)} disabled={busy}>
            {copied ? <Check size={14} strokeWidth={2.25} /> : <Copy size={14} strokeWidth={2.25} />}
            {copied ? ta("share.copied") : ta("share.copy")}
          </button>
        </div>
      ) : (
        <p className="field-label">{ta("share.none")}</p>
      )}

      {error && (
        <p className="form-error" role="alert">
          {error}
        </p>
      )}
      <div className="confirm-dialog-actions">
        {share ? (
          <button type="button" className="btn btn-sm btn-danger" onClick={() => void revoke(share)} disabled={busy} data-tooltip={ta("share.revokeHint")}>
            <Link2Off size={14} strokeWidth={2.25} />
            {busy ? ta("share.revoking") : ta("share.revoke")}
          </button>
        ) : (
          <button type="button" className="btn btn-sm btn-primary" onClick={() => void create()} disabled={busy || status.state === "loading"}>
            <Link2 size={14} strokeWidth={2.25} />
            {busy ? tc("creating") : ta("share.create")}
          </button>
        )}
        <button type="button" className="btn btn-sm" onClick={onClose} disabled={busy}>
          {tc("done")}
        </button>
      </div>
    </Modal>
  );
}
