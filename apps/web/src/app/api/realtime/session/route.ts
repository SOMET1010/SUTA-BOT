import {
  createResilientRealtimeProvider,
  loadCockpitSystemPrompt,
  loadPassSystemPrompt,
  loadSutaSystemPrompt,
  type RealtimeToolDescriptor,
} from "@suta/ai";
import { decrireActionsPass } from "@suta/pass";
import { SUTA_TOOLS, describeTool } from "@suta/tools";
import { COCKPIT_TOOL_DESCRIPTOR } from "@/lib/cockpit/contrat";
import { modeSuta, type ModeSuta } from "@/lib/pass/mode";
import { voiceEngine } from "@/lib/voice/azure-tts";

// Les voix réellement servies par gpt-realtime (GA) sur Azure — le casting
// doit pouvoir les auditionner toutes, pas seulement une présélection.
const CASTING_VOICES = new Set([
  "alloy", "ash", "ballad", "cedar", "coral", "echo", "marin", "sage", "shimmer", "verse",
]);

/** Le prompt système de chaque instance. Trois modes, trois prompts, zéro pont. */
function promptDuMode(mode: ModeSuta): string {
  switch (mode) {
    case "cockpit":
      return loadCockpitSystemPrompt();
    case "pass":
      return loadPassSystemPrompt();
    case "citoyen":
      return loadSutaSystemPrompt();
  }
}

/**
 * Les outils de chaque instance. L'isolation se joue ICI : une instance ne
 * reçoit QUE ses propres outils, et jamais ceux d'une autre. Un déploiement
 * PASS n'a aucun moyen d'atteindre la base de connaissances citoyenne, et
 * réciproquement l'instance citoyenne ne peut pas piloter un téléphone.
 */
function outilsDuMode(mode: ModeSuta): RealtimeToolDescriptor[] {
  switch (mode) {
    case "cockpit":
      return [COCKPIT_TOOL_DESCRIPTOR];
    case "pass":
      return decrireActionsPass();
    case "citoyen":
      return SUTA_TOOLS.map(describeTool);
  }
}

export async function POST(request: Request) {
  const body: unknown = await request.json().catch(() => null);
  const parsed = body && typeof body === "object" ? (body as { conversationId?: unknown; voice?: unknown }) : {};
  const conversationId = typeof parsed.conversationId === "string" ? parsed.conversationId : undefined;
  const requestedVoice = typeof parsed.voice === "string" && CASTING_VOICES.has(parsed.voice) ? parsed.voice : undefined;

  // Trois instances sur une seule base de code, choisies par SUTA_MODE au
  // déploiement (fiche du 11/09 pour Cockpit, plan PASS du 17/09 pour PASS).
  // Un mode inconnu N'EST PAS traité comme citoyen : voir `lib/pass/mode.ts`,
  // la panne doit être bruyante plutôt que servir la mauvaise instance.
  const mode = modeSuta(process.env as Record<string, string | undefined>);
  if (mode === "inconnu") {
    console.error("[api/realtime/session] SUTA_MODE inconnu :", process.env.SUTA_MODE);
    return Response.json(
      { error: "Cette instance est mal configurée. Contactez l'équipe technique." },
      { status: 503 },
    );
  }

  try {
    const provider = createResilientRealtimeProvider({
      ...(process.env as Record<string, string | undefined>),
      ...(requestedVoice ? { REALTIME_VOICE: requestedVoice } : {}),
    });
    // Lot 3 : en mode azure-tts, le modèle Realtime garde les oreilles et le
    // cerveau mais ne produit que du texte — la voix est synthétisée par
    // Azure Speech côté client (via /api/voice/speak). Défaut : realtime,
    // strictement identique à avant.
    const engine = voiceEngine(process.env as Record<string, string | undefined>);
    const session = await provider.createSession({
      conversationId,
      instructions: promptDuMode(mode),
      tools: outilsDuMode(mode),
      ...(engine === "azure-tts" ? { outputModalities: ["text" as const] } : {}),
    });

    return Response.json({
      sessionId: session.sessionId,
      provider: session.provider,
      model: session.model,
      voice: requestedVoice ?? process.env.REALTIME_VOICE ?? "marin",
      voiceEngine: engine,
      clientSecret: session.clientSecret,
      expiresAt: session.expiresAt,
      webrtcUrl: session.webrtcUrl ?? null,
    });
  } catch (error) {
    console.error("[api/realtime/session] échec de création de session", error);
    return Response.json(
      { error: "Je rencontre momentanément une difficulté technique. Vous pouvez réessayer." },
      { status: 503 },
    );
  }
}
