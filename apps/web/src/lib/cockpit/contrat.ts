/**
 * SUTA Cockpit — le contrat côté SUTA (fiche de cadrage du 11/09 + réponse
 * du développeur Cockpit, acceptée le 11/09).
 *
 * Pilote resserré à TROIS accès : `indicateur`, `alertes-du-jour`,
 * `synthese-matinale` (`etat-projet` et la couverture territoriale sont
 * hors pilote tant que leurs données ne sont pas instruites).
 *
 * Enveloppe commune rendue par chaque accès Cockpit :
 *   { publiable, a_dire, date_donnees, perimetre: {complet, libelle?,
 *     manquants?}, source, ecran? } — ou { publiable: false, raison }.
 * La règle du périmètre (exigence n°5 du développeur) est appliquée ICI,
 * de façon déterministe : un chiffre partiel est énoncé AVEC son périmètre
 * dans la même phrase ; une valeur non publiable rend sa raison, jamais
 * une approximation. Une enveloppe non conforme n'est PAS énoncée.
 *
 * Zéro pont avec l'instance citoyenne : tout ce module est inerte tant que
 * SUTA_MODE=cockpit n'est pas posé sur le déploiement (même principe que
 * VOICE_ENGINE et LABO_ASR_ENDPOINT). Les éléments nominatifs ne passent
 * que par `ecran`, jamais par `a_dire`.
 */

export const ACCES_PILOTE = ["indicateur", "alertes-du-jour", "synthese-matinale"] as const;
export type AccesCockpit = (typeof ACCES_PILOTE)[number];

export interface PerimetreCockpit {
  complet: boolean;
  /** Obligatoire quand complet=false : « quatre directions sur sept ». */
  libelle?: string;
  manquants?: string[];
}

export interface EnveloppeCockpit {
  publiable: boolean;
  /** Formulation vocale prête, SANS élément nominatif. */
  a_dire?: string;
  /** Date d'arrêté des données (AAAA-MM-JJ) — obligatoire si publiable. */
  date_donnees?: string;
  perimetre?: PerimetreCockpit;
  source?: string;
  /** Détail affichable dans Cockpit — seul endroit où le nominatif est admis. */
  ecran?: unknown;
  /** Obligatoire quand publiable=false : la raison, pas la valeur. */
  raison?: string;
}

type Env = Record<string, string | undefined>;

/** L'instance sert-elle le DG (cockpit) ou les citoyens (défaut) ? */
export function modeCockpitActif(env: Env): boolean {
  return env.SUTA_MODE?.trim().toLowerCase() === "cockpit";
}

/** `simulation` = réponses fictives intégrées ; sinon l'URL de base Cockpit. */
export function cockpitConfigure(env: Env): boolean {
  return Boolean(env.COCKPIT_API_BASE?.trim());
}

export function accesDuPilote(valeur: unknown): AccesCockpit | null {
  return typeof valeur === "string" && (ACCES_PILOTE as readonly string[]).includes(valeur)
    ? (valeur as AccesCockpit)
    : null;
}

const DATE_ISO = /^\d{4}-\d{2}-\d{2}$/;

export function validerEnveloppe(
  brut: unknown,
): { ok: true; enveloppe: EnveloppeCockpit } | { ok: false; motif: string } {
  if (!brut || typeof brut !== "object") return { ok: false, motif: "enveloppe absente ou non JSON" };
  const e = brut as EnveloppeCockpit;

  if (e.publiable === false) {
    if (typeof e.raison !== "string" || !e.raison.trim()) {
      return { ok: false, motif: "valeur non publiable sans raison" };
    }
    return { ok: true, enveloppe: e };
  }
  if (typeof e.a_dire !== "string" || !e.a_dire.trim()) {
    return { ok: false, motif: "champ a_dire manquant" };
  }
  if (typeof e.date_donnees !== "string" || !DATE_ISO.test(e.date_donnees)) {
    return { ok: false, motif: "date_donnees manquante ou mal formée (AAAA-MM-JJ attendu)" };
  }
  if (!e.perimetre || typeof e.perimetre.complet !== "boolean") {
    return { ok: false, motif: "champ perimetre manquant" };
  }
  if (!e.perimetre.complet && !(typeof e.perimetre.libelle === "string" && e.perimetre.libelle.trim())) {
    return { ok: false, motif: "périmètre partiel sans libellé" };
  }
  if (typeof e.source !== "string" || !e.source.trim()) {
    return { ok: false, motif: "champ source manquant" };
  }
  return { ok: true, enveloppe: e };
}

const MOIS = ["janvier", "février", "mars", "avril", "mai", "juin", "juillet", "août", "septembre", "octobre", "novembre", "décembre"];

export function dateEnFrancais(iso: string): string {
  const [annee, mois, jour] = iso.split("-").map(Number);
  const nomMois = MOIS[(mois ?? 0) - 1];
  if (!annee || !nomMois || !jour) return iso;
  return `${jour === 1 ? "1er" : jour} ${nomMois} ${annee}`;
}

/**
 * La formulation finale énoncée par SUTA — déterministe, testée. Défense en
 * profondeur : même si `a_dire` oubliait le périmètre, il est ajouté ici.
 */
