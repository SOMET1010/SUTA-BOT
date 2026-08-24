/**
 * Découpage incrémental du texte du cerveau en phrases prononçables
 * (lot 3, VOICE_ENGINE=azure-tts) : les deltas arrivent au fil de la
 * génération, et chaque phrase complète part en synthèse SANS attendre la
 * fin de la réponse — c'est ce qui rend la première parole rapide.
 *
 * Règles simples, assumées : une phrase se clôt sur . ! ? … suivi d'un
 * blanc, ou sur un saut de ligne (les réponses de SUTA séparent leurs
 * paragraphes ainsi). Une « phrase » de moins de 4 caractères n'est pas
 * émise seule — elle attend la suivante (protège « D'accord. » tronqué en
 * cours de delta, et les initiales du type « M. »).
 */

const FIN_DE_PHRASE = /([.!?…]+["»)\]]?\s+|\n+)/;
const LONGUEUR_MIN = 4;

export class SentenceStream {
  private buffer = "";

  /** Ajoute un delta ; retourne les phrases complètes détectées, dans l'ordre. */
  push(delta: string): string[] {
    this.buffer += delta;
    const phrases: string[] = [];
    for (;;) {
      const match = FIN_DE_PHRASE.exec(this.buffer);
      if (!match) break;
      const fin = match.index + match[0].length;
      const candidate = this.buffer.slice(0, fin).trim();
      if (candidate.length < LONGUEUR_MIN) {
        // Trop court pour être prononcé seul : on attend la suite — sauf si
        // le tampon continue déjà au-delà (vrai fragment court : on le garde
        // collé à la phrase suivante en ne coupant pas ici).
        if (this.buffer.length === fin) break;
        // Cherche la clôture suivante en gardant le fragment en tête.
        const rest = this.buffer.slice(fin);
        const next = FIN_DE_PHRASE.exec(rest);
        if (!next) break;
        const finSuivante = fin + next.index + next[0].length;
        phrases.push(this.buffer.slice(0, finSuivante).trim());
        this.buffer = this.buffer.slice(finSuivante);
        continue;
      }
      phrases.push(candidate);
      this.buffer = this.buffer.slice(fin);
    }
    return phrases;
  }

  /** Fin de réponse : rend le reliquat (dernière phrase sans ponctuation
   * finale suivie d'un blanc), ou null s'il n'y a rien à prononcer. */
  flush(): string | null {
    const rest = this.buffer.trim();
    this.buffer = "";
    return rest.length > 0 ? rest : null;
  }
}
