import test from "node:test";
import assert from "node:assert/strict";

import { CONFIG } from "../src/config.js";
import {
  societeParDefaut, calculSociete, calcul, coutReprise,
  appDe, accDe, surDevis, decisionsManquantes, palierCA, bulletins,
  migrationNecessaire, moisAReprendre
} from "../src/pricing.js";

function soc(kind, patch = {}) {
  return { ...societeParDefaut(CONFIG, kind), ...patch };
}

function etat(societes, demarrage = "2026-06-01") {
  return {
    societes,
    migration: {
      exerciceDebut: "2026-01-01",
      exerciceFin: "2026-12-31",
      demarrage
    }
  };
}

function total(s) {
  return calculSociete(s, { societes: [s] }, CONFIG).total;
}

function lignes(s) {
  return calculSociete(s, { societes: [s] }, CONFIG).lignes
    .map((l) => [l.label, l.devis ? "devis" : l.val]);
}

test("plateformes seules", () => {
  assert.equal(total(soc("act", { appId: "pilotage" })), 20);
  assert.equal(total(soc("act", { appId: "comptabilite" })), 40);
  assert.equal(total(soc("micro")), 10);
});

test("un accompagnement remplace le prix de la plateforme", () => {
  assert.equal(total(soc("act", { accId: "essentiel" })), 120);
  assert.equal(total(soc("act", { accId: "brasdroit" })), 220);
  assert.equal(total(soc("pat", { accId: "patrimonial" })), 70);
  assert.equal(total(soc("micro", { accId: "delegation" })), 40);
});

test("le détail se décompose en plateforme + supplément d'accompagnement", () => {
  assert.deepEqual(lignes(soc("act", { accId: "essentiel" })), [
    ["Plateforme Comptabilité", 40],
    ["Accompagnement Essentiel", 80]
  ]);
  assert.deepEqual(lignes(soc("micro", { accId: "delegation" })), [
    ["Plateforme Indépendant", 10],
    ["Accompagnement Je délègue la gestion", 30]
  ]);
});

test("la somme des lignes tombe sur le total", () => {
  const cas = [
    soc("act", { accId: "essentiel", ca: 2_000_000, nbSalaries: 3, nbUsers: 2 }),
    soc("act", { appId: "pilotage", transactions: 3000, nbUsers: 3 }),
    soc("pat", { accId: "patrimonial", ca: 1_500_000 }),
    soc("micro", { accId: "delegation", nbUsers: 4 })
  ];
  for (const s of cas) {
    const r = calculSociete(s, { societes: [s] }, CONFIG);
    const somme = r.lignes.reduce((acc, l) => acc + (l.val || 0), 0);
    assert.equal(somme, r.total, "détail incohérent pour " + s.kind);
  }
});

test("Pilotage n'ouvre ni accompagnement ni gestion sociale", () => {
  const s = soc("act", { appId: "pilotage", accId: "essentiel", nbSalaries: 5 });
  assert.equal(accDe(s, CONFIG), null);
  assert.equal(bulletins(s, CONFIG), 0);
  assert.equal(total(s), 20);
});

test("paliers de chiffre d'affaires", () => {
  const t = (ca) => total(soc("act", { accId: "essentiel", ca }));
  assert.equal(t(0), 120);
  assert.equal(t(999_999), 120);
  assert.equal(t(1_000_000), 220);
  assert.equal(t(1_999_999), 220);
  assert.equal(t(2_000_000), 320);
  assert.equal(palierCA(soc("act", { ca: 3_000_000 }), CONFIG), 300);
});

test("paliers de transactions et bascule sur devis", () => {
  const s = (transactions) => soc("act", { appId: "pilotage", transactions });
  assert.equal(total(s(150)), 20);
  assert.equal(total(s(400)), 40);
  assert.equal(total(s(3000)), 130);
  assert.equal(total(s(10_000)), 250);
  assert.equal(surDevis(s(10_000), CONFIG), false);
  assert.equal(surDevis(s(10_050), CONFIG), true);
  assert.deepEqual(lignes(s(10_050)), [
    ["Plateforme Pilotage", 20],
    ["Volume de transactions", "devis"]
  ]);
});

test("utilisateurs supplémentaires et bulletins de paie", () => {
  assert.equal(total(soc("act", { nbUsers: 1 })), 40);
  assert.equal(total(soc("act", { nbUsers: 3 })), 60);
  assert.equal(total(soc("act", { nbSalaries: 3 })), 145);
});

test("total multi-sociétés", () => {
  const state = etat([
    soc("act", { accId: "essentiel", ca: 2_000_000, nbSalaries: 3, nbUsers: 2 }),
    soc("pat", { appId: "pilotage", transactions: 3000, nbUsers: 3 })
  ]);
  const r = calcul(state, CONFIG);
  assert.deepEqual(r.groupes.map((g) => g.total), [435, 150]);
  assert.equal(r.total, 585);
});

test("le CTA reste bloqué tant qu'un accompagnement n'est pas choisi", () => {
  const enAttente = etat([soc("act")]);
  assert.equal(decisionsManquantes(enAttente, CONFIG).length, 1);

  const choisi = etat([soc("act", { accId: "essentiel" })]);
  assert.equal(decisionsManquantes(choisi, CONFIG).length, 0);
});

test("reprise comptable : 5 mois à reprendre au 1er juin", () => {
  const avec = etat([soc("act", { accId: "essentiel", reprise: true })]);
  assert.equal(coutReprise(avec, CONFIG), 300);

  const deux = etat([
    soc("act", { accId: "essentiel", reprise: true }),
    soc("pat", { accId: "patrimonial", reprise: true })
  ]);
  assert.equal(coutReprise(deux, CONFIG), 600);
});

test("sans production comptable chez nous, rien à reprendre", () => {
  const pilotage = etat([soc("act", { appId: "pilotage", reprise: true })]);
  assert.equal(coutReprise(pilotage, CONFIG), 0);
  assert.equal(migrationNecessaire(pilotage, CONFIG), false);

  const refusee = etat([soc("act", { accId: "essentiel", reprise: false })]);
  assert.equal(coutReprise(refusee, CONFIG), 0);
  assert.equal(migrationNecessaire(refusee, CONFIG), true);
});

test("démarrage au premier jour de l'exercice : aucune reprise", () => {
  assert.equal(coutReprise(etat([soc("act", { accId: "essentiel" })], "2026-01-01"), CONFIG), 0);
});

test("aucun tarif négatif, quelles que soient les saisies", () => {
  for (const kind of ["act", "pat", "micro"]) {
    for (const nbUsers of [0, 1, 5]) {
      for (const ca of [0, 500_000, 5_000_000]) {
        const s = soc(kind, { nbUsers, ca });
        assert.ok(total(s) >= 0, `total négatif : ${kind} ${nbUsers} ${ca}`);
        assert.ok(appDe(s, CONFIG), "plateforme introuvable pour " + kind);
      }
    }
  }
});
