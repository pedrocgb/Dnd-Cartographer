/**
 * OpenSeadragon positions every overlay via `style.left`/`style.top` (see
 * `$.Overlay.prototype.drawHTML` in node_modules/openseadragon — v6.1.1 at
 * the time this was written, around line 22943). Browsers round fractional
 * `left`/`top` pixel values to the nearest integer CSS pixel, but handle
 * fractional `transform: translate()` smoothly — so during any continuous
 * zoom or pan, where `viewport.pixelFromPoint()` produces a fractional
 * position every frame, the overlay visibly snaps/wobbles a pixel at a time
 * while the canvas underneath interpolates smoothly. This is a confirmed,
 * long-standing OpenSeadragon bug, not something wrong in this app's own
 * code: https://github.com/openseadragon/openseadragon/issues/1474 — a
 * maintainer-endorsed community fix (switch to `transform: translate()`)
 * has sat unmerged since 2018 because nobody ever sent the PR.
 *
 * This reproduces that fix by replacing `drawHTML` with a copy of the
 * installed version's implementation, changed only in how position is
 * applied (translate instead of left/top — composed with the rotate/scale
 * transform OSD already applies for rotated or flipped viewports, since
 * `translate() rotate()` in one `transform` list is equivalent to
 * positioning via left/top and then rotating in place). Everything else —
 * container attachment, sizing, the `checkResize`-driven size cache, the
 * `onDraw` override escape hatch — is untouched.
 *
 * If `openseadragon` is ever upgraded, diff this against the new
 * `Overlay.prototype.drawHTML` before assuming it still applies —
 * silently skips patching (falling back to OSD's own jittery-but-working
 * behavior) if the shape of `Overlay.prototype` doesn't look like what
 * this was written against, rather than risk breaking overlay positioning
 * outright.
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any -- monkeypatching private OSD internals with no public type declarations; see file comment above.
export function patchOverlayPositioning(osd: any): void {
  const proto = osd?.Overlay?.prototype;
  if (!proto || typeof proto.drawHTML !== "function" || typeof proto._getOverlayPositionAndSize !== "function") {
    return;
  }
  if (proto.__markerAppPositionFixApplied) return;
  proto.__markerAppPositionFixApplied = true;

  // eslint-disable-next-line @typescript-eslint/no-explicit-any -- OSD's internal Viewport type isn't part of the public API surface used elsewhere in this app.
  proto.drawHTML = function (container: HTMLElement, viewport: any) {
    const element = this.elementWrapper;
    if (element.parentNode !== container) {
      element.prevElementParent = element.parentNode;
      element.prevNextSibling = element.nextSibling;
      container.appendChild(element);

      // have to set position before calculating size, fix #1116
      this.style.position = "absolute";
      this.size = osd.getElementSize(this.elementWrapper);
    }

    const positionAndSize = this._getOverlayPositionAndSize(viewport);
    const position = positionAndSize.position;
    const size = (this.size = positionAndSize.size);
    let outerScale = "";
    if (viewport.overlayPreserveContentDirection) {
      outerScale = viewport.flipped ? " scaleX(-1)" : " scaleX(1)";
    }
    const rotate = viewport.flipped ? -positionAndSize.rotate : positionAndSize.rotate;
    const scale = viewport.flipped ? " scaleX(-1)" : "";

    if (this.onDraw) {
      this.onDraw(position, size, this.element);
      return;
    }

    const style = this.style;
    const innerStyle = this.element.style;
    innerStyle.display = "block";

    // The actual fix: fractional position folded into `transform` instead
    // of `style.left`/`style.top`, which is where the sub-pixel rounding
    // (and the resulting jitter) happens.
    style.left = "0px";
    style.top = "0px";
    let transform = `translate(${position.x}px, ${position.y}px)`;

    if (this.width !== null) innerStyle.width = size.x + "px";
    if (this.height !== null) innerStyle.height = size.y + "px";

    const transformOriginProp = osd.getCssPropertyWithVendorPrefix("transformOrigin");
    const transformProp = osd.getCssPropertyWithVendorPrefix("transform");
    if (transformOriginProp && transformProp) {
      if (rotate && !viewport.flipped) {
        innerStyle[transformProp] = "";
        style[transformOriginProp] = this._getTransformOrigin();
        transform += ` rotate(${rotate}deg)`;
      } else if (!rotate && viewport.flipped) {
        innerStyle[transformProp] = outerScale;
        style[transformOriginProp] = this._getTransformOrigin();
        transform += scale;
      } else if (rotate && viewport.flipped) {
        innerStyle[transformProp] = outerScale;
        style[transformOriginProp] = this._getTransformOrigin();
        transform += ` rotate(${rotate}deg)${scale}`;
      } else {
        innerStyle[transformProp] = "";
        style[transformOriginProp] = "";
      }
      style[transformProp] = transform;
    }
    style.display = "flex";
  };
}
