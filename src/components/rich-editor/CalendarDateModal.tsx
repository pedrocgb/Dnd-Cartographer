"use client";

import { useState } from "react";
import Link from "next/link";
import Modal from "@/components/Modal";
import WorldDatePicker from "@/components/calendars/WorldDatePicker";
import { dayLabel } from "@/components/calendars/evaluate";
import { useDefaultCalendarStatus } from "@/components/relations/use-default-calendar";
import { SkeletonList } from "../Skeleton";

/** "Link a calendar date": a date of the world's default calendar, starting at today's in-world date. */
export default function CalendarDateModal({ onPick, onClose }: { onPick: (day: number, label: string) => void; onClose: () => void }) {
  const { calendar, loading } = useDefaultCalendarStatus();
  const [day, setDay] = useState<number | null>(null);
  const picked = day ?? calendar?.currentDay ?? null;

  return (
    <Modal open onClose={onClose} title="Link a calendar date" className="rich-floating">
      {loading ? (
        <SkeletonList rows={2} label="Loading the calendar…" />
      ) : !calendar ? (
        <p className="field-label">
          There&rsquo;s no calendar yet. <Link href="/calendars">Create one in Calendars</Link> to link dates.
        </p>
      ) : (
        <form
          className="new-map-form calendar-date-form"
          onSubmit={(e) => {
            e.preventDefault();
            if (picked !== null) onPick(picked, dayLabel(calendar.def, picked, { weekday: false }));
          }}
        >
          <WorldDatePicker def={calendar.def} label="Date" value={picked} currentDay={calendar.currentDay} onChange={setDay} />
          <p className="field-label">Clicking the date in the text opens that day in Calendars.</p>
          <div className="confirm-dialog-actions">
            <button type="button" className="btn btn-sm" onClick={onClose}>
              Cancel
            </button>
            <button type="submit" className="btn btn-sm btn-primary" disabled={picked === null}>
              Insert date
            </button>
          </div>
        </form>
      )}
    </Modal>
  );
}
