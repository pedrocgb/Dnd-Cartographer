"use client";

/** An on/off switch (a checkbox with role="switch"), label to its right. */
export default function Toggle({ checked, onChange, label, disabled }: { checked: boolean; onChange: (v: boolean) => void; label: string; disabled?: boolean }) {
  return (
    <label className="cel-toggle cel-toggle-inline">
      <input type="checkbox" role="switch" checked={checked} disabled={disabled} onChange={(e) => onChange(e.target.checked)} />
      <span className="cel-toggle-track" aria-hidden>
        <span className="cel-toggle-thumb" />
      </span>
      <span>{label}</span>
    </label>
  );
}
