import type { NumberFormat, TemperatureUnit, UnitSystem } from "./settings";
import { formatDecimal } from "./number-format";
import type { InfoMeasure } from "../articles/info-fields";
import { activeT } from "../../i18n/active";

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
export const speedUnit = (system: UnitSystem) => (system === "metric" ? "km/h" : activeT("common")("unit.mph"));
/** Short lengths: creature speeds and the like. */
export const shortLengthUnit = (system: UnitSystem) => (system === "metric" ? "m" : activeT("common")("unit.ft"));
export const weightUnit = (system: UnitSystem) => (system === "metric" ? "kg" : "lb");
export const volumeUnit = (system: UnitSystem) => (system === "metric" ? "L" : "gal");

export const temperatureSymbol = (unit: TemperatureUnit) => (unit === "celsius" ? "°C" : "°F");
/** Degrees Celsius to the chosen unit, and back. */
export const fromCelsius = (c: number, unit: TemperatureUnit) => (unit === "celsius" ? c : (c * 9) / 5 + 32);
export const toCelsius = (value: number, unit: TemperatureUnit) => (unit === "celsius" ? value : ((value - 32) * 5) / 9);
/** Kilometres per hour to the system's speed. */
export const fromKmh = (kmh: number, system: UnitSystem) => (system === "metric" ? kmh : kmh / KM_PER_MILE);

/** Miles (or mph) to the system's distance (or speed), and back. */
export const fromMiles = (miles: number, system: UnitSystem) => (system === "metric" ? miles * KM_PER_MILE : miles);
export const toMiles = (value: number, system: UnitSystem) => (system === "metric" ? value / KM_PER_MILE : value);

export const fromFeet = (feet: number, system: UnitSystem) => (system === "metric" ? feet * M_PER_FOOT : feet);
export const toFeet = (value: number, system: UnitSystem) => (system === "metric" ? value / M_PER_FOOT : value);

export const fromKg = (kg: number, system: UnitSystem) => (system === "metric" ? kg : kg * LB_PER_KG);
export const fromLitres = (litres: number, system: UnitSystem) => (system === "metric" ? litres : litres / L_PER_GALLON);

/** Placeholder examples for measurement info fields (free text, never converted); shown as "e.g. …". */
export const MEASURE_EXAMPLES: Record<InfoMeasure, Record<UnitSystem, string>> = {
  height: { metric: "1.80 m", imperial: "5 ft 11 in" },
  weight: { metric: "80 kg", imperial: "176 lb" },
  size: { metric: "90 cm, 2 kg", imperial: "3 ft, 4 lb" },
  elevation: { metric: "2,400 m", imperial: "7,900 ft" },
  distance: { metric: "120 km", imperial: "75 mi" },
  area: { metric: "2,500 km²", imperial: "965 sq mi" },
};

/**
 * The placeholder for a measurement field: weights follow the weight
 * setting, everything else the length one; its numbers follow the number format.
 */
export const measureExample = (measure: InfoMeasure, settings: { weightSystem: UnitSystem; lengthSystem: UnitSystem; numberFormat?: NumberFormat }) =>
  activeT("common")("unit.example", {
    value: MEASURE_EXAMPLES[measure][measure === "weight" ? settings.weightSystem : settings.lengthSystem].replace(/\d[\d,]*(?:\.\d+)?/g, (n) =>
      formatDecimal(Number(n.replace(/,/g, "")), { format: settings.numberFormat, minimumFractionDigits: n.includes(".") ? n.split(".")[1].length : 0 }),
    ),
  });
