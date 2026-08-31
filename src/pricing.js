import { dateFr } from "./format.js";

export function typeDe(kind, config) {
  return config.typesSociete.find((t) => t.id === kind) || config.typesSociete[0];
}

export function typeLabel(kind, config) {
  return typeDe(kind, config).label;
}

export function societeParDefaut(config, kind = "act") {
  const type = typeDe(kind, config);
  return {
    nom: "",
    kind,
    appId: type.defaut || type.plateformes[type.plateformes.length - 1],
    accId: null,
    ca: 0,
    transactions: config.pilotageTransactions.inclusesSocle,
    nbSalaries: 0,
    nbUsers: config.utilisateursInclus,
    reprise: true
  };
}

export function appsPour(kind, config) {
  const ids = typeDe(kind, config).plateformes;
  return config.applications.filter((a) => ids.includes(a.id));
}

export function accompagnementsPour(kind, config) {
  return config.accompagnements.filter((a) => a.inclut === kind);
}

export function appDe(soc, config) {
  const dispo = appsPour(soc.kind, config);
  return dispo.find((a) => a.id === soc.appId) || dispo[dispo.length - 1];
}

export function accDe(soc, config) {
  if (!accompagnementDisponible(soc, config)) return null;
  if (!soc.accId || soc.accId === config.sansAccompagnement.id) return null;
  return accompagnementsPour(soc.kind, config).find((a) => a.id === soc.accId) || null;
}

export function accompagnementDisponible(soc, config) {
  return appDe(soc, config).accompagnement !== false
    && accompagnementsPour(soc.kind, config).length > 0;
}

export function socialDisponible(soc, config) {
  return appDe(soc, config).social !== false;
}

export function accompagnementPossiblePourType(kind, config) {
  return accompagnementsPour(kind, config).length > 0
    && appsPour(kind, config).some((a) => a.accompagnement !== false);
}

export function socialPossiblePourType(kind, config) {
  return appsPour(kind, config).some((a) => a.social !== false);
}

export function nomSociete(soc, index, societes, config) {
  if (soc.nom && soc.nom.trim()) return soc.nom.trim();
  const label = config ? typeLabel(soc.kind, config) : "Société";
  const memeType = societes.filter((s) => s.kind === soc.kind);
  if (memeType.length < 2) return label;
  const rang = societes.slice(0, index).filter((s) => s.kind === soc.kind).length + 1;
  return label + " " + rang;
}

function jour(valeur) {
  if (!valeur) return null;
  const d = new Date(valeur + "T00:00:00");
  return isNaN(d.getTime()) ? null : d;
}

function moisEntre(depuis, jusqu) {
  const mois = (jusqu.getFullYear() - depuis.getFullYear()) * 12
    + (jusqu.getMonth() - depuis.getMonth());
  return mois + (jusqu.getDate() > depuis.getDate() ? 1 : 0);
}

export function dureeExercice(state) {
  const debut = jour(state.migration.exerciceDebut);
  const fin = jour(state.migration.exerciceFin);
  if (!debut || !fin || fin <= debut) return 12;
  return Math.max(1, Math.round((fin - debut) / (30.44 * 24 * 3600 * 1000)));
}

export function moisAReprendre(state) {
  const debut = jour(state.migration.exerciceDebut);
  const demarrage = jour(state.migration.demarrage);
  if (!debut || !demarrage) return null;
  return Math.max(0, Math.min(moisEntre(debut, demarrage), dureeExercice(state)));
}

export function demarrageHorsExercice(state) {
  const debut = jour(state.migration.exerciceDebut);
  const fin = jour(state.migration.exerciceFin);
  const demarrage = jour(state.migration.demarrage);
  if (!debut || !fin || !demarrage) return false;
  return demarrage < debut || demarrage > fin;
}

export function finExerciceParDefaut(debutValeur) {
  const debut = jour(debutValeur);
  if (!debut) return "";
  const fin = new Date(debut.getFullYear() + 1, debut.getMonth(), debut.getDate() - 1);
  const p = (n) => String(n).padStart(2, "0");
  return fin.getFullYear() + "-" + p(fin.getMonth() + 1) + "-" + p(fin.getDate());
}

export function productionComptable(soc, config) {
  return appDe(soc, config).productionComptable === true;
}

export function societesReprises(state, config) {
  return state.societes.filter((s) => productionComptable(s, config) && s.reprise);
}

export function societesAReprendre(state, config) {
  return societesReprises(state, config).length;
}

export function migrationNecessaire(state, config) {
  return state.societes.some((s) => productionComptable(s, config));
}

