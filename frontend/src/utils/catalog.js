// Supports plain arrays and DRF-style paginated { results: [] } responses.
export function toList(data) {
  if (Array.isArray(data)) return data;
  if (data && Array.isArray(data.results)) return data.results;
  return [];
}

export function scrollToId(id) {
  document
    .getElementById(id)
    ?.scrollIntoView({ behavior: "smooth", block: "start" });
}

export function formatPrice(value) {
  const number = Number(value);
  if (Number.isNaN(number)) return `₹${value}`;
  return `₹${number.toLocaleString("en-IN")}`;
}
