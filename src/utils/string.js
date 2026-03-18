export function capitalizeWords(str) {
  return str.trim().toLowerCase().replace(/\b\w/g, c => c.toUpperCase())
}
