/**
 * Laboratoire langues — le banc d'essai de l'oreille ivoirienne de SUTA.
 *
 * Contexte (09-10/09) : les modèles libres de Meta (Omnilingual ASR)
 * comprennent 22 langues parlées en Côte d'Ivoire — vérifié sur la liste
 * officielle du paquet publié (lang_ids.py, 1 668 entrées). Ce module est
 * la partie PURE du labo : la liste des langues à auditionner et la
 * construction de la requête vers le service de transcription.
 *
 * Le service lui-même n'existe pas encore : il sera hébergé par l'équipe
 * sur Azure après la migration (prérequis GPU — voir la note « SUTA et les
 * langues de Côte d'Ivoire »). Tant que LABO_ASR_ENDPOINT n'est pas
 * renseignée, la page admin explique quoi brancher ; le déploiement de ce
 * code est inerte.
 *
 * CONTRAT DU SERVICE (pour l'équipe de reprise) :
 *   POST {LABO_ASR_ENDPOINT}
 *   entête  Authorization: Bearer {LABO_ASR_KEY}   (si la clé est définie)
 *   corps   { audio: <base64>, mime: "audio/webm", lang: "dyu_Latn" }
 *   réponse { texte: "<transcription>", traduction?: "<français>" }
 * Le champ `traduction` est optionnel : s'il est servi (étape suivante du
 * pilote), la page l'affiche — c'est la marche vers « le citoyen parle
 * dioula, SUTA répond en français ».
 */

export interface LangueLabo {
  /** Code ISO 639-3, sans le script (le service reçoit `${code}_Latn`). */
  code: string;
  nom: string;
  groupe: "mandé" | "kwa" | "krou" | "gur" | "véhiculaire";
  /** true = un modèle de synthèse MMS existe aussi (la « bouche »). */
  synthese: boolean;
}

/** Les 22 langues vérifiées sur la liste officielle Omnilingual ASR
 * (09-10/09), groupées par aire linguistique. L'ordre est celui de
 * l'affichage : le dioula d'abord — la langue véhiculaire des marchés. */
export const LANGUES_LABO: LangueLabo[] = [
  { code: "dyu", nom: "Dioula", groupe: "mandé", synthese: true },
  { code: "bam", nom: "Bambara", groupe: "mandé", synthese: true },
  { code: "bci", nom: "Baoulé", groupe: "kwa", synthese: false },
  { code: "any", nom: "Agni", groupe: "kwa", synthese: true },
  { code: "ati", nom: "Attié", groupe: "kwa", synthese: false },
  { code: "abi", nom: "Abidji", groupe: "kwa", synthese: false },
  { code: "adj", nom: "Adioukrou", groupe: "kwa", synthese: false },
  { code: "dnj", nom: "Dan (Yacouba)", groupe: "mandé", synthese: false },
  { code: "neb", nom: "Toura", groupe: "mandé", synthese: false },
  { code: "mev", nom: "Mano", groupe: "mandé", synthese: false },
  { code: "wob", nom: "Wobé", groupe: "krou", synthese: false },
  { code: "nwb", nom: "Nyabwa", groupe: "krou", synthese: false },
  { code: "ktj", nom: "Krumen plapo", groupe: "krou", synthese: false },
  { code: "ted", nom: "Krumen tépo", groupe: "krou", synthese: false },
  { code: "gud", nom: "Dida", groupe: "krou", synthese: false },
  { code: "dyi", nom: "Sénoufo djimini", groupe: "gur", synthese: false },
  { code: "spp", nom: "Sénoufo supyiré", groupe: "gur", synthese: false },
  { code: "myk", nom: "Sénoufo mamara", groupe: "gur", synthese: false },
  { code: "lob", nom: "Lobi", groupe: "gur", synthese: false },
  { code: "mos", nom: "Mooré", groupe: "véhiculaire", synthese: true },
  { code: "ful", nom: "Peul", groupe: "véhiculaire", synthese: false },
  { code: "hau", nom: "Haoussa", groupe: "véhiculaire", synthese: false },
];

export function langueDuLabo(code: unknown): LangueLabo | null {
  if (typeof code !== "string") return null;
  return LANGUES_LABO.find((l) => l.code === code) ?? null;
}

/** Formats d'enregistrement acceptés (MediaRecorder selon les navigateurs). */
const MIMES_ACCEPTES = /^audio\/(webm|ogg|mp4|mpeg|wav)(;.*)?$/;

export function mimeAudioValide(mime: unknown): mime is string {
  return typeof mime === "string" && MIMES_ACCEPTES.test(mime);
}

/** ~3 Mo d'audio (base64 ≈ 4/3 du binaire) : largement assez pour les
 * 30 secondes du labo, et un garde-fou contre les envois hors protocole. */
export const MAX_AUDIO_BASE64 = 4_000_000;

export function laboAsrConfigured(env: Record<string, string | undefined>): boolean {
  return Boolean(env.LABO_ASR_ENDPOINT);
}

export interface RequeteTranscription {
  url: string;
  headers: Record<string, string>;
  body: string;
}

export function construireRequeteTranscription(
  { audioBase64, mime, code }: { audioBase64: string; mime: string; code: string },
  env: Record<string, string | undefined>,
): RequeteTranscription {
  const endpoint = env.LABO_ASR_ENDPOINT;
  if (!endpoint) {
    throw new Error("Labo langues non branché (LABO_ASR_ENDPOINT).");
  }
  const langue = langueDuLabo(code);
  if (!langue) throw new Error(`Langue inconnue du labo : ${code}.`);
  if (!mimeAudioValide(mime)) throw new Error(`Format audio refusé : ${mime}.`);
  if (audioBase64.length === 0 || audioBase64.length > MAX_AUDIO_BASE64) {
    throw new Error("Audio vide ou trop long pour le labo (30 secondes maximum).");
  }
  const headers: Record<string, string> = { "Content-Type": "application/json" };
  if (env.LABO_ASR_KEY) headers.Authorization = `Bearer ${env.LABO_ASR_KEY}`;
  return {
    url: endpoint,
    headers,
    body: JSON.stringify({ audio: audioBase64, mime, lang: `${langue.code}_Latn` }),
  };
}
