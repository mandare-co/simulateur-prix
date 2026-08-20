import { NBSP, fmt } from "./format.js";

function caLabel(v) {
  return v >= 1000000
    ? (v / 1000000).toLocaleString("fr-FR", { maximumFractionDigits: 1 }) + NBSP + "M€"
    : fmt(v);
}

export function template(uid, config) {
  const id = (name) => `${uid}-${name}`;

  return `
  <div class="mdr-grid">

    <div class="mdr-config">
      <div class="mdr-progress" data-el="progress"></div>
      <div class="mdr-panel" data-el="panel"></div>
      <div class="mdr-nav" data-el="nav"></div>
    </div>

    <aside class="mdr-summary" aria-label="Récapitulatif">
      <div class="mdr-summary-inner">

        <div class="mdr-summary-flow">
        <div class="mdr-summary-top">
        <div class="mdr-total-block">
          <div class="mdr-total">
            <span class="mdr-total-prefix" data-el="totalPrefix" hidden></span>
            <span class="mdr-total-num" data-el="total">0</span>
            <span class="mdr-total-unit">€ HT <span class="mdr-total-per">par mois</span></span>
            <span class="mdr-total-year" data-el="annual"></span>
          </div>
        </div>

        <div class="mdr-breakdown" data-el="breakdown"></div>
        </div>

        </div>

        <div class="mdr-summary-bottom">
          <p class="mdr-foot">Sans engagement.</p>
          <a class="mdr-cta" data-el="cta" href="#">Commencer</a>
        </div>
      </div>
    </aside>

  </div>`;
}

export function comparaisonStep(uid, config, state) {
  const actifs = config.comparaison.postes.filter((p) => state.postesActifs.includes(p.id));
  const restants = config.comparaison.postes.filter((p) => !state.postesActifs.includes(p.id));

  const ligne = (poste) => `
    <div class="mdr-poste">
      <label class="mdr-poste-label" for="${uid}-${poste.id}" title="${poste.hint}">${poste.label}</label>
      <div class="mdr-input-euro">
        <input type="number" id="${uid}-${poste.id}" data-cout="${poste.id}" class="mdr-input mdr-input--sm"
               min="0" step="10" placeholder="0" inputmode="numeric"
               value="${state.actuel[poste.id] > 0 ? state.actuel[poste.id] : ""}">
        <span class="mdr-input-suffix">€ par mois</span>
      </div>
      <button type="button" class="mdr-poste-remove" data-poste-remove="${poste.id}"
              aria-label="Retirer ${poste.label}">×</button>
    </div>`;

  const ajout = (poste) => `
    <button type="button" class="mdr-chip" data-poste-add="${poste.id}">+ ${poste.label}</button>`;

  return `
    <div class="mdr-block">
      <div class="mdr-block-title">Ce que vous payez aujourd'hui</div>
      <div class="mdr-postes">${actifs.map(ligne).join("")}</div>
      ${restants.length ? `<div class="mdr-chips">${restants.map(ajout).join("")}</div>` : ""}
      <div class="mdr-compare-result" data-el="compare"></div>
    </div>`;
}

export function migrationStep(uid) {
  const champ = (id, label, hint) => `
    <div class="mdr-date-field">
      <label class="mdr-label" for="${uid}-${id}">${label}</label>
      <span class="mdr-hint">${hint}</span>
      <input type="date" id="${uid}-${id}" data-el="${id}" class="mdr-input mdr-date">
    </div>`;

  return `
    <div class="mdr-dates">
      ${champ("exerciceDebut", "Début de l'exercice", "Exercice comptable en cours.")}
      ${champ("exerciceFin", "Fin de l'exercice", "Date de clôture.")}
      ${champ("demarrage", "Démarrage", "Votre arrivée chez Mandare.")}
    </div>
    <div class="mdr-mig-months" data-el="months"></div>
    <p class="mdr-mig-alerte" data-el="alerte" hidden>
      La date de démarrage se situe hors de l'exercice déclaré.
    </p>
    <div class="mdr-reprise-list" data-el="repriseList"></div>
    <div class="mdr-mig-fec">
      <svg class="mdr-fec-ic" width="15" height="15" viewBox="0 0 11 11" aria-hidden="true"><path d="M2 5.5l2.2 2.2L9 3" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"/></svg>
      <span><b>Reprise comptable offerte</b> si votre cabinet transmet un fichier FEC propre et à jour.</span>
    </div>
    <ul class="mdr-migration" data-el="migration"></ul>`;
}

export function caBlock(uid, config, soc) {
  return `
    <div class="mdr-field mdr-field--stack" data-el="caBlock">
      <div class="mdr-field-text">
        <label class="mdr-label" for="${uid}-ca">Chiffre d'affaires annuel</label>
        <span class="mdr-hint" data-el="caSupp">Aucun supplément en dessous d'1${NBSP}M€.</span>
      </div>
      <output class="mdr-ca-value" data-el="caValue">${fmt(soc.ca)}</output>
      <input type="range" id="${uid}-ca" data-el="ca" class="mdr-range" min="0" max="${config.caMax}" step="100000" value="${soc.ca}"
             aria-label="Chiffre d'affaires annuel">
      <div class="mdr-range-scale"><span>0${NBSP}€</span><span>${caLabel(config.caMax)}</span></div>
    </div>`;
}
