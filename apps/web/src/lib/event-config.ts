/**
 * Configuration de l'encart événement Salon (ex. « Salon ANSUT CONNECTE,
 * Abidjan, du 20 au 22 juin »), affiché dans `SutaIntroduction`.
 *
 * Ces informations sont explicitement illustratives dans la maquette de
 * référence (dates, lieu) : elles ne doivent jamais être codées en dur.
 * Sans configuration explicite (variables d'environnement), l'encart est
 * simplement masqué — jamais de donnée événementielle inventée.
 */
export interface EventConfig {
  enabled: boolean;
  name?: string;
  location?: string;
  startDate?: string;
  endDate?: string;
}

export function getEventConfig(): EventConfig {
  const enabled = process.env.SALON_EVENT_ENABLED === "true";
  if (!enabled) {
    return { enabled: false };
  }

  return {
    enabled: true,
    name: process.env.SALON_EVENT_NAME,
    location: process.env.SALON_EVENT_LOCATION,
    startDate: process.env.SALON_EVENT_START_DATE,
    endDate: process.env.SALON_EVENT_END_DATE,
  };
}