export function coutReprise(state, config) {
  const m = moisAReprendre(state);
  if (!m || !migrationNecessaire(state, config)) return 0;
  return Math.round(m * config.reprise.prixMois * config.reprise.taux)
    * societesAReprendre(state, config);
}

export function periodeReprise(state) {
  const debut = jour(state.migration.exerciceDebut);
  const demarrage = jour(state.migration.demarrage);
  if (!debut || !demarrage) return "";
  return "du " + dateFr(debut) + " au " + dateFr(demarrage);
}

export function palierCA(soc, config) {
  return Math.floor(Math.max(0, soc.ca) / config.palierCA.tranche) * config.palierCA.supplement;
}

export function volumeType(soc, config) {
  return appDe(soc, config).volume || null;
}

export function supplementTransactions(nb, config) {
  const t = config.pilotageTransactions;
  const volume = Math.max(0, nb);
  if (volume <= t.inclusesSocle) return 0;
  const palier = t.paliers.find((p) => volume <= p.max);
  return palier ? palier.supp : t.paliers[t.paliers.length - 1].supp;
}

export function surDevis(soc, config) {
  return volumeType(soc, config) === "transactions"
    && Math.max(0, soc.transactions) > config.pilotageTransactions.seuilContact;
}

export function profilPour(volume, config) {
  const profils = config.pilotageTransactions.profils;
  let trouve = profils[0];
  for (const p of profils) if (volume >= p.valeur) trouve = p;
  return trouve;
}

export function aUnDevis(state, config) {
  return state.societes.some((soc) => surDevis(soc, config));
}

export function bulletins(soc, config) {
  if (config && !socialDisponible(soc, config)) return 0;
  return Math.max(0, soc.nbSalaries);
}

export function calculSociete(soc, state, config) {
  const app = appDe(soc, config);
  const acc = accDe(soc, config);

  const seatsCount = Math.max(0, soc.nbUsers - config.utilisateursInclus);
  const seatsCost = seatsCount * config.prixUtilisateurSupp;
  const nbBulletins = bulletins(soc, config);
  const socialCost = nbBulletins * config.social.prixBulletin;

  const mesure = volumeType(soc, config);
  const palier = mesure === "ca" ? palierCA(soc, config) : 0;
  const devis = surDevis(soc, config);
  const txSupp = mesure === "transactions" && !devis
    ? supplementTransactions(soc.transactions, config) : 0;
  const base = acc ? acc.prix : app.prix;

  const lignes = [];
  const supplementAcc = acc ? acc.prix - app.prix : 0;
  if (acc && supplementAcc <= 0) {
    lignes.push({ label: "Accompagnement " + acc.nom, val: acc.prix });
  } else {
    lignes.push({ label: "Plateforme " + app.nom, val: app.prix });
    if (acc) {
      lignes.push({ label: "Accompagnement " + acc.nom, val: supplementAcc });
    }
  }

  if (palier > 0) {
    lignes.push({ label: "Palier chiffre d'affaires", val: palier });
  }
  if (devis) {
    lignes.push({ label: "Volume de transactions", devis: true });
  } else if (txSupp > 0) {
    lignes.push({ label: "Volume de transactions", val: txSupp });
  }
  if (socialCost > 0) {
    lignes.push({
      label: nbBulletins + " bulletin" + (nbBulletins > 1 ? "s" : "") + " de paie",
      val: socialCost
    });
  }
  if (seatsCost > 0) {
    lignes.push({
      label: seatsCount + " utilisateur" + (seatsCount > 1 ? "s" : "") +
        " supplémentaire" + (seatsCount > 1 ? "s" : ""),
      val: seatsCost
    });
  }
  const total = Math.max(0, base + palier + txSupp + socialCost + seatsCost);
  return { total, lignes, app, acc, nbBulletins, devis };
}

export function calcul(state, config) {
  const groupes = state.societes.map((soc, i) => ({
    nom: nomSociete(soc, i, state.societes, config),
    kind: soc.kind,
    index: i,
    ...calculSociete(soc, state, config)
  }));
  const total = groupes.reduce((s, g) => s + g.total, 0);
  return { total, groupes, devis: groupes.some((g) => g.devis) };
}

export function decisionsManquantes(state, config) {
  return state.societes
    .map((soc, i) => ({ soc, i }))
    .filter(({ soc }) => soc.accId === null && accompagnementDisponible(soc, config))
    .map(({ soc, i }) => ({ index: i, etape: i + 1, nom: nomSociete(soc, i, state.societes, config) }));
}

