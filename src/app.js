import { NBSP, fmt, esc } from "./format.js";
import { template, migrationStep, comparaisonStep, caBlock } from "./template.js";
import {
  societeParDefaut, appsPour, accompagnementsPour, appDe, accDe, nomSociete, typeLabel,
  typeDe,
  moisAReprendre, coutReprise, periodeReprise, societesAReprendre,
  societesReprises, migrationNecessaire, productionComptable,
  palierCA, bulletins, calcul, comparaison, decisionsManquantes, resume, resumeTexte,
  accompagnementDisponible, socialDisponible,
  accompagnementPossiblePourType, socialPossiblePourType,
  volumeType, supplementTransactions, surDevis, profilPour,
  demarrageHorsExercice, finExerciceParDefaut
} from "./pricing.js";

let instanceCount = 0;

export function createSimulateur(root, config) {
  const uid = "mdr" + (++instanceCount);

  const state = {
    societes: [societeParDefaut(config, "act")],
    step: 0,
    actuel: Object.fromEntries(config.comparaison.postes.map((p) => [p.id, 0])),
    postesActifs: config.comparaison.postes.filter((p) => p.defaut).map((p) => p.id),
    migration: {
      exerciceDebut: new Date().getFullYear() + "-01-01",
      exerciceFin: new Date().getFullYear() + "-12-31",
      demarrage: ""
    }
  };

  root.classList.add("mdr-sim");
  root.innerHTML = template(uid, config);

  const el = (name) => root.querySelector('[data-el="' + name + '"]');
  const all = (selector) => Array.from(root.querySelectorAll(selector));

  const nodes = {
    progress: el("progress"), panel: el("panel"), nav: el("nav"),
    total: el("total"), totalPrefix: el("totalPrefix"),
    annual: el("annual"), breakdown: el("breakdown"),
    cta: el("cta")
  };

  function etapes() {
    return [
      {
        id: "societes",
        titre: "Votre situation",
        desc: "Indiquez vos structures à connecter à Mandare, vous les configurez ensuite."
      },
      ...state.societes.map((soc, i) => ({
        id: "soc",
        index: i,
        titre: nomSociete(soc, i, state.societes, config),
        desc: descSociete(soc)
      })),
      ...(migrationNecessaire(state, config) ? [{
        id: "migration",
        titre: "Migration",
        desc: "On reprend l'existant. Aucun frais de mise en service."
      }] : []),
      {
        id: "comparaison",
        titre: "Comparaison",
        desc: "Ce que vous payez aujourd'hui, pour mesurer l'écart."
      }
    ];
  }

  function descSociete(soc) {
    const blocs = ["plateforme"];
    if (accompagnementPossiblePourType(soc.kind, config) && accompagnementDisponible(soc, config)) {
      blocs.push("accompagnement");
    }
    if (socialPossiblePourType(soc.kind, config) && socialDisponible(soc, config)) {
      blocs.push("gestion sociale");
    }
    const liste = blocs.length > 1
      ? blocs.slice(0, -1).join(", ") + " et " + blocs[blocs.length - 1]
      : blocs[0];
    return typeLabel(soc.kind, config) + " · " + liste + ".";
  }

  function etapeCourante() {
    const liste = etapes();
    state.step = Math.max(0, Math.min(state.step, liste.length - 1));
    return liste[state.step];
  }

  function allerA(index) {
    const liste = etapes();
    state.step = Math.max(0, Math.min(index, liste.length - 1));
    renderEtape();
    if (root.getBoundingClientRect().top < 0) {
      root.scrollIntoView({ behavior: "smooth", block: "start" });
    }
  }

  const societeCourante = () => {
    const e = etapeCourante();
    return e.id === "soc" ? state.societes[e.index] : null;
  };

  function renderProgress() {
    const liste = etapes();
    const courante = etapeCourante();
    const segments = liste.map((e, i) => `
      <button type="button" class="mdr-progress-seg${i < state.step ? " is-done" : ""}${i === state.step ? " is-current" : ""}"
              data-step="${i}" title="${esc(e.titre)}" aria-label="Étape ${i + 1} : ${esc(e.titre)}"
              aria-current="${i === state.step}"></button>`).join("");

    nodes.progress.innerHTML = `
      <div class="mdr-progress-head">
        <span class="mdr-progress-title">${esc(courante.titre)}</span>
        <span class="mdr-progress-step">Étape ${state.step + 1} sur ${liste.length}</span>
      </div>
      <div class="mdr-progress-bar" role="progressbar" aria-valuemin="1" aria-valuemax="${liste.length}" aria-valuenow="${state.step + 1}">${segments}</div>
      <p class="mdr-progress-desc">${esc(courante.desc)}</p>`;
  }

  function renderNav() {
    const liste = etapes();
    const dernier = state.step >= liste.length - 1;
    const r = calcul(state, config);
    nodes.nav.innerHTML = `
      <button type="button" class="mdr-nav-btn" data-nav="prev"${state.step === 0 ? " disabled" : ""}>Précédent</button>
      <span class="mdr-nav-total"><b>${fmt(r.total)}</b> HT/mois</span>
      ${dernier ? "<span></span>"
        : `<button type="button" class="mdr-nav-btn mdr-nav-btn--primary" data-nav="next">Suivant</button>`}`;
  }

  function supplementAcc(o, app) {
    const supp = o.prix - app.prix;
    return o.prix > 0 && supp > 0 ? { ...o, prix: supp } : o;
  }

  function optionHTML(o, selectedId, group, legende = "par mois") {
    const sel = o.id === selectedId ? " is-selected" : "";
    const prix = o.prix > 0
      ? `<span class="mdr-opt-price"><b>${fmt(o.prix)}</b><span>${esc(legende)}</span></span>`
      : `<span class="mdr-opt-price"><b>${fmt(0)}</b><span>en plus</span></span>`;
    return `
      <button type="button" class="mdr-opt${sel}" data-group="${group}" data-id="${esc(o.id)}"
              aria-pressed="${o.id === selectedId}">
        <span class="mdr-radio" aria-hidden="true"></span>
        <span class="mdr-opt-body">
          <span class="mdr-opt-top"><span class="mdr-opt-name">${esc(o.nom)}</span></span>
          <span class="mdr-opt-desc">${esc(o.desc)}</span>
        </span>
        ${prix}
      </button>`;
  }

  function socialHint(soc) {
    const n = bulletins(soc, config);
    return n > 0
      ? n + " bulletin" + (n > 1 ? "s" : "") + " · " + fmt(config.social.prixBulletin) +
        " par bulletin · " + fmt(n * config.social.prixBulletin) + " par mois"
      : fmt(config.social.prixBulletin) + " HT par bulletin de paie et par mois.";
  }

  function usersHint() {
    const ph = config.prixUtilisateurSupp;
    const inc = config.utilisateursInclus;
    return ph > 0
      ? inc + " utilisateur" + (inc > 1 ? "s" : "") + " inclus, puis " + fmt(ph) + " par mois et par utilisateur."
      : "Tous les utilisateurs de cette société sont inclus.";
  }

  function stepperHTML(attr, valeur, label) {
    return `
      <div class="mdr-stepper" aria-label="${label}">
        <button type="button" class="mdr-step-btn" data-${attr}="-1" aria-label="Retirer">−</button>
        <span class="mdr-stepper-val" data-el="${attr}Val" aria-live="polite">${valeur}</span>
        <button type="button" class="mdr-step-btn" data-${attr}="1" aria-label="Ajouter">+</button>
      </div>`;
  }

  const compte = (kind) => state.societes.filter((s) => s.kind === kind).length;

  function minPourType(kind) {
    return state.societes.some((s) => s.kind !== kind) ? 0 : 1;
  }

  function setCompte(kind, delta) {
    const actuel = compte(kind);
    const cible = Math.min(config.societesMax, Math.max(minPourType(kind), actuel + delta));
    if (cible === actuel) return;

    const groupes = new Map(config.typesSociete.map((t) => [t.id, state.societes.filter((s) => s.kind === t.id)]));
    const groupe = groupes.get(kind) || [];
    if (cible > actuel) {
      for (let i = actuel; i < cible; i++) groupe.push(societeParDefaut(config, kind));
    } else {
      groupe.length = cible;
    }
    groupes.set(kind, groupe);
    state.societes = config.typesSociete.flatMap((t) => groupes.get(t.id) || []);
  }

  function compteurHTML(type) {
    const n = compte(type.id);
    return `
      <div class="mdr-field">
        <div class="mdr-field-text">
          <span class="mdr-label">${esc(type.pluriel || type.label)}</span>
          <span class="mdr-hint">${esc(type.hint)}</span>
        </div>
        <div class="mdr-stepper" aria-label="Nombre de ${esc((type.pluriel || type.label).toLowerCase())}">
          <button type="button" class="mdr-step-btn" data-count="${type.id}" data-delta="-1" aria-label="Retirer">−</button>
          <span class="mdr-stepper-val" aria-live="polite">${n}</span>
          <button type="button" class="mdr-step-btn" data-count="${type.id}" data-delta="1" aria-label="Ajouter">+</button>
        </div>
      </div>`;
  }

  function societesStepHTML() {
    return config.typesSociete.map(compteurHTML).join("");
  }

  function socStepHTML(soc, index) {
    const sansAcc = { ...config.sansAccompagnement, ...(typeDe(soc.kind, config).sansAccompagnement || {}) };
    const app = appDe(soc, config);
    const accs = accompagnementPossiblePourType(soc.kind, config) && accompagnementDisponible(soc, config)
      ? [sansAcc, ...accompagnementsPour(soc.kind, config)].map((o) => supplementAcc(o, app))
      : [];
    const socialAffiche = socialPossiblePourType(soc.kind, config) && socialDisponible(soc, config);
    return `
      <div class="mdr-panel-head">
        <label class="mdr-label" for="${uid}-nom-${index}">Nom de la ${esc(typeDe(soc.kind, config).label.toLowerCase())}</label>
        <input type="text" id="${uid}-nom-${index}" class="mdr-input mdr-name" data-nom="${index}" value="${esc(soc.nom)}"
               placeholder="${esc(nomSociete({ ...soc, nom: "" }, index, state.societes, config))}" maxlength="40">
      </div>

      <div class="mdr-block">
        <div class="mdr-block-title">Plateforme</div>
        <div class="mdr-options">
          ${appsPour(soc.kind, config).map((o) => optionHTML(o, soc.appId, "app")).join("")}
        </div>
      </div>

      ${accs.length ? `
      <div class="mdr-block">
        <div class="mdr-block-title">Accompagnement</div>
        <p class="mdr-block-desc">${esc(config.accompagnementPerimetre)}</p>
        <div class="mdr-options">
          ${accs.map((o) => optionHTML(o, soc.accId, "acc", "en plus")).join("")}
        </div>
      </div>` : ""}

      ${volumeHTML(soc, index)}

      ${socialAffiche ? `
      <div class="mdr-block">
        <div class="mdr-block-title">${esc(config.social.titre)}</div>
        <p class="mdr-block-desc">${esc(config.social.perimetre)}</p>
        <div class="mdr-field">
          <div class="mdr-field-text">
            <span class="mdr-label">Salariés</span>
            <span class="mdr-hint" data-el="socialHint">${esc(socialHint(soc))}</span>
          </div>
          ${stepperHTML("sal", soc.nbSalaries, "Nombre de salariés")}
        </div>
      </div>` : ""}

      <div class="mdr-block">
        <div class="mdr-block-title">Utilisateurs</div>
        <div class="mdr-field">
          <div class="mdr-field-text">
            <span class="mdr-label">Accès à la plateforme</span>
            <span class="mdr-hint">${esc(usersHint())}</span>
          </div>
          ${stepperHTML("users", soc.nbUsers, "Nombre d'utilisateurs")}
        </div>
      </div>`;
  }

  function volumeHTML(soc, index) {
    const mesure = volumeType(soc, config);
    if (!mesure) return "";
    const t = config.pilotageTransactions;

    if (mesure === "ca") {
      return `
      <div class="mdr-block" data-el="volume">
        <div class="mdr-block-title">${esc(config.volumeTitre)}</div>
        ${caBlock(uid + "-" + index, config, soc)}
      </div>`;
    }

    const max = t.seuilContact + t.pas;
    return `
      <div class="mdr-block" data-el="volume">
        <div class="mdr-block-title">${esc(config.volumeTitre)}</div>

        <div class="mdr-field mdr-field--stack">
          <div class="mdr-field-text">
            <label class="mdr-label" for="${uid}-tx-${index}">${esc(t.labelTransactions)}</label>
            <span class="mdr-hint" data-el="txHint"></span>
          </div>
          <div class="mdr-volume-value">
            <output class="mdr-ca-value" data-el="txValue"></output>
            <span class="mdr-profil-badge" data-el="txProfil"></span>
          </div>
          <input type="range" id="${uid}-tx-${index}" data-el="transactions" class="mdr-range"
                 min="0" max="${max}" step="${t.pas}" value="${soc.transactions}"
                 aria-label="${esc(t.labelTransactions)}">
          <div class="mdr-range-scale">
            <span>0</span><span>${esc(t.labelDevis.replace("Plus de ", "").trim())}+</span>
          </div>
        </div>
      </div>`;
  }

  function renderEtape() {
    const e = etapeCourante();
    if (e.id === "societes") {
      nodes.panel.innerHTML = societesStepHTML();
      syncPanelLimits();
    } else if (e.id === "soc") {
      nodes.panel.innerHTML = socStepHTML(state.societes[e.index], e.index);
      syncPanelLimits();
      syncVolume();
    } else if (e.id === "migration") {
      nodes.panel.innerHTML = migrationStep(uid);
      ["exerciceDebut", "exerciceFin", "demarrage"].forEach((champ) => {
        const input = nodes.panel.querySelector(`[data-el="${champ}"]`);
        if (input) input.value = state.migration[champ];
      });
      renderMonths();
      renderRepriseList();
    } else {
      nodes.panel.innerHTML = comparaisonStep(uid, config, state);
    }
    refresh();
  }

  function syncPanelLimits() {
    const moins = (attr) => nodes.panel.querySelector(`[data-${attr}="-1"]`);
    const e = etapeCourante();
    if (e.id === "societes") {
      config.typesSociete.forEach((t) => {
        const btn = nodes.panel.querySelector(`[data-count="${t.id}"][data-delta="-1"]`);
        if (btn) btn.disabled = compte(t.id) <= minPourType(t.id);
      });
      return;
    }
    const soc = societeCourante();
    if (!soc) return;
    const moinsSal = moins("sal");
    if (moinsSal) moinsSal.disabled = !socialDisponible(soc, config) || soc.nbSalaries <= 0;
    moins("users").disabled = soc.nbUsers <= 1;
  }

  function syncVolume() {
    const soc = societeCourante();
    if (!soc || volumeType(soc, config) !== "transactions") { syncCa(); return; }
    const t = config.pilotageTransactions;
    const bloc = nodes.panel.querySelector('[data-el="volume"]');
    if (!bloc) return;

    const devis = surDevis(soc, config);
    const supp = supplementTransactions(soc.transactions, config);

    bloc.querySelector('[data-el="txValue"]').textContent = devis
      ? t.labelDevis
      : soc.transactions.toLocaleString("fr-FR").replace(/\s/g, NBSP);
    bloc.querySelector('[data-el="txProfil"]').textContent = profilPour(soc.transactions, config).label;
    bloc.querySelector('[data-el="txHint"]').textContent = devis
      ? t.noteDevis
      : supp > 0
        ? "Palier atteint : +" + fmt(supp) + " par mois"
        : t.inclusesSocle + " transactions incluses dans le forfait.";
  }

  function syncCa() {
    const soc = societeCourante();
    const bloc = nodes.panel.querySelector('[data-el="caBlock"]');
    if (!soc || !bloc) return;
    nodes.panel.querySelector('[data-el="caValue"]').textContent = soc.ca >= 1000000
      ? (soc.ca / 1000000).toLocaleString("fr-FR", { maximumFractionDigits: 1 }) + NBSP + "M€"
      : fmt(soc.ca);
    const palier = palierCA(soc, config);
    nodes.panel.querySelector('[data-el="caSupp"]').textContent = palier > 0
      ? "Palier atteint : +" + fmt(palier) + " par mois"
      : "Aucun supplément en dessous d'1" + NBSP + "M€.";
  }

  function renderMonths() {
    const box = nodes.panel.querySelector('[data-el="months"]');
    if (!box) return;
    const hors = demarrageHorsExercice(state);
    const m = moisAReprendre(state);
    box.innerHTML = m === null || hors ? ""
      : m === 0
        ? "Aucun mois à reprendre — démarrage en début d'exercice."
        : "<b>" + m + " mois</b> à reprendre" + NBSP + ": " + esc(periodeReprise(state)) + ".";

    const alerte = nodes.panel.querySelector('[data-el="alerte"]');
    if (alerte) alerte.hidden = !hors;
  }

  function renderRepriseList() {
    const box = nodes.panel.querySelector('[data-el="repriseList"]');
    if (!box) return;
    const eligibles = state.societes
      .map((soc, i) => ({ soc, i }))
      .filter(({ soc }) => productionComptable(soc, config));
    if (eligibles.length < 2) { box.innerHTML = ""; return; }
    box.innerHTML = `
      <div class="mdr-reprise-title">Comptabilités à reprendre</div>
      <div class="mdr-reprise-items">
        ${eligibles.map(({ soc, i }) => `
          <label class="mdr-check-line">
            <input type="checkbox" data-reprise="${i}"${soc.reprise ? " checked" : ""}>
            <span>${esc(nomSociete(soc, i, state.societes, config))}</span>
          </label>`).join("")}
      </div>`;
  }

  function migItem(label, sub, price, priceCls) {
    const subHtml = sub ? `<span class="mdr-mig-sub">${sub}</span>` : "";
    return `
      <li>
        <span class="mdr-mig-left">
          <span class="mdr-check" aria-hidden="true">
            <svg width="11" height="11" viewBox="0 0 11 11"><path d="M2 5.5l2.2 2.2L9 3" fill="none" stroke="#1F2A0E" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"/></svg>
          </span>
          <span class="mdr-mig-label"><span>${label}</span>${subHtml}</span>
        </span>
        <span class="mdr-mig-price${priceCls ? " " + priceCls : ""}">${price}</span>
      </li>`;
  }

  function renderMigration() {
    const box = nodes.panel.querySelector('[data-el="migration"]');
    if (!box) return;
    const m = moisAReprendre(state);
    const nb = societesAReprendre(state, config);
    let repItem;
    if (m === null) {
      repItem = migItem("Reprise comptable", "Selon votre date de démarrage", "—", "mdr-mig-price--mut");
    } else if (m === 0 || nb === 0) {
      repItem = migItem("Reprise comptable", nb === 0 ? "Aucune comptabilité à reprendre" : "Aucun mois à reprendre", "Inclus");
    } else {
      const sub = Math.round(config.reprise.taux * 100) + NBSP + "% de la période · "
        + fmt(config.reprise.prixMois) + " par mois"
        + (nb > 1 ? " · " + nb + " sociétés" : "");
      repItem = migItem("Reprise comptable", sub, fmt(coutReprise(state, config)), "mdr-mig-price--ink");
    }
    box.innerHTML = repItem;
  }

  function renderSummary() {
    const r = calcul(state, config);

    nodes.totalPrefix.textContent = r.devis ? config.totalPrefixeDevis : "";
    nodes.totalPrefix.hidden = !r.devis;
    nodes.total.textContent = fmt(r.total).replace(NBSP + "€", "");

    const reprise = coutReprise(state, config);
    const annuelRecurrent = r.total * 12;
    nodes.annual.textContent = reprise > 0
      ? "· " + fmt(annuelRecurrent + reprise) + " HT la 1re année"
      : "· " + fmt(annuelRecurrent) + " HT par an";

    const multi = r.groupes.length > 1;
    let bd = "";
    r.groupes.forEach((g, i) => {
      if (multi) {
        bd += `
          <button type="button" class="mdr-brk-group${state.step === i + 1 ? " is-current" : ""}" data-step="${i + 1}">
            <span>${esc(g.nom)}</span>
            <b>${fmt(g.total)}</b>
          </button>`;
      }
      bd += g.lignes.map((l) => `
        <div class="mdr-brk-row${l.neg ? " mdr-brk-row--neg" : ""}">
          <span>${esc(l.label)}</span>
          <b>${l.devis ? "Sur devis" : l.val > 0 ? "+" + fmt(l.val) : fmt(l.val)}</b>
        </div>`).join("");
    });
    nodes.breakdown.innerHTML = bd;

    renderCompare(r.total);
    renderCta();
    return r;
  }

  function urlCta() {
    if (config.ctaParams === false) return config.ctaUrl;
    try {
      const url = new URL(config.ctaUrl, window.location.href);
      const r = resume(state, config);
      url.searchParams.set("sim_total", String(r.total));
      url.searchParams.set("sim_structures", String(r.structures.length));
      if (r.surDevis) url.searchParams.set("sim_devis", "1");
      if (r.actuel.total > 0) {
        url.searchParams.set("sim_actuel", String(r.actuel.total));
        url.searchParams.set("sim_ecart", String(r.ecart.mensuel));
      }
      url.searchParams.set("sim_recap", resumeTexte(state, config));
      return url.toString();
    } catch (err) {
      console.warn("[simulateur] URL du CTA illisible :", err);
      return config.ctaUrl;
    }
  }

  function transmettre() {
    const detail = resume(state, config);
    root.dispatchEvent(new CustomEvent("mandare:simulateur:cta", { bubbles: true, detail }));
    if (!config.webhookUrl || !navigator.sendBeacon) return;
    try {
      const charge = JSON.stringify({
        ...detail,
        recap: resumeTexte(state, config),
        page: window.location.href,
        version: __VERSION__
      });
      navigator.sendBeacon(config.webhookUrl, new Blob([charge], { type: "application/json" }));
    } catch (err) {
      console.warn("[simulateur] envoi de la simulation impossible :", err);
    }
  }

  function renderCta() {
    const manquantes = decisionsManquantes(state, config);
    const pret = manquantes.length === 0;
    const devis = calcul(state, config).devis;
    nodes.cta.textContent = devis ? config.ctaTexteDevis : config.ctaTexte;

    nodes.cta.classList.toggle("is-disabled", !pret);
    nodes.cta.setAttribute("aria-disabled", pret ? "false" : "true");
    if (pret) nodes.cta.href = urlCta();
    else nodes.cta.removeAttribute("href");

    if (pret) {
      nodes.cta.removeAttribute("title");
    } else {
      nodes.cta.title = manquantes.length === 1
        ? "Accompagnement à choisir pour " + manquantes[0].nom
        : manquantes.length + " accompagnements restent à choisir";
    }
  }

  function renderCompare(total) {
    const box = nodes.panel.querySelector('[data-el="compare"]');
    if (!box) return;

    const c = comparaison(state, config, total);
    if (!c.renseigne) { box.innerHTML = ""; return; }

    const pos = c.ecart >= 0;
    box.innerHTML = `
      <div class="mdr-cmp">
        <div class="mdr-cmp-row">
          <span class="mdr-cmp-head">Aujourd'hui</span>
          <b>${fmt(c.actuel)} par mois</b>
        </div>
        <div class="mdr-cmp-row">
          <span class="mdr-cmp-head">Avec Mandare</span>
          <b>${fmt(c.futur)} par mois</b>
        </div>
        ${c.comptableConserve ? `<div class="mdr-cmp-row mdr-cmp-row--detail"><span>${esc(config.comparaison.noteComptableConserve)}</span></div>` : ""}
        <div class="mdr-cmp-row mdr-cmp-row--gain${pos ? "" : " mdr-cmp-row--neg"}">
          <span class="mdr-cmp-gain-label">
            ${pos ? "Économie" : "Surcoût"}
            <span class="mdr-cmp-gain-an">${fmt(Math.abs(c.ecart) * 12)} par an</span>
          </span>
          <b class="mdr-cmp-gain-val">${fmt(Math.abs(c.ecart))} par mois</b>
        </div>
      </div>`;
  }

  function refresh() {
    renderProgress();
    renderNav();
    renderMigration();
    const r = renderSummary();
    root.dispatchEvent(new CustomEvent("mandare:simulateur:change", {
      bubbles: true,
      detail: { state: snapshot(), total: r.total, societes: r.groupes }
    }));
  }

  function snapshot() {
    return {
      societes: state.societes.map((s) => ({ ...s })),
      actuel: { ...state.actuel },
      postesActifs: [...state.postesActifs],
      migration: { ...state.migration },
      step: state.step
    };
  }

  root.addEventListener("click", (e) => {
    const cible = (sel) => e.target.closest(sel);

    const cta = cible(".mdr-cta");
    if (cta) {
      if (cta.classList.contains("is-disabled")) {
        e.preventDefault();
        const manquantes = decisionsManquantes(state, config);
        if (manquantes.length) allerA(manquantes[0].etape);
        return;
      }
      transmettre();
      return;
    }

    const nav = cible("[data-nav]");
    if (nav) {
      const action = nav.dataset.nav;
      if (action === "prev") allerA(state.step - 1);
      else if (action === "next") allerA(state.step + 1);
      return;
    }

    const step = cible("[data-step]");
    if (step) { allerA(parseInt(step.dataset.step, 10)); return; }

    const compteur = cible("[data-count]");
    if (compteur) {
      setCompte(compteur.dataset.count, parseInt(compteur.dataset.delta, 10));
      renderEtape();
      return;
    }

    const opt = cible(".mdr-opt");
    if (opt) {
      const soc = societeCourante();
      if (!soc) return;
      if (opt.dataset.group === "app") {
        soc.appId = opt.dataset.id;
        renderEtape();
        return;
      }
      if (opt.dataset.group === "acc") soc.accId = opt.dataset.id;
      Array.from(opt.parentElement.querySelectorAll(".mdr-opt")).forEach((b) => {
        const on = b === opt;
        b.classList.toggle("is-selected", on);
        b.setAttribute("aria-pressed", on ? "true" : "false");
      });
      syncCa();
      refresh();
      return;
    }

    const ajout = cible("[data-poste-add]");
    if (ajout) {
      state.postesActifs.push(ajout.dataset.posteAdd);
      renderEtape();
      return;
    }

    const retrait = cible("[data-poste-remove]");
    if (retrait) {
      const id = retrait.dataset.posteRemove;
      state.postesActifs = state.postesActifs.filter((p) => p !== id);
      state.actuel[id] = 0;
      renderEtape();
      return;
    }

    const sal = cible("[data-sal]");
    if (sal) {
      const soc = societeCourante();
      soc.nbSalaries = Math.min(config.salariesMax, Math.max(0, soc.nbSalaries + parseInt(sal.dataset.sal, 10)));
      nodes.panel.querySelector('[data-el="salVal"]').textContent = soc.nbSalaries;
      const hint = nodes.panel.querySelector('[data-el="socialHint"]');
      if (hint) hint.textContent = socialHint(soc);
      syncPanelLimits();
      refresh();
      return;
    }

    const users = cible("[data-users]");
    if (users) {
      const soc = societeCourante();
      soc.nbUsers = Math.min(config.utilisateursMax, Math.max(1, soc.nbUsers + parseInt(users.dataset.users, 10)));
      nodes.panel.querySelector('[data-el="usersVal"]').textContent = soc.nbUsers;
      syncPanelLimits();
      refresh();
      return;
    }

  });

  root.addEventListener("input", (e) => {
    const t = e.target;
    if (t.dataset.el === "ca") {
      societeCourante().ca = parseInt(t.value, 10) || 0;
      syncCa();
      refresh();
    } else if (t.dataset.el === "transactions") {
      societeCourante().transactions = Math.max(0, parseInt(t.value, 10) || 0);
      syncVolume();
      refresh();
    } else if (t.dataset.nom !== undefined) {
      state.societes[parseInt(t.dataset.nom, 10)].nom = t.value;
      renderProgress();
      renderSummary();
    } else if (t.dataset.cout !== undefined) {
      state.actuel[t.dataset.cout] = parseFloat(t.value) || 0;
      renderSummary();
    }
  });

  root.addEventListener("change", (e) => {
    const t = e.target;
    const champsDate = ["exerciceDebut", "exerciceFin", "demarrage"];
    if (champsDate.includes(t.dataset.el)) {
      state.migration[t.dataset.el] = t.value;
      if (t.dataset.el === "exerciceDebut" && !state.migration.exerciceFin) {
        state.migration.exerciceFin = finExerciceParDefaut(t.value);
        const fin = nodes.panel.querySelector('[data-el="exerciceFin"]');
        if (fin) fin.value = state.migration.exerciceFin;
      }
      renderMonths();
      refresh();
    } else if (t.dataset.reprise !== undefined) {
      state.societes[parseInt(t.dataset.reprise, 10)].reprise = t.checked;
      refresh();
    }
  });

  nodes.cta.textContent = config.ctaTexte;
  renderEtape();

  return {
    root,
    config,
    getState: snapshot,
    resume: () => resume(state, config),
    resumeTexte: () => resumeTexte(state, config),
    urlCta,
    allerA,
    refresh,
    destroy() {
      root.innerHTML = "";
      root.classList.remove("mdr-sim");
    }
  };
}
