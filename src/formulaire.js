export const CHAMPS_SIM = [
  "sim_total",
  "sim_structures",
  "sim_actuel",
  "sim_ecart",
  "sim_devis",
  "sim_recap"
];

const SELECTEUR_FORM = "[data-mandare-simulateur-form]";

export function remplirFormulaires(valeurs, scope = document) {
  if (!scope || !scope.querySelectorAll) return 0;
  let remplis = 0;
  scope.querySelectorAll(SELECTEUR_FORM).forEach((form) => {
    CHAMPS_SIM.forEach((champ) => {
      const input = form.querySelector(`[name="${champ}"], [data-sim="${champ}"]`);
      if (!input) return;
      input.value = valeurs[champ] === undefined ? "" : valeurs[champ];
      remplis++;
    });
  });
  return remplis;
}

export function valeursDepuisUrl(recherche) {
  const source = recherche === undefined
    ? (typeof window === "undefined" ? "" : window.location.search)
    : recherche;
  const params = new URLSearchParams(source);
  const out = {};
  CHAMPS_SIM.forEach((champ) => {
    if (params.has(champ)) out[champ] = params.get(champ);
  });
  return out;
}

export function urlPorteUneSimulation(recherche) {
  return Object.keys(valeursDepuisUrl(recherche)).length > 0;
}
