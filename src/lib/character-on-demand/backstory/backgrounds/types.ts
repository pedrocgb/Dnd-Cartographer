/**
 * What each background adds to the shared tables: its clothes (`garment`,
 * `accessory`), what the character wants right now (`wants`, full sentences)
 * and extra `quirks`, `fears` and `secrets` mixed into the shared ones.
 * Any shared slot ({relation}, {deadline}, {item}, {place}…) can be used.
 */
export interface BackgroundTables {
  garment: readonly string[];
  accessory: readonly string[];
  wants: readonly string[];
  quirks: readonly string[];
  fears: readonly string[];
  secrets: readonly string[];
}
