export function softwareLabel(value, fallback = "") {
  const text = String(value ?? "").trim();
  if (!text) return fallback;

  return text
    .replace(/Python Projects?/gi, "Python Software")
    .replace(/Engineering Projects?/gi, "Software")
    .replace(/Final[- ]?Year/gi, "Software")
    .replace(/Diploma(?:\s*\/\s*Mini)?(?:\s+Projects?)?/gi, "Small Software")
    .replace(/Mini Projects?/gi, "Small Software")
    .replace(/Engineering/gi, "Small Software")
    .replace(/Projects?/gi, "Software")
    .replace(/Students?/gi, "Users");
}
