"use client";

import { createElement, useEffect, useState } from "react";
import Link from "next/link";
import { MapPin, Trash2, X } from "lucide-react";
import ConfirmDialog from "@/components/ConfirmDialog";
import FoldSection from "./FoldSection";
import { useSettings } from "@/components/settings/SettingsProvider";
import WeatherModal, { daySummary, hourIcon } from "@/components/tools/WeatherModal";
import { articleHref } from "@/server/articles/templates";
import { fromCelsius, temperatureSymbol } from "@/server/settings/units";
import type { ClientWeather } from "@/server/calendars/weather";

/** The hour a day's weather is summed up by. */
const MIDDAY = 12;

/** "Riverbend, The Marches": links to the places a weather report is for. */
function Places({ weather }: { weather: ClientWeather }) {
  const places = [
    weather.settlement && { href: articleHref("settlement", weather.settlement.id), name: weather.settlement.name },
    weather.territory && { href: articleHref("territory", weather.territory.id), name: weather.territory.name },
  ].filter((p): p is { href: string; name: string } => Boolean(p));
  if (!places.length) return null;
  return (
    <>
      {places.map((p, i) => (
        <span key={p.href}>
          {i > 0 && ", "}
          <Link className="politics-link-button" href={p.href}>
            {p.name}
          </Link>
        </span>
      ))}
    </>
  );
}

/**
 * The day panel's Weather section: reports attached from the Weather
 * Generator. Each opens the full report; it can be removed from the day.
 */
export default function DayWeather({ worldDay }: { worldDay: number }) {
  const { settings } = useSettings();
  const [loaded, setLoaded] = useState<{ day: number; list: ClientWeather[] } | null>(null);
  const [version, setVersion] = useState(0);
  const [open, setOpen] = useState<ClientWeather | null>(null);
  const [removing, setRemoving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const temp = (c: number) => `${Math.round(fromCelsius(c, settings.temperatureUnit))}${temperatureSymbol(settings.temperatureUnit)}`;

  useEffect(() => {
    let cancelled = false;
    fetch(`/api/calendar-weather?day=${worldDay}`)
      .then((r) => (r.ok ? r.json() : { weather: [] }))
      .then((data: { weather: ClientWeather[] }) => !cancelled && setLoaded({ day: worldDay, list: data.weather }))
      .catch(() => !cancelled && setLoaded({ day: worldDay, list: [] }));
    return () => {
      cancelled = true;
    };
  }, [worldDay, version]);

  const list = loaded?.day === worldDay ? loaded.list : null;

  async function remove() {
    if (!open) return;
    setError(null);
    const res = await fetch(`/api/calendar-weather/${open.id}`, { method: "DELETE" }).catch(() => null);
    if (!res?.ok) {
      setError("Couldn't remove the weather. Try again.");
      return;
    }
    setRemoving(false);
    setOpen(null);
    setVersion((v) => v + 1);
  }

  const body =
    list === null ? (
      <p className="cal-help">Loading…</p>
    ) : list.length === 0 ? (
      <p className="cal-help">
        No weather for this day. Roll one in <Link href="/tools/weather">Advanced Tools › Weather Generator</Link> and attach it here.
      </p>
    ) : (
      <ul className="cal-sky">
        {list.map((w) => (
          <li key={w.id} className="cal-weather-row">
            <button type="button" className="cal-sky-item" data-tooltip="Open the weather report" onClick={() => setOpen(w)}>
              <span aria-hidden>{createElement(hourIcon(w.day.hours[MIDDAY]), { size: 15, strokeWidth: 2.25 })}</span>
              <span>
                {temp(w.day.low)} / {temp(w.day.high)}
              </span>
              <span className="cal-help">{daySummary(w.day)}</span>
            </button>
            {(w.settlement || w.territory) && (
              <span className="cal-weather-place">
                <MapPin size={12} strokeWidth={2.25} aria-hidden />
                <Places weather={w} />
              </span>
            )}
          </li>
        ))}
      </ul>
    );

  return (
    <>
      <FoldSection title="Weather" count={list?.length}>
        {body}
      </FoldSection>
      {open && (
        <WeatherModal
          key={open.id}
          day={open.day}
          onClose={() => setOpen(null)}
          extra={
            (open.settlement || open.territory) && (
              <p className="weather-attached">
                <MapPin size={15} strokeWidth={2.25} aria-hidden />
                Weather for <Places weather={open} />
              </p>
            )
          }
          actions={
            <>
              <button type="button" className="btn btn-sm btn-danger" onClick={() => setRemoving(true)}>
                <Trash2 size={15} strokeWidth={2.25} aria-hidden />
                Remove from this day
              </button>
              <button type="button" className="btn btn-sm" onClick={() => setOpen(null)}>
                <X size={15} strokeWidth={2.25} aria-hidden />
                Close
              </button>
            </>
          }
        />
      )}
      <ConfirmDialog
        open={removing}
        title="Remove this weather?"
        confirmLabel="Remove"
        error={error}
        onConfirm={remove}
        onCancel={() => {
          setRemoving(false);
          setError(null);
        }}
      >
        It leaves this day of the calendar for good. If it is still in the Weather Generator&rsquo;s recent list, you can attach it again from there.
      </ConfirmDialog>
    </>
  );
}
