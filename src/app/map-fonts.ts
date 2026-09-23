import {
  Inter,
  Open_Sans,
  Lato,
  Noto_Sans,
  Source_Sans_3,
  Merriweather,
  Lora,
  EB_Garamond,
  Crimson_Pro,
  Cormorant_Garamond,
  Libre_Baskerville,
  Alegreya,
  Spectral,
  Cinzel,
} from "next/font/google";

/**
 * Fonts offered by the map Text tool — all SIL Open Font License, with the
 * latin-ext subset for accented letters. Self-hosted at build time by
 * next/font (no runtime CDN call, keeping the app usable offline) and not
 * preloaded, since only map labels use them. Each exposes a CSS variable
 * that src/server/texts/fonts.ts maps to a font key. Variable fonts cover
 * bold through their weight axis; static ones list 400 and 700.
 */
export const mapFontInter = Inter({ subsets: ["latin", "latin-ext"], preload: false, display: "swap", variable: "--map-font-inter" });
export const mapFontOpenSans = Open_Sans({ subsets: ["latin", "latin-ext"], preload: false, display: "swap", variable: "--map-font-open-sans" });
export const mapFontLato = Lato({ subsets: ["latin", "latin-ext"], preload: false, display: "swap", weight: ["400", "700"], variable: "--map-font-lato" });
export const mapFontNotoSans = Noto_Sans({ subsets: ["latin", "latin-ext"], preload: false, display: "swap", variable: "--map-font-noto-sans" });
export const mapFontSourceSans = Source_Sans_3({ subsets: ["latin", "latin-ext"], preload: false, display: "swap", variable: "--map-font-source-sans" });
export const mapFontMerriweather = Merriweather({ subsets: ["latin", "latin-ext"], preload: false, display: "swap", variable: "--map-font-merriweather" });
export const mapFontLora = Lora({ subsets: ["latin", "latin-ext"], preload: false, display: "swap", variable: "--map-font-lora" });
export const mapFontEbGaramond = EB_Garamond({ subsets: ["latin", "latin-ext"], preload: false, display: "swap", variable: "--map-font-eb-garamond" });
export const mapFontCrimsonPro = Crimson_Pro({ subsets: ["latin", "latin-ext"], preload: false, display: "swap", variable: "--map-font-crimson-pro" });
export const mapFontCormorant = Cormorant_Garamond({ subsets: ["latin", "latin-ext"], preload: false, display: "swap", variable: "--map-font-cormorant" });
export const mapFontLibreBaskerville = Libre_Baskerville({ subsets: ["latin", "latin-ext"], preload: false, display: "swap", variable: "--map-font-libre-baskerville" });
export const mapFontAlegreya = Alegreya({ subsets: ["latin", "latin-ext"], preload: false, display: "swap", variable: "--map-font-alegreya" });
export const mapFontSpectral = Spectral({ subsets: ["latin", "latin-ext"], preload: false, display: "swap", weight: ["400", "700"], variable: "--map-font-spectral" });
export const mapFontCinzel = Cinzel({ subsets: ["latin", "latin-ext"], preload: false, display: "swap", variable: "--map-font-cinzel" });

export const mapFontVariables = [
  mapFontInter,
  mapFontOpenSans,
  mapFontLato,
  mapFontNotoSans,
  mapFontSourceSans,
  mapFontMerriweather,
  mapFontLora,
  mapFontEbGaramond,
  mapFontCrimsonPro,
  mapFontCormorant,
  mapFontLibreBaskerville,
  mapFontAlegreya,
  mapFontSpectral,
  mapFontCinzel,
]
  .map((f) => f.variable)
  .join(" ");
