/**
 * Skeleton loaders: shimmering placeholders in the shape of the content
 * that's on its way, so a page settles into place instead of popping in.
 * Purely visual (aria-hidden); a wrapper announces "Loading" once via
 * `role="status"`. Styles: `.skeleton*` in globals.css (the shimmer stops
 * under prefers-reduced-motion).
 */

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
export function SkeletonRegion({ label = "Loading…", className, children }: { label?: string; className?: string; children: React.ReactNode }) {
  return (
    <div className={className ? `skeleton-region ${className}` : "skeleton-region"} role="status" aria-busy="true">
      <span className="sr-only">{label}</span>
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
  return (
    <SkeletonRegion label="Loading the article…" className="article-view">
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
