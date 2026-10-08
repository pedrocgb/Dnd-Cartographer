"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { Compass, ExternalLink, ImageUp, Settings, Trash2, X } from "lucide-react";
import InfoPicker, { type PickerOption } from "@/components/articles/InfoPicker";
import { useT } from "@/i18n/useT";
import { assetStateLabel, type MapSummary } from "./types";

const ACCEPTED_IMAGES = "image/png,image/jpeg,image/webp";
const MAX_MAP_NAME_LENGTH = 200;

/**
 * A map's side panel (opened from its Settings button): everything New Map
 * asks for — name, category, parent map, folder, artwork — editable at will,
 * plus Delete. Each change saves at once. Mount it keyed by map id.
 */
export default function MapSettingsPanel({
  map,
  mapOptions,
  folderOptions,
  onPatch,
  onUploaded,
  onDelete,
  onClose,
}: {
  map: MapSummary;
  /** Possible parents: every map except this one and its descendants. */
  mapOptions: PickerOption[];
  folderOptions: PickerOption[];
  /** Saves a change; resolves an error message, or null. */
  onPatch: (body: Record<string, unknown>) => Promise<string | null>;
  onUploaded: () => void;
  onDelete: () => void;
  onClose: () => void;
}) {
  const t = useT("maps");
  const tc = useT("common");
  const [name, setName] = useState(map.name);
  const [categories, setCategories] = useState<PickerOption[] | null>(null);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const art = map.currentAssetId && map.thumbnailKey ? `/api/thumbnails/${map.currentAssetId}` : null;

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

  async function save(body: Record<string, unknown>) {
    setError(await onPatch(body));
  }

  function commitName() {
    const next = name.trim();
    if (!next) return setName(map.name);
    if (next !== map.name) void save({ name: next });
  }

  async function upload(file: File) {
    setUploading(true);
    setError(null);
    try {
      const res = await fetch(`/api/maps/${map.id}/assets`, { method: "POST", headers: { "Content-Type": file.type }, body: file });
      if (!res.ok) setError((await res.json().catch(() => ({}))).error ?? t("art.uploadFailed"));
      else onUploaded();
    } catch {
      setError(tc("serverUnreachable"));
    } finally {
      setUploading(false);
      if (fileRef.current) fileRef.current.value = "";
    }
  }

  return (
    <aside className="marker-side-panel maps-settings-panel" aria-label={t("mapSettings.title")}>
      <div className="marker-side-panel-header">
        <h2>
          <Settings size={16} strokeWidth={2.25} aria-hidden />
          {t("mapSettings.title")}
        </h2>
        <button className="btn btn-ghost btn-icon" onClick={onClose} aria-label={t("mapSettings.close")}>
          <X size={16} strokeWidth={2.25} />
        </button>
      </div>
      <p className="maps-settings-subject">
        <Compass size={15} strokeWidth={2.25} aria-hidden />
        <span>{map.name}</span>
        <Link href={`/maps/${map.id}`} className="btn btn-sm btn-ghost" data-tooltip={t("mapSettings.openHint")}>
          <ExternalLink size={12} strokeWidth={2.25} />
          {t("mapSettings.open")}
        </Link>
      </p>

      <label className="field-label" htmlFor="map-settings-name">
        {t("field.mapName")}
      </label>
      <input
        id="map-settings-name"
        type="text"
        value={name}
        maxLength={MAX_MAP_NAME_LENGTH}
        onChange={(e) => setName(e.target.value)}
        onBlur={commitName}
        onKeyDown={(e) => e.key === "Enter" && e.currentTarget.blur()}
      />

      <span className="field-label">{t("field.category")}</span>
      <InfoPicker
        options={categories ?? []}
        value={map.categoryId}
        placeholder={categories === null ? tc("loading") : t("picker.noCategory")}
        clearLabel={t("picker.noCategory")}
        ariaLabel={t("field.category")}
        searchable={(categories?.length ?? 0) >= 10}
        onChange={(categoryId) => void save({ categoryId })}
      />

      <span className="field-label">{t("field.parent")}</span>
      <InfoPicker
        options={mapOptions}
        value={map.parentId}
        placeholder={t("picker.noParent")}
        clearLabel={t("picker.noParent")}
        ariaLabel={t("field.parent")}
        onChange={(parentId) => void save({ parentId })}
      />

      <span className="field-label">{t("field.folder")}</span>
      <InfoPicker
        options={folderOptions}
        value={map.folderId}
        placeholder={folderOptions.length ? t("picker.noFolder") : t("picker.noFolders")}
        clearLabel={t("picker.noFolder")}
        ariaLabel={t("field.folder")}
        disabled={folderOptions.length === 0}
        onChange={(folderId) => void save({ folderId })}
      />

      <span className="field-label">{t("field.artwork")}</span>
      <div className="maps-settings-art">
        {art ? (
          // eslint-disable-next-line @next/next/no-img-element -- local thumbnail, not worth next/image's remote-optimization machinery
          <img src={art} alt="" />
        ) : (
          <div className="maps-settings-art-empty">{t("noImage")}</div>
        )}
      </div>
      <input ref={fileRef} type="file" accept={ACCEPTED_IMAGES} hidden onChange={(e) => e.target.files?.[0] && void upload(e.target.files[0])} />
      <button type="button" className="btn btn-sm" disabled={uploading} onClick={() => fileRef.current?.click()}>
        <ImageUp size={13} strokeWidth={2.25} />
        {uploading ? t("art.uploading") : art ? t("art.replace") : t("art.upload")}
      </button>
      {art && <p className="field-label">{t("art.replaceHint")}</p>}
      {map.assetState && map.assetState !== "ready" && <p className="field-label">{t("assetState", { state: assetStateLabel(map.assetState, t) })}</p>}

      {error && <p className="form-error">{error}</p>}

      <div className="maps-settings-actions">
        <button type="button" className="btn btn-sm btn-danger" onClick={onDelete}>
          <Trash2 size={13} strokeWidth={2.25} />
          {t("deleteMap.confirm")}
        </button>
      </div>
    </aside>
  );
}
