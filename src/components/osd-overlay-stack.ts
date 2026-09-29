/**
 * Stacking for the map's OSD overlays. OSD wraps every overlay element in its
 * own `.openseadragon-overlay-wrapper` div, and that wrapper — not our element
 * — is what gets positioned (with a transform, see
 * osd-overlay-position-fix.ts), stacked and hit-tested. So z-index and
 * pointer-events have to go on the wrapper: set on our element they stay
 * trapped inside the wrapper's own stacking context, and an invisible
 * full-map wrapper on top swallows every click meant for the layers below.
 */
export const OVERLAY_Z = {
  grid: 1,
  zones: 2,
  lines: 3,
  texts: 4,
  markers: 5,
  // Selection tool hover box, above every item it can outline.
  selection: 6,
  hoveredMarker: 1000,
} as const;

/**
 * For the full-map SVG layers: stack the wrapper and make it click-through;
 * the SVG elements inside opt back in (pointer-events auto/all/stroke)
 * exactly where they need input. Call right after `viewer.addOverlay` — OSD
 * creates the wrapper synchronously there.
 */
export function stackFullMapOverlay(element: HTMLElement, zIndex: number) {
  const wrapper = element.parentElement;
  if (!wrapper) return;
  wrapper.style.zIndex = String(zIndex);
  wrapper.style.pointerEvents = "none";
}

/** Class every full-map layer carries; `.osd-animating .full-map-overlay` promotes it during pan/zoom. */
export const FULL_MAP_OVERLAY_CLASS = "full-map-overlay";

const disposers = new WeakMap<HTMLElement, () => void>();

/**
 * A layer shrunk below this during an animation is re-laid-out at its current
 * size, but only while it is much bigger than the viewer (`BIG_LAYER_VIEWERS`
 * widths): shrinking such a close-up layer flashes as the browser re-rasters
 * it tile by tile. Every other re-layout waits for the motion to settle —
 * each one re-rasters the whole layer (curved text costs several frames).
 */
const MIN_ANIMATED_SCALE = 0.5;
const BIG_LAYER_VIEWERS = 2;

/**
 * Adds a full-map SVG layer as an OSD overlay that is *scaled* while the
 * viewer animates and only re-laid-out when the motion settles.
 *
 * OSD's default Rect overlay sets the element's width/height in screen pixels
 * on every animation frame, so the SVG's viewport changes size each frame and
 * the browser re-rasterizes every path, dash, text and filter per frame — the
 * dominant cost when the whole map is on screen. Here, during an animation,
 * the element keeps the size it had when the animation started and OSD's
 * per-frame update becomes a translate+scale transform, which the compositor
 * applies to the already rasterized layer (see MapWorkspace's `osd-animating`
 * toggle). When the animation finishes the element is resized to its real
 * screen size with no scale, so the content re-rasterizes crisp once and
 * `vector-effect: non-scaling-stroke` (which ignores CSS transforms on HTML
 * ancestors) is exact again at rest.
 */
/**
 * `fixedSize`: the element keeps the map frame's size in CSS pixels forever
 * and is only ever scaled. For layers whose re-layout is what's expensive
 * (curved text: every glyph laid out along its path, ~15 ms per resize), a
 * scale costs nothing to lay out. Its `--overlay-scale` (screen px per frame
 * px, updated when the motion settles) stands in for non-scaling strokes.
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function addFullMapOverlay(viewer: any, element: HTMLElement, zIndex: number, { fixedSize = false } = {}) {
  const tiledImage = viewer.world.getItemAt(0);
  type P = { x: number; y: number };
  let last: { position: P; size: P } | null = null;
  let base: P | null = null;
  let animating = false;
  const frame: P | null = fixedSize ? tiledImage.getContentSize() : null;
  if (frame) {
    element.style.width = `${frame.x}px`;
    element.style.height = `${frame.y}px`;
  }

  function applyFixed(f: P) {
    if (!last) return;
    const sx = last.size.x / f.x;
    element.style.transform = `translate(${last.position.x}px, ${last.position.y}px) scale(${sx}, ${last.size.y / f.y})`;
    if (!animating) element.style.setProperty("--overlay-scale", String(sx));
  }

  function apply() {
    if (frame) return applyFixed(frame);
    if (!last) return;
    const drift = base && base.x ? last.size.x / base.x : 1;
    const bigLayer = Boolean(base && base.x > BIG_LAYER_VIEWERS * (viewer.container?.clientWidth || Infinity));
    if (!animating || !base || (bigLayer && drift < MIN_ANIMATED_SCALE)) {
      base = last.size;
      element.style.width = `${base.x}px`;
      element.style.height = `${base.y}px`;
    }
    const sx = base.x ? last.size.x / base.x : 1;
    const sy = base.y ? last.size.y / base.y : 1;
    element.style.transform =
      sx === 1 && sy === 1
        ? `translate(${last.position.x}px, ${last.position.y}px)`
        : `translate(${last.position.x}px, ${last.position.y}px) scale(${sx}, ${sy})`;
  }

  const onStart = () => {
    animating = true;
  };
  const onFinish = () => {
    animating = false;
    apply();
  };

  element.classList.add(FULL_MAP_OVERLAY_CLASS);
  element.style.position = "absolute";
  element.style.left = "0px";
  element.style.top = "0px";
  element.style.transformOrigin = "0 0";
  viewer.addHandler("animation-start", onStart);
  viewer.addHandler("animation-finish", onFinish);
  viewer.addOverlay({
    element,
    location: tiledImage.getBounds(true),
    checkResize: false,
    onDraw: (position: P, size: P) => {
      last = { position: { x: position.x, y: position.y }, size: { x: size.x, y: size.y } };
      apply();
    },
  });
  const wrapper = element.parentElement;
  if (wrapper) {
    wrapper.style.position = "absolute";
    wrapper.style.left = "0px";
    wrapper.style.top = "0px";
    wrapper.style.width = "0px";
    wrapper.style.height = "0px";
  }
  stackFullMapOverlay(element, zIndex);
  disposers.set(element, () => {
    viewer.removeHandler("animation-start", onStart);
    viewer.removeHandler("animation-finish", onFinish);
  });
}

/** Counterpart of addFullMapOverlay: removes the overlay and its animation handlers. */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function removeFullMapOverlay(viewer: any, element: HTMLElement) {
  disposers.get(element)?.();
  disposers.delete(element);
  viewer?.removeOverlay(element);
}
