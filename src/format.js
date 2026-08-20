export const NBSP = "\u202F";

export function fmt(n) {
  const r = Math.round(n * 100) / 100;
  const neg = r < 0;
  const abs = Math.abs(r);
  const entier = Math.floor(abs);
  const cents = Math.round((abs - entier) * 100);
  let s = entier.toLocaleString("fr-FR").replace(/\s/g, NBSP);
  if (cents > 0) s += "," + String(cents).padStart(2, "0");
  return (neg ? "\u2212" : "") + s + NBSP + "€";
}

export const MOIS_FR = [
  "janvier", "février", "mars", "avril", "mai", "juin",
  "juillet", "août", "septembre", "octobre", "novembre", "décembre"
];

export function dateFr(d) {
  return (d.getDate() === 1 ? "1er" : d.getDate()) + " " + MOIS_FR[d.getMonth()] + " " + d.getFullYear();
}

export function plur(n, sing, plural) {
  return n + " " + (n > 1 ? plural : sing);
}

export function esc(value) {
  return String(value == null ? "" : value)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}
