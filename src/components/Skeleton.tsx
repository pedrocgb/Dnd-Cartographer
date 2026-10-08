"use client";

/**
 * Skeleton loaders: shimmering placeholders in the shape of the content
 * that's on its way, so a page settles into place instead of popping in.
 * Purely visual (aria-hidden); a wrapper announces "Loading" once via
 * `role="status"`. Styles: `.skeleton*` in globals.css (the shimmer stops
 * under prefers-reduced-motion).
 */

import { X, type LucideIcon } from "lucide-react";
import { useT } from "@/i18n/useT";

type Size = number | string;
const px = (v: Size | undefined) => (typeof v === "number" ? `${v}px` : v);

/** One shimmering block. */
export function Skeleton({ width, height = 12, radius, className }: { width?: Size; height?: Size; radius?: Size; className?: string }) {
  return <span className={className ? `skeleton ${className}` : "skeleton"} aria-hidden style={{ width: px(width), height: px(height), borderRadius: px(radius) }} />;
}

/** Paragraph-like lines; the last one shorter. */
export function SkeletonText({ lines = 3, className }: { lines?: number; className?: string }) {
  return (
    <span className={className ? `skeleton-text ${className}` : "skeleton-text"} aria-hidden>
      {Array.from({ length: lines }, (_, i) => (
        <Skeleton key={i} width={i === lines - 1 && lines > 1 ? "62%" : "100%"} />
      ))}
    </span>
  );
}

/** A labelled loading region: screen readers hear "Loading…", sighted users see the shapes. */
export function SkeletonRegion({ label, className, children }: { label?: string; className?: string; children: React.ReactNode }) {
  const t = useT("common");
  return (
    <div className={className ? `skeleton-region ${className}` : "skeleton-region"} role="status" aria-busy="true">
      <span className="sr-only">{label ?? t("loading")}</span>
      {children}
    </div>
  );
}

/** Rows of a list (sidebar folders, link lists, panels). */
export function SkeletonList({ rows = 4, label, avatar = false }: { rows?: number; label?: string; avatar?: boolean }) {
  const widths = ["72%", "55%", "84%", "64%", "78%", "48%"];
  return (
    <SkeletonRegion label={label} className="skeleton-list">
      {Array.from({ length: rows }, (_, i) => (
        <span key={i} className="skeleton-list-row">
          {avatar && <Skeleton width={22} height={22} radius="50%" />}
          <Skeleton width={widths[i % widths.length]} />
        </span>
      ))}
    </SkeletonRegion>
  );
}

/** The article page's shape: title, image and info cards, then the body card. */
export function ArticleSkeleton() {
  const t = useT("common");
  return (
    <SkeletonRegion label={t("loadingArticle")} className="article-view">
      <Skeleton width="38%" height={30} radius={8} />
      <div className="article-top">
        <div className="article-card skeleton-card">
          <Skeleton height={220} radius={10} />
        </div>
        <div className="article-card skeleton-card">
          <Skeleton width={110} height={14} />
          {[0, 1, 2, 3, 4].map((i) => (
            <span key={i} className="skeleton-info-row">
              <Skeleton width="28%" />
              <Skeleton width={`${40 + ((i * 17) % 35)}%`} />
            </span>
          ))}
        </div>
      </div>
      <div className="article-card skeleton-card">
        <Skeleton width={90} height={14} />
        <SkeletonText lines={5} />
      </div>
    </SkeletonRegion>
  );
}

