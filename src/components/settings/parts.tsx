/** Building blocks shared by the Settings sections. */

export function SettingsHeader({ title, description, actions }: { title: string; description: string; actions?: React.ReactNode }) {
  return (
    <header className="settings-header">
      <div>
        <h1>{title}</h1>
        <p>{description}</p>
      </div>
      {actions && <div className="settings-header-actions">{actions}</div>}
    </header>
  );
}

/** A titled group of settings. */
export function SettingsCard({ title, description, children }: { title: string; description?: string; children: React.ReactNode }) {
  return (
    <section className="settings-card">
      <div className="settings-card-head">
        <h2>{title}</h2>
        {description && <p>{description}</p>}
      </div>
      <div className="settings-card-body">{children}</div>
    </section>
  );
}

/** One setting: its name and explanation on the left, the control on the right (stacked on narrow screens). */
export function SettingRow({ label, description, htmlFor, children }: { label: string; description?: string; htmlFor?: string; children: React.ReactNode }) {
  return (
    <div className="settings-row">
      <div className="settings-row-text">
        {htmlFor ? <label htmlFor={htmlFor}>{label}</label> : <span>{label}</span>}
        {description && <p>{description}</p>}
      </div>
      <div className="settings-row-control">{children}</div>
    </div>
  );
}

/** A save error under a setting (the provider already rolled the value back). */
export function SettingError({ message }: { message: string | null }) {
  return message ? (
    <p className="form-error" role="alert">
      {message}
    </p>
  ) : null;
}