export function formulerALaVoix(enveloppe: EnveloppeCockpit): string {
  if (!enveloppe.publiable) {
    return `Je ne peux pas énoncer ce chiffre : ${enveloppe.raison?.trim()}`;
  }
  const morceaux = [enveloppe.a_dire!.trim().replace(/[.。]?$/, ".")];
  if (enveloppe.perimetre && !enveloppe.perimetre.complet) {
    morceaux.push(`Attention, périmètre partiel : ${enveloppe.perimetre.libelle!.trim().replace(/[.。]?$/, ".")}`);
  }
  morceaux.push(`Chiffres arrêtés au ${dateEnFrancais(enveloppe.date_donnees!)}.`);
  return morceaux.join(" ");
}

/** Descripteur function-calling de l'unique outil de l'instance Cockpit. */
export const COCKPIT_TOOL_DESCRIPTOR = {
  name: "cockpit_interroger",
  description:
    "Interroge Cockpit, l'outil de pilotage de l'ANSUT. Accès disponibles : " +
    "'synthese-matinale' (le point du matin), 'alertes-du-jour' (alertes, retards, risques), " +
    "'indicateur' (un indicateur précis — donner son identifiant). " +
    "Rend une formulation vocale prête à énoncer telle quelle.",
  parameters: {
    type: "object",
    properties: {
      acces: {
        type: "string",
        enum: [...ACCES_PILOTE],
        description: "Le point d'accès Cockpit à interroger.",
      },
      indicateur: {
        type: "string",
        description: "Identifiant de l'indicateur demandé (uniquement pour l'accès 'indicateur').",
      },
    },
    required: ["acces"],
    additionalProperties: false,
  } as Record<string, unknown>,
};

export function construireRequeteCockpit(
  entree: { acces: AccesCockpit; indicateur?: string },
  env: Env,
): { url: string; headers: Record<string, string>; body: string } {
  const base = (env.COCKPIT_API_BASE ?? "").trim().replace(/\/+$/, "");
  const headers: Record<string, string> = { "Content-Type": "application/json" };
  if (env.COCKPIT_API_KEY?.trim()) headers.Authorization = `Bearer ${env.COCKPIT_API_KEY.trim()}`;
  return {
    url: `${base}/${entree.acces}`,
    headers,
    body: JSON.stringify(entree.indicateur ? { indicateur: entree.indicateur } : {}),
  };
}

/**
 * COCKPIT_API_BASE=simulation : réponses intégrées pour tester la boucle
 * vocale de bout en bout AVANT le branchement réel. TOUS les chiffres sont
 * FICTIFS (ce dépôt est public — aucune donnée Cockpit réelle n'y entre) ;
 * les cas couvrent le contrat : complet, partiel, non publiable.
 */
const SOURCE_SIMULATION = "SIMULATION — données fictives de test, aucune donnée ANSUT réelle";
const DATE_SIMULATION = "2026-09-10";

const SIMULATION: Record<string, EnveloppeCockpit> = {
  "synthese-matinale": {
    publiable: true,
    a_dire:
      "Bonjour. Trois faits pour ce matin : deux alertes sont ouvertes sur les indicateurs suivis, " +
      "cinq diligences arrivent à échéance cette semaine, et un jalon de projet a été franchi hier. " +
      "Le détail est à l'écran.",
    date_donnees: DATE_SIMULATION,
    perimetre: { complet: true },
    source: SOURCE_SIMULATION,
  },
  "alertes-du-jour": {
    publiable: true,
    a_dire:
      "Deux alertes aujourd'hui : un indicateur est passé au rouge, et trois diligences sont en retard. " +
      "La plus ancienne attend depuis quarante jours ; les structures concernées sont affichées à l'écran.",
    date_donnees: DATE_SIMULATION,
    perimetre: { complet: true },
    source: SOURCE_SIMULATION,
    ecran: { note: "Le nominatif (qui doit quoi) ne passe que par ce champ, jamais par a_dire." },
  },
  "indicateur:test-complet": {
    publiable: true,
    a_dire: "L'indicateur de test est à soixante-deux pour cent, pour une cible de soixante-quinze. L'écart se réduit depuis deux mois.",
    date_donnees: DATE_SIMULATION,
    perimetre: { complet: true },
    source: SOURCE_SIMULATION,
  },
  "indicateur:test-partiel": {
    publiable: true,
    a_dire: "Le taux de test est de douze pour cent.",
    date_donnees: DATE_SIMULATION,
    perimetre: {
      complet: false,
      libelle: "trois directions instruites sur sept",
      manquants: ["direction fictive A", "direction fictive B", "direction fictive C", "direction fictive D"],
    },
    source: SOURCE_SIMULATION,
  },
  "indicateur:test-non-publiable": {
    publiable: false,
    raison: "la source de cet indicateur est débranchée depuis plus de trente jours ; la dernière valeur connue n'est plus représentative.",
  },
};

export function reponseSimulee(acces: AccesCockpit, indicateur?: string): EnveloppeCockpit {
  if (acces !== "indicateur") return SIMULATION[acces];
  return (
    SIMULATION[`indicateur:${indicateur ?? ""}`] ?? {
      publiable: false,
      raison: `l'indicateur « ${indicateur ?? "?"} » n'existe pas dans le jeu de simulation (essayez test-complet, test-partiel ou test-non-publiable).`,
    }
  );
}
