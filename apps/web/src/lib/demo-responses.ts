/**
 * Réponses de démonstration purement locales (front-end), utilisées tant que
 * la recherche documentaire réelle (`searchKnowledge`, Lot 4/5) n'est pas
 * branchée. Aucun appel réseau, aucune IA : ce module simule uniquement les
 * transitions d'état de l'interface pour la démonstration du Lot 1.
 *
 * Conformément à la règle anti-hallucination du cahier des charges
 * (section 58), toute question qui ne correspond à aucun scénario connu
 * reçoit la réponse "je ne sais pas" plutôt qu'une réponse inventée.
 */

interface DemoResponse {
  keywords: string[];
  answer: string;
}

const DEMO_RESPONSES: DemoResponse[] = [
  {
    keywords: ["qui es-tu", "qui êtes-vous", "bonjour suta"],
    answer:
      "Bonjour. Je suis SUTA, l'assistant intelligent d'ANSUT CONNECTE. Je peux vous aider à découvrir les services, programmes et informations de l'ANSUT. Que souhaitez-vous savoir ?",
  },
  {
    keywords: ["ansut"],
    answer:
      "L'ANSUT accompagne le développement du numérique et des télécommunications. Une fois la base de connaissances branchée (Lot 4), je pourrai vous donner des informations précises et sourcées.",
  },
  {
    keywords: ["programme", "jeunes", "entrepreneur", "numérique"],
    answer:
      "Il existe plusieurs programmes d'accompagnement numérique. Cette réponse est un exemple de démonstration ; les véritables programmes proviendront de la base documentaire ANSUT validée (Lot 4).",
  },
  {
    keywords: ["bénéficier", "condition", "comment"],
    answer:
      "Pour bénéficier d'un programme, il faut généralement remplir certaines conditions d'éligibilité. Ceci est une réponse de démonstration : les conditions réelles proviendront des documents officiels une fois la base de connaissances branchée.",
  },
  {
    keywords: ["contact", "contacter", "où"],
    answer:
      "Je pourrai bientôt vous indiquer les coordonnées et les lieux exacts une fois connecté à la base d'information ANSUT.",
  },
  {
    keywords: ["service"],
    answer:
      "L'ANSUT propose plusieurs services. Ceci est un exemple de démonstration en attendant la connexion à la base de connaissances réelle (Lot 4).",
  },
];

const FALLBACK_ANSWER =
  "Je n'ai pas encore suffisamment d'informations fiables dans ma base pour répondre à cette question.";

export function getDemoResponse(question: string): string {
  const normalized = question.toLowerCase();
  const match = DEMO_RESPONSES.find((entry) =>
    entry.keywords.some((keyword) => normalized.includes(keyword)),
  );
  return match?.answer ?? FALLBACK_ANSWER;
}
