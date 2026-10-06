import ToolsNav from "@/components/tools/ToolsNav";

export default function ToolsLayout({ children }: LayoutProps<"/tools">) {
  return (
    <div className="articles-page settings-page tools-page">
      <ToolsNav />
      <div className="articles-main">
        <div className="settings-content">{children}</div>
      </div>
    </div>
  );
}
