"use client";

import { useEffect, useRef, useState } from "react";
import { ImageUp, Plus, X } from "lucide-react";
import Modal from "@/components/Modal";
import InfoPicker, { type PickerOption } from "@/components/articles/InfoPicker";
import { useT } from "@/i18n/useT";

const ACCEPTED_IMAGES = "image/png,image/jpeg,image/webp";

/**
 * "New Map": name, then optional category, parent map, folder and artwork.
 * Pickers float outside the modal (InfoPicker), so it never grows a
 * scrollbar for a long list. `initialFolderId` presets the folder (a
 * folder's "Create map").
 */
export default function NewMapModal({
  folderOptions,
  mapOptions,
  initialFolderId,
  onClose,
  onCreated,
}: {
  /** Folders as picker rows (label shows the path). */
  folderOptions: PickerOption[];
  mapOptions: PickerOption[];
  initialFolderId: string | null;
  onClose: () => void;
  onCreated: (mapId: string) => void;
}) {
  const t = useT("maps");
  const tc = useT("common");
  const [name, setName] = useState("");
  const [categoryId, setCategoryId] = useState<string | null>(null);
  const [parentId, setParentId] = useState<string | null>(null);
  const [folderId, setFolderId] = useState<string | null>(initialFolderId);
  const [file, setFile] = useState<File | null>(null);
  const [categories, setCategories] = useState<PickerOption[] | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    let cancelled = false;
    fetch("/api/map-categories")
      .then((r) => r.json())
      .then((d: { categories: { id: string; label: string }[] }) => {
        if (!cancelled) setCategories(d.categories.map((c) => ({ value: c.id, label: c.label })));
      })
      .catch(() => !cancelled && setCategories([]));
    return () => {
      cancelled = true;
    };
  }, []);

  async function submit() {
    if (!name.trim() || busy) return;
    setBusy(true);
    setError(null);
    try {
      const mapRes = await fetch("/api/maps", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, categoryId, parentId, folderId }),
      });
      if (!mapRes.ok) throw new Error((await mapRes.json().catch(() => ({}))).error ?? t("newMapModal.createFailed"));
      const { map } = await mapRes.json();
      if (file) {
        const uploadRes = await fetch(`/api/maps/${map.id}/assets`, { method: "POST", headers: { "Content-Type": file.type }, body: file });
        if (!uploadRes.ok) throw new Error((await uploadRes.json().catch(() => ({}))).error ?? t("newMapModal.uploadFailed"));
      }
      onCreated(map.id);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
      setBusy(false);
    }
  }

  return (
    <Modal open onClose={() => !busy && onClose()} title={t("newMap")}>
      <form
        className="new-map-form"
        onSubmit={(e) => {
          e.preventDefault();
          void submit();
        }}
      >
        <label className="field-label" htmlFor="new-map-name">
          {t("field.mapName")}
        </label>
        <input id="new-map-name" type="text" placeholder={t("newMapModal.namePlaceholder")} value={name} maxLength={200} autoFocus onChange={(e) => setName(e.target.value)} />

        <span className="field-label">{t("field.categoryOptional")}</span>
        <InfoPicker
          options={categories ?? []}
          value={categoryId}
          placeholder={categories === null ? tc("loading") : t("picker.noCategory")}
          clearLabel={t("picker.noCategory")}
          ariaLabel={t("field.category")}
          searchable={(categories?.length ?? 0) >= 10}
          onChange={setCategoryId}
        />

        <span className="field-label">{t("field.parentOptional")}</span>
        <InfoPicker options={mapOptions} value={parentId} placeholder={t("picker.noParent")} clearLabel={t("picker.noParent")} ariaLabel={t("field.parent")} onChange={setParentId} />

        <span className="field-label">{t("field.folderOptional")}</span>
        <InfoPicker
          options={folderOptions}
          value={folderId}
          placeholder={folderOptions.length ? t("picker.noFolder") : t("picker.noFolders")}
          clearLabel={t("picker.noFolder")}
          ariaLabel={t("field.folder")}
          disabled={folderOptions.length === 0}
          onChange={setFolderId}
        />

        <span className="field-label">{t("field.artworkOptional")}</span>
        <input ref={fileRef} type="file" accept={ACCEPTED_IMAGES} hidden onChange={(e) => setFile(e.target.files?.[0] ?? null)} />
        <div className="new-map-file">
          <button type="button" className="btn btn-sm" onClick={() => fileRef.current?.click()}>
            <ImageUp size={13} strokeWidth={2.25} />
            {file ? t("art.change") : t("art.choose")}
          </button>
          {file ? (
            <>
              <span className="new-map-file-name" data-tooltip={file.name}>
                {file.name}
              </span>
              <button
                type="button"
                className="btn btn-ghost btn-icon"
                aria-label={t("art.remove")}
                data-tooltip={t("art.remove")}
                onClick={() => {
                  setFile(null);
                  if (fileRef.current) fileRef.current.value = "";
                }}
              >
                <X size={13} strokeWidth={2.25} />
              </button>
            </>
          ) : (
            <span className="field-label">{t("art.formats")}</span>
          )}
        </div>

        {error && <p className="form-error">{error}</p>}
        <div className="confirm-dialog-actions">
          <button type="button" className="btn btn-sm" onClick={onClose} disabled={busy}>
            {tc("cancel")}
          </button>
          <button type="submit" className="btn btn-sm btn-primary" disabled={busy || !name.trim()}>
            <Plus size={13} strokeWidth={2.25} />
            {busy ? tc("creating") : t("createMap")}
          </button>
        </div>
      </form>
    </Modal>
  );
}
