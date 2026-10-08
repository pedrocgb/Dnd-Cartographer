"use client";

import { useState } from "react";
import Link from "next/link";
import Modal from "@/components/Modal";
import WorldDatePicker from "@/components/calendars/WorldDatePicker";
import { dayLabel } from "@/components/calendars/evaluate";
import { useDefaultCalendarStatus } from "@/components/relations/use-default-calendar";
import { SkeletonList } from "../Skeleton";
import { useT } from "@/i18n/useT";

/** "Link a calendar date": a date of the world's default calendar, starting at today's in-world date. */
export default function CalendarDateModal({ onPick, onClose }: { onPick: (day: number, label: string) => void; onClose: () => void }) {
  const t = useT("editor");
  const tc = useT("common");
  const { calendar, loading } = useDefaultCalendarStatus();
  const [beforeLink, afterLink] = t("calendarDate.none").split("{link}");
  const [day, setDay] = useState<number | null>(null);
  const picked = day ?? calendar?.currentDay ?? null;

  return (
    <Modal open onClose={onClose} title={t("calendarDate.title")} className="rich-floating">
      {loading ? (
        <SkeletonList rows={2} label={t("calendarDate.loading")} />
      ) : !calendar ? (
        <p className="field-label">
          {beforeLink}
          <Link href="/calendars">{t("calendarDate.createLink")}</Link>
          {afterLink}
        </p>
      ) : (
        <form
          className="new-map-form calendar-date-form"
          onSubmit={(e) => {
            e.preventDefault();
            if (picked !== null) onPick(picked, dayLabel(calendar.def, picked, { weekday: false }));
          }}
        >
          <WorldDatePicker def={calendar.def} label={t("calendarDate.date")} value={picked} currentDay={calendar.currentDay} onChange={setDay} />
          <p className="field-label">{t("calendarDate.hint")}</p>
          <div className="confirm-dialog-actions">
            <button type="button" className="btn btn-sm" onClick={onClose}>
              {tc("cancel")}
            </button>
            <button type="submit" className="btn btn-sm btn-primary" disabled={picked === null}>
              {t("calendarDate.insert")}
            </button>
          </div>
        </form>
      )}
    </Modal>
  );
}
