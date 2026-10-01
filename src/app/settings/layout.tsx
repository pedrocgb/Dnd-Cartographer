import SettingsNav from "@/components/settings/SettingsNav";

export default function SettingsLayout({ children }: LayoutProps<"/settings">) {
  return (
    <div className="articles-page settings-page">
      <SettingsNav />
      <div className="articles-main">
        <div className="settings-content">{children}</div>
      </div>
    </div>
  );
}