export function comparaison(state, config, totalMandare) {
  const montant = (poste) => Math.max(0, Number(state.actuel[poste.id]) || 0);
  const postes = config.comparaison.postes.map((p) => ({ ...p, montant: montant(p) }));
  const actuel = postes.reduce((s, p) => s + p.montant, 0);

  const repris = {
    outil: true,
    comptable: aUnAccompagnement(state, config),
    paie: state.societes.some((soc) => bulletins(soc, config) > 0)
  };
  const conserve = (cle) => postes
    .filter((p) => p.remplace === cle && repris[cle] === false)
    .reduce((s, p) => s + p.montant, 0);

  const comptableConserve = conserve("comptable");
  const paieConservee = conserve("paie");

  const futur = totalMandare + comptableConserve + paieConservee;
  const ecart = actuel - futur;

  return {
    postes,
    actuel,
    futur,
    ecart,
    renseigne: actuel > 0,
    comptableConserve: comptableConserve > 0,
    paieConservee: paieConservee > 0
  };
}

export function resume(state, config) {
  const r = calcul(state, config);
  const mois = moisAReprendre(state);
  const cmp = comparaison(state, config, r.total);

  const structures = state.societes.map((soc, i) => {
    const app = appDe(soc, config);
    const acc = accDe(soc, config);
    const type = typeDe(soc.kind, config);
    const ligne = {
      nom: nomSociete(soc, i, state.societes, config),
      type: type.label,
      plateforme: app.nom,
      accompagnement: acc ? acc.nom : "aucun",
      utilisateurs: soc.nbUsers,
      total: r.groupes[i].total
    };
    if (volumeType(soc, config) === "ca") ligne.ca = soc.ca;
    if (volumeType(soc, config) === "transactions") {
      ligne.transactions = surDevis(soc, config) ? "> " + config.pilotageTransactions.seuilContact : soc.transactions;
    }
    if (socialDisponible(soc, config) && soc.nbSalaries > 0) ligne.salaries = soc.nbSalaries;
    return ligne;
  });

  return {
    total: r.total,
    totalAnnuel: r.total * 12,
    surDevis: r.devis,
    structures,
    migration: migrationNecessaire(state, config)
      ? {
          exercice: state.migration.exerciceDebut + " → " + state.migration.exerciceFin,
          demarrage: state.migration.demarrage,
          moisAReprendre: mois,
          societesReprises: societesAReprendre(state, config),
          coutReprise: coutReprise(state, config)
        }
      : null,
    actuel: {
      total: cmp.actuel,
      postes: cmp.postes.filter((p) => p.montant > 0).map((p) => ({ poste: p.label, montant: p.montant }))
    },
    ecart: { mensuel: cmp.ecart, annuel: cmp.ecart * 12 }
  };
}

export function resumeTexte(state, config) {
  const r = resume(state, config);
  const euro = (v) => v.toLocaleString("fr-FR") + " € HT";
  const lignes = r.structures.map((st) => {
    const bouts = [st.plateforme];
    if (st.accompagnement !== "aucun") bouts.push(st.accompagnement);
    if (st.ca > 0) bouts.push("CA " + st.ca.toLocaleString("fr-FR") + " €");
    if (st.transactions) bouts.push(st.transactions + " transactions/mois");
    if (st.salaries) bouts.push(st.salaries + " bulletin" + (st.salaries > 1 ? "s" : ""));
    bouts.push(st.utilisateurs + " utilisateur" + (st.utilisateurs > 1 ? "s" : ""));
    return "- " + st.nom + " (" + st.type + ") : " + bouts.join(", ") + " — " + euro(st.total) + "/mois";
  });

  if (r.migration) {
    lignes.push("- Migration : démarrage " + (r.migration.demarrage || "non précisé")
      + (r.migration.moisAReprendre ? ", " + r.migration.moisAReprendre + " mois à reprendre sur "
        + r.migration.societesReprises + " société(s), " + euro(r.migration.coutReprise) : ""));
  }
  if (r.actuel.total > 0) {
    lignes.push("- Coût actuel : " + euro(r.actuel.total) + "/mois ("
      + r.actuel.postes.map((p) => p.poste + " " + p.montant + " €").join(", ") + ")");
    lignes.push("- Écart : " + euro(Math.abs(r.ecart.mensuel)) + "/mois "
      + (r.ecart.mensuel >= 0 ? "d'économie" : "de surcoût"));
  }
  lignes.push("- Total Mandare : " + euro(r.total) + "/mois" + (r.surDevis ? " + volume sur devis" : ""));
  return lignes.join("\n");
}

export function aUnAccompagnement(state, config) {
  return state.societes.some((soc) => accDe(soc, config) !== null);
}
