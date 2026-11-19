/**
 * Converts a string into snake_case.
 * Handles kebab-case, camelCase, PascalCase, and spaced words.
 */
export function toSnakeCase(str: string): string {
  return str
    .replace(/([a-z0-9])([A-Z])/g, "$1_$2")
    .replace(/[-\s]+/g, "_")
    .toLowerCase();
}

/**
 * Converts a snake_case, kebab-case, or camelCase identifier into human-readable Title Case words.
 * Handles common abbreviations like "id" -> "ID".
 */
export function toTitleCase(str: string): string {
  if (str.toLowerCase() === "id") {
    return "ID";
  }

  // Strip trailing _id or Id for labels if needed
  let cleaned = str;
  if (cleaned.endsWith("_id")) {
    cleaned = cleaned.slice(0, -3);
  } else if (cleaned.endsWith("Id") && cleaned.length > 2) {
    cleaned = cleaned.slice(0, -2);
  }

  const words = cleaned
    .replace(/([a-z0-9])([A-Z])/g, "$1 $2")
    .replace(/[_-]+/g, " ")
    .trim()
    .split(/\s+/);

  return words
    .map((word) => {
      const lower = word.toLowerCase();
      if (lower === "id") return "ID";
      if (lower === "url") return "URL";
      if (lower === "api") return "API";
      if (lower === "ui") return "UI";
      return word.charAt(0).toUpperCase() + word.slice(1).toLowerCase();
    })
    .join(" ");
}

/**
 * Basic pluralization for English nouns.
 */
export function pluralize(noun: string): string {
  if (noun.endsWith("s") && !noun.endsWith("ss")) {
    return noun;
  }
  if (noun.endsWith("y") && !/[aeiou]y$/i.test(noun)) {
    return noun.slice(0, -1) + "ies";
  }
  if (noun.endsWith("ss") || noun.endsWith("x") || noun.endsWith("z") || noun.endsWith("ch") || noun.endsWith("sh")) {
    return noun + "es";
  }
  return noun + "s";
}

/**
 * Basic singularization for English nouns.
 */
export function singularize(noun: string): string {
  if (noun.endsWith("ies")) {
    return noun.slice(0, -3) + "y";
  }
  if (noun.endsWith("es") && (noun.endsWith("shes") || noun.endsWith("ches") || noun.endsWith("xes") || noun.endsWith("sses"))) {
    return noun.slice(0, -2);
  }
  if (noun.endsWith("s") && !noun.endsWith("ss")) {
    return noun.slice(0, -1);
  }
  return noun;
}

/**
 * Converts a verb into its past tense form for toast notifications.
 */
export function toPastTense(verb: string): string {
  const v = verb.toLowerCase();
  if (v.endsWith("e")) return v + "d";
  if (v.endsWith("y") && !/[aeiou]y$/i.test(v)) return v.slice(0, -1) + "ied";
  return v + "ed";
}
