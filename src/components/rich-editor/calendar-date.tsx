"use client";

import { Node, mergeAttributes } from "@tiptap/core";
import { NodeViewWrapper, ReactNodeViewRenderer, type ReactNodeViewProps } from "@tiptap/react";
import { CalendarDays } from "lucide-react";
import { dayLabel } from "@/components/calendars/evaluate";
import { useDefaultCalendarStatus } from "@/components/relations/use-default-calendar";

export const calendarDayHref = (day: number) => `/calendars?day=${day}`;

declare module "@tiptap/core" {
  interface Commands<ReturnType> {
    calendarDate: {
      /** Inserts a link to a world day where the selection is. */
      insertCalendarDate: (attrs: { day: number; label: string }) => ReturnType;
    };
  }
}

/** The date as the world's default calendar writes it today (format or calendar may have changed), else the saved label. */
function CalendarDateView({ node }: ReactNodeViewProps) {
  const { day, label } = node.attrs as { day: number; label: string };
  const { calendar } = useDefaultCalendarStatus();
  const text = calendar ? dayLabel(calendar.def, day, { weekday: false }) : label;
  return (
    <NodeViewWrapper as="a" href={calendarDayHref(day)} className="rx-calendar-date" data-calendar-date="" data-day={day} contentEditable={false} draggable={false}>
      <CalendarDays size={13} strokeWidth={2.25} aria-hidden />
      {text}
    </NodeViewWrapper>
  );
}

/**
 * A calendar date in the text: an inline atom linking to that world day in
 * Calendars. Inserted from the "/" menu or the selection toolbar; `label` is
 * the date as written when it was picked (shown until the calendar loads,
 * and used for search).
 */
export const CalendarDate = Node.create({
  name: "calendarDate",
  group: "inline",
  inline: true,
  atom: true,
  selectable: true,
  addAttributes() {
    return {
      day: {
        default: 0,
        parseHTML: (el) => Number(el.getAttribute("data-day")) || 0,
        renderHTML: (attrs) => ({ "data-day": String(attrs.day) }),
      },
      label: {
        default: "",
        parseHTML: (el) => el.textContent ?? "",
        renderHTML: () => ({}),
      },
    };
  },
  parseHTML() {
    return [{ tag: "a[data-calendar-date]" }];
  },
  renderHTML({ node, HTMLAttributes }) {
    return ["a", mergeAttributes(HTMLAttributes, { "data-calendar-date": "", class: "rx-calendar-date", href: calendarDayHref(node.attrs.day) }), node.attrs.label];
  },
  renderText({ node }) {
    return node.attrs.label;
  },
  addNodeView() {
    return ReactNodeViewRenderer(CalendarDateView, { as: "span" });
  },
  addCommands() {
    return {
      insertCalendarDate:
        (attrs) =>
        ({ chain }) =>
          chain()
            .insertContent([
              { type: this.name, attrs },
              { type: "text", text: " " },
            ])
            .run(),
    };
  },
});
