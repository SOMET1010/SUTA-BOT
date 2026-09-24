/**
 * Lot 3, pièce 1 — la « bouche » Azure Speech, côté serveur.
 *
 * La voie de la voix native SUTA (« Jùlaba ») : le cerveau produit du texte,
 * Azure Speech le prononce. Ce module ne fait que CONSTRUIRE la requête TTS
 * (pur, testable sans réseau) ; la clé n'apparaît que dans les en-têtes que
 * la route serveur enverra — jamais dans le navigateur.
 *
 * Ressource IT : DTDI-AZURESPEECH-SUTA-01 (groupe ANSUT-DTDI, westeurope),
 * provisionnée le 24/08 pour les tests Jùlaba. La bouche de test est une
 * voix française standard d'Azure tant que la voix custom n'existe pas.
 */

export type VoiceEngine = "realtime" | "azure-tts";

/** Interrupteur du lot 3. Toute valeur autre que « azure-tts » (absente,
 * vide, faute de frappe) retombe sur « realtime » : le déploiement de ce
 * code est inerte tant que la variable n'est pas explicitement basculée. */
export function voiceEngine(env: Record<string, string | undefined>): VoiceEngine {
  return env.VOICE_ENGINE === "azure-tts" ? "azure-tts" : "realtime";
}

/** Voix française standard servant de bouche de test avant Jùlaba. */
export const VOIX_TEST_STANDARD = "fr-FR-DeniseNeural";

/** Noms de voix Azure (standard « fr-FR-DeniseNeural » ou custom) : lettres,
 * chiffres, tirets — rien d'autre ne part vers le SSML. */
const VOIX_VALIDE_RE = /^[A-Za-z0-9-]{1,64}$/;

export function voixValide(voix: unknown): voix is string {
  return typeof voix === "string" && VOIX_VALIDE_RE.test(voix);
}

export function azureSpeechConfigured(env: Record<string, string | undefined>): boolean {
  return Boolean(env.AZURE_SPEECH_KEY && (env.AZURE_SPEECH_REGION || env.AZURE_SPEECH_ENDPOINT));
}

function xmlEscape(texte: string): string {
  return texte
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

/** Région du service : AZURE_SPEECH_REGION d'abord ; à défaut, le premier
 * segment de l'hôte d'AZURE_SPEECH_ENDPOINT (l'IT fournit un endpoint de la
 * forme https://westeurope.api.cognitive.microsoft.com/). */
function region(env: Record<string, string | undefined>): string | null {
  if (env.AZURE_SPEECH_REGION) return env.AZURE_SPEECH_REGION;
  if (!env.AZURE_SPEECH_ENDPOINT) return null;
  try {
    return new URL(env.AZURE_SPEECH_ENDPOINT).hostname.split(".")[0] || null;
  } catch {
    return null;
  }
}

export interface RequeteTts {
  url: string;
  headers: Record<string, string>;
  body: string;
}

/**
 * Requête REST TTS v1 (endpoint tts.speech.<région>, distinct de l'endpoint
 * « cognitive » de gestion fourni par l'IT). Sortie MP3 mono 24 kHz — le
 * format du banc et un poids raisonnable pour le streaming vers le salon.
 */
export function construireRequeteTts(
  { texte, voix }: { texte: string; voix?: string },
  env: Record<string, string | undefined>,
): RequeteTts {
  const key = env.AZURE_SPEECH_KEY;
  const reg = region(env);
  if (!key || !reg) {
    throw new Error("Azure Speech non configuré (AZURE_SPEECH_KEY, AZURE_SPEECH_REGION).");
  }
  const nomVoix = voixValide(voix) ? voix : env.AZURE_SPEECH_VOICE && voixValide(env.AZURE_SPEECH_VOICE) ? env.AZURE_SPEECH_VOICE : VOIX_TEST_STANDARD;
  return {
    url: `https://${reg}.tts.speech.microsoft.com/cognitiveservices/v1`,
    headers: {
      "Ocp-Apim-Subscription-Key": key,
      "Content-Type": "application/ssml+xml",
      "X-Microsoft-OutputFormat": "audio-24khz-48kbitrate-mono-mp3",
      "User-Agent": "suta-bot-voice",
    },
    body: `<speak version="1.0" xml:lang="fr-FR"><voice name="${nomVoix}">${xmlEscape(texte)}</voice></speak>`,
  };
}


export interface RequeteVoix {
  url: string;
  headers: Record<string, string>;
}

/**
 * Requête de DÉCOUVERTE des voix offertes par la ressource Azure.
 *
 * Pourquoi elle existe : le labo n'offrait qu'un seul nom de voix en dur,
 * `fr-FR-DeniseNeural`. Le champ accepte pourtant n'importe quel nom — encore
 * faut-il savoir lesquels existent. Plutôt que de figer une liste qui
 * vieillirait (et dont chaque nom faux fait échouer le SSML sans rien dire),
 * on demande la liste au service : elle est toujours exacte, et elle suit les
 * voix que Microsoft ajoute.
 *
 * Même hôte que la synthèse — `tts.speech.<région>` — donc même région, même
 * clé, rien de neuf à configurer.
 */
export function construireRequeteVoix(env: Record<string, string | undefined>): RequeteVoix {
  const key = env.AZURE_SPEECH_KEY;
  const reg = region(env);
  if (!key || !reg) {
    throw new Error("Azure Speech non configuré (AZURE_SPEECH_KEY, AZURE_SPEECH_REGION).");
  }
  return {
    url: `https://${reg}.tts.speech.microsoft.com/cognitiveservices/voices/list`,
    headers: { "Ocp-Apim-Subscription-Key": key, "User-Agent": "suta-bot-voice" },
  };
}

export interface VoixDisponible {
  nom: string;
  locale: string;
  libelle: string;
  genre: string;
}

/**
 * Réduit la réponse d'Azure à ce dont le casting a besoin.
 *
 * `locales` filtre sur le PRÉFIXE : `["fr"]` garde fr-FR, fr-CA, fr-BE,
 * fr-CH — et garderait une locale africaine le jour où elle existerait.
 * C'est volontaire : on ne veut pas réécrire ce filtre à ce moment-là.
 */
export function filtrerVoix(brut: unknown, locales: string[] = ["fr"]): VoixDisponible[] {
  if (!Array.isArray(brut)) return [];
  const voix: VoixDisponible[] = [];
  for (const entree of brut) {
    if (!entree || typeof entree !== "object") continue;
    const e = entree as Record<string, unknown>;
    const nom = typeof e.ShortName === "string" ? e.ShortName : null;
    const locale = typeof e.Locale === "string" ? e.Locale : "";
    if (!nom || !voixValide(nom)) continue;
    if (locales.length && !locales.some((l) => locale.toLowerCase().startsWith(l.toLowerCase()))) continue;
    voix.push({
      nom,
      locale,
      libelle: typeof e.LocalName === "string" ? e.LocalName : typeof e.DisplayName === "string" ? e.DisplayName : nom,
      genre: typeof e.Gender === "string" ? e.Gender : "",
    });
  }
  return voix.sort((a, b) => a.locale.localeCompare(b.locale) || a.nom.localeCompare(b.nom));
}