/** A sidebar + main page still loading: session cards, or a month grid for the calendars. */
export function PageSkeleton({ label, main }: { label: string; main: "cards" | "grid" }) {
  return (
    <div className="articles-page">
      <aside className="articles-sidebar" aria-hidden>
        <Skeleton width="60%" height={16} />
        <SkeletonList rows={5} label="" />
      </aside>
      <div className="articles-main">
        <SkeletonRegion label={label} className="skeleton-page-main">
          <Skeleton width="32%" height={26} radius={8} />
          {main === "cards" ? (
            <div className="skeleton-cards">
              {[0, 1, 2, 3].map((i) => (
                <div key={i} className="article-card skeleton-card skeleton-session-card">
                  <Skeleton width={44} height={44} radius={8} />
                  <span className="skeleton-text">
                    <Skeleton width="55%" height={14} />
                    <Skeleton width="80%" />
                    <Skeleton width="40%" />
                  </span>
                </div>
              ))}
            </div>
          ) : (
            <div className="skeleton-grid">
              {Array.from({ length: 35 }, (_, i) => (
                <Skeleton key={i} height={72} radius={6} />
              ))}
            </div>
          )}
        </SkeletonRegion>
      </div>
    </div>
  );
}

/** The worlds screen still loading: its header, then world cards (banner, badge, name, text, counts). */
export function WorldsSkeleton() {
  const t = useT("common");
  return (
    <SkeletonRegion label={t("loadingWorlds")} className="worlds-page">
      <div className="worlds-header" aria-hidden>
        <Skeleton width={30} height={30} radius="50%" />
        <Skeleton width={240} height={24} radius={8} />
        <Skeleton width={420} height={12} />
      </div>
      <div className="worlds-grid" aria-hidden>
        {[0, 1, 2].map((i) => (
          <div key={i} className="world-card world-card-skeleton">
            <Skeleton className="world-card-skeleton-banner" height={96} radius={0} />
            <span className="world-card-body">
              <Skeleton width={`${50 + i * 12}%`} height={16} />
              <SkeletonText lines={2} />
              <span className="world-card-stats">
                {[0, 1, 2, 3].map((n) => (
                  <Skeleton key={n} width={58} height={10} />
                ))}
              </span>
              <Skeleton width="45%" height={10} />
            </span>
          </div>
        ))}
      </div>
    </SkeletonRegion>
  );
}

/** The map page still loading: header, the tool rail (its five groups) and the canvas. */
export function MapPageSkeleton() {
  const t = useT("common");
  return (
    <SkeletonRegion label={t("loadingMap")} className="map-page-root">
      <div className="map-header" aria-hidden>
        <Skeleton width={220} height={14} />
      </div>
      <div className="map-page-body map-skeleton-body">
        <div className="map-skeleton-rail" aria-hidden>
          {[3, 4, 3, 2, 1].map((count, group) => (
            <span key={group} className="map-skeleton-group">
              {Array.from({ length: count }, (_, i) => (
                <Skeleton key={i} width={40} height={40} radius={8} />
              ))}
            </span>
          ))}
        </div>
        <Skeleton className="map-skeleton-canvas" height="auto" radius={0} />
      </div>
    </SkeletonRegion>
  );
}

/**
 * A map tool panel whose data is still on its way: the real header (title,
 * close) in the panel's own box (`className`), list rows below.
 */
export function PanelSkeleton({
  className,
  mainClassName,
  title,
  Icon,
  onClose,
  rows = 5,
}: {
  className: string;
  /** The panel's inner column, for panels that have one ("zones-panel-main"). */
  mainClassName?: string;
  title: string;
  /** The panel's own header icon. */
  Icon?: LucideIcon;
  onClose: () => void;
  rows?: number;
}) {
  const t = useT("common");
  const body = (
    <>
      <div className="marker-side-panel-header">
        <h2>
          {Icon && <Icon size={16} strokeWidth={2.25} style={{ verticalAlign: "-2px", marginRight: "6px" }} />}
          {title}
        </h2>
        <button className="btn btn-ghost btn-icon" onClick={onClose} aria-label={t("closePanel", { title: title.toLowerCase() })}>
          <X size={16} strokeWidth={2.25} />
        </button>
      </div>
      <SkeletonList rows={rows} label={t("loadingNamed", { title: title.toLowerCase() })} />
    </>
  );
  return <div className={className}>{mainClassName ? <div className={mainClassName}>{body}</div> : body}</div>;
}
