import he from "./he";
import en from "./en";
import type { Dictionary } from "./he";

export type Locale = "he" | "en";

const dictionaries: Record<Locale, Dictionary> = { he, en };

export function getDictionary(locale: Locale): Dictionary {
  return dictionaries[locale] ?? dictionaries.he;
}

export function dirFor(locale: Locale): "rtl" | "ltr" {
  return locale === "he" ? "rtl" : "ltr";
}
