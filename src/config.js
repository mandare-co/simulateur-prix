export const CONFIG = {
  typesSociete: [
    {
      id: "act",
      label: "Société",
      pluriel: "Sociétés",
      hint: "SAS, SASU, SARL, EURL, EI, SA, SNC, SCA.",
      plateformes: ["pilotage", "comptabilite"],
      defaut: "comptabilite"
    },
    {
      id: "pat",
      label: "Société patrimoniale",
      pluriel: "Sociétés patrimoniales",
      hint: "SCI, holding familiale, LMNP.",
      plateformes: ["pilotage", "comptabilite"],
      defaut: "comptabilite"
    },
    {
      id: "micro",
      label: "Micro-entreprise",
      pluriel: "Micro-entreprises",
      hint: "Entreprise individuelle, auto-entrepreneur.",
      plateformes: ["independant"],
      defaut: "independant",
      sansAccompagnement: {
        nom: "Je gère moi-même",
        desc: "Vous pilotez vos déclarations depuis la plateforme."
      }
    }
  ],

  applications: [
    { id: "independant",  nom: "Indépendant",  badge: "Micro",     accent: false, prix: 10, social: false, desc: "Suivi d'activité et déclarations en temps réel." },
    { id: "pilotage",     nom: "Pilotage",     badge: "Société",   accent: false, prix: 20, accompagnement: false, social: false, volume: "transactions", desc: "Accès à tous les modules sauf la comptabilité, pour un pilotage serein." },
    { id: "comptabilite", nom: "Comptabilité", badge: "Populaire", accent: true,  prix: 40, volume: "ca", productionComptable: true, desc: "Tous les modules avec la production comptable en totale autonomie." }
  ],

  utilisateursInclus: 1,
  prixUtilisateurSupp: 10,
  utilisateursMax: 20,

  social: {
    prixBulletin: 35,
    titre: "Gestion sociale",
    perimetre: "Bulletins de paie et DSN, paiement des cotisations."
  },
  salariesMax: 100,

  accompagnements: [
    { id: "delegation",  nom: "Je délègue la gestion", badge: "",   accent: false, prix: 40,  inclut: "micro", desc: "Déclarations, échéances et obligations entièrement prises en charge." },
    { id: "patrimonial", nom: "Patrimonial", badge: "",           accent: false, prix: 70,  inclut: "pat", desc: "Holding, LMNP, SCI : structures à faible activité." },
    { id: "essentiel",   nom: "Essentiel",   badge: "Recommandé", accent: true,  prix: 120, inclut: "act", desc: "Déclarations et formalités prises en charge." },
    { id: "brasdroit",   nom: "Bras droit",  badge: "",           accent: false, prix: 220, inclut: "act", desc: "Partenaire sur vos décisions stratégiques." }
  ],

  accompagnementPerimetre: "Montant en plus de l'abonnement à la plateforme.",

  sansAccompagnement: {
    id: "aucun",
    nom: "Je garde mon comptable",
    prix: 0,
    desc: "Vous conservez votre cabinet : seule la plateforme est facturée."
  },

  volumeTitre: "Volume",

  palierCA: { tranche: 1000000, supplement: 100 },
  caMax: 10000000,

  pilotageTransactions: {
    inclusesSocle: 150,
    seuilContact: 10000,
    pas: 50,
    paliers: [
      { max: 400,   supp: 20 },
      { max: 800,   supp: 40 },
      { max: 1500,  supp: 70 },
      { max: 3000,  supp: 110 },
      { max: 6000,  supp: 160 },
      { max: 10000, supp: 230 }
    ],
    profils: [
      { label: "Indépendant", valeur: 0 },
      { label: "TPE", valeur: 300 },
      { label: "Petite PME", valeur: 800 },
      { label: "PME", valeur: 2000 },
      { label: "Fort volume", valeur: 6000 }
    ],
    labelTransactions: "Transactions par mois",
    labelDevis: "Plus de 10 000",
    noteDevis: "Volume au-delà de nos paliers : tarif sur devis."
  },

  reprise: { prixMois: 120, taux: 0.5 },

  societesMax: 20,

  comparaison: {
    postes: [
      {
        id: "comptable",
        label: "Cabinet comptable",
        hint: "Honoraires mensuels, hors bilan et formalités exceptionnelles.",
        remplace: "comptable",
        defaut: true
      },
      {
        id: "outil",
        label: "Outil comptable",
        hint: "Abonnement au logiciel de production comptable.",
        remplace: "outil"
      },
      {
        id: "paie",
        label: "Fiches de paie",
        hint: "Coût mensuel de l'établissement des bulletins.",
        remplace: "paie"
      },
      {
        id: "crm",
        label: "CRM",
        hint: "Abonnement mensuel, tous utilisateurs compris.",
        remplace: "outil"
      },
      {
        id: "tresorerie",
        label: "Prévisionnel",
        hint: "Outil de prévision et de suivi de trésorerie.",
        remplace: "outil"
      }
    ],
    noteComptableConserve: "Sans accompagnement, votre expert-comptable est conservé : son coût est compté des deux côtés.",
    notePaieConservee: "Sans salarié déclaré, vos fiches de paie restent chez votre prestataire : leur coût est compté des deux côtés."
  },

  ctaTexte: "Commencer",
  ctaTexteDevis: "Demander un devis",

  totalPrefixeDevis: "À partir de",

  ctaParams: true,
  webhookUrl: "",
  ctaUrl: "https://www.mandare.co/demo/rencontre"
};

export function mergeConfig(...sources) {
  const out = { ...CONFIG };
  for (const src of sources) {
    if (!src || typeof src !== "object") continue;
    for (const [key, value] of Object.entries(src)) {
      if (value === undefined) continue;
      out[key] = value;
    }
  }
  return out;
}
