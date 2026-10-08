"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { CalendarPlus } from "lucide-react";
import Modal from "@/components/Modal";
import InfoPicker, { type PickerOption } from "@/components/articles/InfoPicker";
import WorldDatePicker from "@/components/calendars/WorldDatePicker";
import { dayLabel } from "@/components/calendars/evaluate";
import { useDefaultCalendarStatus } from "@/components/relations/use-default-calendar";
import { SkeletonList } from "@/components/Skeleton";
import type { WeatherDay } from "@/lib/weather/generate";
import { useT } from "@/i18n/useT";

const byName = (a: PickerOption, b: PickerOption) => a.label.localeCompare(b.label);

/** The world's live settlements and territories, as picker options. */
function usePlaces() {
  const [places, setPlaces] = useState<{ settlements: PickerOption[]; territories: PickerOption[] } | null>(null);
  useEffect(() => {
    let cancelled = false;
    Promise.all([
      fetch("/api/articles?template=settlement").then((r) => (r.ok ? r.json() : { articles: [] })),
      fetch("/api/politics/territories").then((r) => (r.ok ? r.json() : { territories: [] })),
    ])
      .then(([a, t]: [{ articles: { id: string; title: string }[] }, { territories: { id: string; name: string }[] }]) => {
        if (cancelled) return;
        setPlaces({
          settlements: a.articles.map((x) => ({ value: x.id, label: x.title })).sort(byName),
          territories: t.territories.map((x) => ({ value: x.id, label: x.name })).sort(byName),
        });
      })
      .catch(() => !cancelled && setPlaces({ settlements: [], territories: [] }));
    return () => {
      cancelled = true;
    };
  }, []);
  return places;
}

/**
 * "Attach to calendar": puts a generated day on a day of the world's
 * calendar (today's in-world date unless another is picked), optionally
 * naming the settlement and/or territory it describes.
 */
export default function AttachWeatherModal({ day, onAttached, onClose }: { day: WeatherDay; onAttached: (attachmentId: string, label: string) => void; onClose: () => void }) {
  const t = useT("weather");
  const { calendar, loading } = useDefaultCalendarStatus();
  const places = usePlaces();
  const [worldDay, setWorldDay] = useState<number | null>(null);
  const [settlementId, setSettlementId] = useState<string | null>(null);
  const [territoryId, setTerritoryId] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const picked = worldDay ?? calendar?.currentDay ?? null;

  async function attach() {
    if (picked === null || !calendar) return;
    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/calendar-weather", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ worldDay: picked, day, settlementId, territoryId }),
      });
      const data = await res.json().catch(() => null);
      if (!res.ok || typeof data?.id !== "string") throw new Error(data?.error ?? t("attach.failed"));
      onAttached(data.id, dayLabel(calendar.def, picked, { weekday: false }));
    } catch (e) {
      setError(e instanceof Error ? e.message : t("attach.failed"));
      setBusy(false);
    }
  }

  return (
    <Modal open onClose={onClose} title={t("gen.attach")}>
      {loading ? (
        <SkeletonList rows={3} label={t("attach.loading")} />
      ) : !calendar ? (
        <p className="field-label">
          {t("attach.noCalendar")} <Link href="/calendars">{t("attach.noCalendarLink")}</Link> {t("attach.noCalendarAfter")}
        </p>
      ) : (
        <form
          className="new-map-form"
          onSubmit={(e) => {
            e.preventDefault();
            attach();
          }}
        >
          <WorldDatePicker def={calendar.def} label={t("attach.day")} value={picked} currentDay={calendar.currentDay} onChange={setWorldDay} />
          <span className="field-label">{t("attach.settlement")}</span>
          <InfoPicker
            ariaLabel={t("attach.settlementAria")}
            placeholder={places ? (places.settlements.length ? t("attach.settlementWhere") : t("attach.noSettlements")) : t("ui.loading")}
            clearLabel={t("ui.none")}
            options={places?.settlements ?? []}
            value={settlementId}
            disabled={!places?.settlements.length}
            onChange={setSettlementId}
          />
          <span className="field-label">{t("attach.territory")}</span>
          <InfoPicker
            ariaLabel={t("attach.territoryAria")}
            placeholder={places ? (places.territories.length ? t("attach.territoryWhere") : t("attach.noTerritories")) : t("ui.loading")}
            clearLabel={t("ui.none")}
            options={places?.territories ?? []}
            value={territoryId}
            disabled={!places?.territories.length}
            onChange={setTerritoryId}
          />
          <p className="field-label">{t("attach.help")}</p>
          {error && (
            <p className="form-error" role="alert">
              {error}
            </p>
          )}
          <div className="confirm-dialog-actions">
            <button type="button" className="btn btn-sm" onClick={onClose}>
              {t("ui.cancel")}
            </button>
            <button type="submit" className="btn btn-sm btn-primary" disabled={picked === null || busy}>
              <CalendarPlus size={15} strokeWidth={2.25} aria-hidden />
              {busy ? t("attach.attaching") : t("attach.submit")}
            </button>
          </div>
        </form>
      )}
    </Modal>
  );
}
