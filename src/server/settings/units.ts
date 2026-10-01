import type { NumberFormat, UnitSystem } from "./settings";
import { formatDecimal } from "./number-format";
import type { InfoMeasure } from "../articles/info-fields";

/**
 * Display conversions for the unit settings. Values are stored in their
 * native unit (travel math in miles, mph and feet; supplies in kg and L) and
 * only converted for display or input.
 */
const KM_PER_MILE = 1.609344;
const M_PER_FOOT = 0.3048;
const LB_PER_KG = 2.2046226218;
const L_PER_GALLON = 3.785411784;

/** For inputs: two decimals, so typing a value and converting it back shows the same number. */
export const roundForInput = (n: number) => Math.round(n * 100) / 100;

export const distanceUnit = (system: UnitSystem) => (system === "metric" ? "km" : "mi");
export const speedUnit = (system: UnitSystem) => (system === "metric" ? "km/h" : "mph");
/** Short lengths: creature speeds and the like. */
export const shortLengthUnit = (system: UnitSystem) => (system === "metric" ? "m" : "ft.");
export const weightUnit = (system: UnitSystem) => (system === "metric" ? "kg" : "lb");
export const volumeUnit = (system: UnitSystem) => (system === "metric" ? "L" : "gal");

/** Miles (or mph) to the system's distance (or speed), and back. */
export const fromMiles = (miles: number, system: UnitSystem) => (system === "metric" ? miles * KM_PER_MILE : miles);
export const toMiles = (value: number, system: UnitSystem) => (system === "metric" ? value / KM_PER_MILE : value);

export const fromFeet = (feet: number, system: UnitSystem) => (system === "metric" ? feet * M_PER_FOOT : feet);
export const toFeet = (value: number, system: UnitSystem) => (system === "metric" ? value / M_PER_FOOT : value);

export const fromKg = (kg: number, system: UnitSystem) => (system === "metric" ? kg : kg * LB_PER_KG);
export const fromLitres = (litres: number, system: UnitSystem) => (system === "metric" ? litres : litres / L_PER_GALLON);

/** Placeholder examples for measurement info fields (free text, never converted). */
export const MEASURE_EXAMPLES: Record<InfoMeasure, Record<UnitSystem, string>> = {
  height: { metric: "e.g. 1.80 m", imperial: "e.g. 5 ft 11 in" },
  weight: { metric: "e.g. 80 kg", imperial: "e.g. 176 lb" },
  size: { metric: "e.g. 90 cm, 2 kg", imperial: "e.g. 3 ft, 4 lb" },
  elevation: { metric: "e.g. 2,400 m", imperial: "e.g. 7,900 ft" },
  distance: { metric: "e.g. 120 km", imperial: "e.g. 75 mi" },
  area: { metric: "e.g. 2,500 km²", imperial: "e.g. 965 sq mi" },
};

/**
 * The placeholder for a measurement field: weights follow the weight
 * setting, everything else the length one; its numbers follow the number format.
 */
export const measureExample = (measure: InfoMeasure, settings: { weightSystem: UnitSystem; lengthSystem: UnitSystem; numberFormat?: NumberFormat }) =>
  MEASURE_EXAMPLES[measure][measure === "weight" ? settings.weightSystem : settings.lengthSystem].replace(/\d[\d,]*(?:\.\d+)?/g, (n) =>
    formatDecimal(Number(n.replace(/,/g, "")), { format: settings.numberFormat, minimumFractionDigits: n.includes(".") ? n.split(".")[1].length : 0 }),
  );
