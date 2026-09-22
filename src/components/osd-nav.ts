import type OpenSeadragonType from "openseadragon";

/**
 * Disables OpenSeadragon's own mouse navigation (click-drag pan, click-to-
 * zoom, and scroll-to-zoom together — `viewer.setMouseNavEnabled` is an
 * all-or-nothing switch, not per-gesture) while our own overlay handles a
 * drag (a marker drag, a zone move/resize/vertex-drag/draw).
 *
 * A narrower attempt — toggling only `gestureSettingsMouse.dragToPan` so
 * scroll-zoom could stay independently enabled — looked promising (OSD reads
 * that flag fresh on every drag/scroll event) but regressed real dragging:
 * leaving OSD's tracker "tracking: true" (only its *pan application* gated
 * off) still let it participate in the same mousedown/mousemove/mouseup
 * sequence our own window-level listeners rely on, breaking zone
 * resize/move and — since the middle-mouse-pan handler is just another
 * window-level listener — even unrelated custom panning. Full
 * `setMouseNavEnabled(false)` (tracker fully off) is what's actually
 * reliable here.
 *
 * That leaves scroll-wheel zoom genuinely unavailable while nav is off, so
 * MapWorkspace runs its own independent wheel-zoom handler (see
 * `useWheelZoomBypass` there) that activates only when nav is disabled —
 * mirroring the same bypass approach already used for middle-mouse pan.
 */
export function setOsdNavEnabled(viewer: OpenSeadragonType.Viewer | null | undefined, enabled: boolean) {
  viewer?.setMouseNavEnabled(enabled);
}
