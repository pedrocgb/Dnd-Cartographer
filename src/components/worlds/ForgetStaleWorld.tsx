"use client";

import { useEffect } from "react";

/** Rendered when the browser's world cookie names a world that no longer exists: clears it and goes to the worlds screen. */
export default function ForgetStaleWorld() {
  useEffect(() => {
    void fetch("/api/worlds/forget", { method: "POST" }).finally(() => {
      // eslint-disable-next-line @next/next/no-location-assign-relative-destination -- a full load after the cookie changed
      window.location.assign("/worlds");
    });
  }, []);
  return null;
}
