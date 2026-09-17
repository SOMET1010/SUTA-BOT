"use client";

import { useCallback, useEffect, useState } from "react";
import {
  annonce,
  demandeConfirmation,
  executerAction,
  exigeConfirmation,
  messageRefus,
  messageResultat,
  resoudreAction,
  type ActionPass,
  type CapacitesPont,
  type PontNatif,
} from "@suta/pass";
import { obtenirPont } from "@/lib/bridge";

/**
 * Banc technique SUTA PASS.
 *
 * Son unique raison d'être : éprouver la chaîne
 *
 *     commande → @suta/pass → pont → Android → résultat
 *
 * SANS reconnaissance vocale. Tant que cette chaîne n'est pas nette, brancher
 * l'ASR ne ferait que masquer où ça casse. L'écran offre donc deux entrées :
 *
 * - LA CHAÎNE COMPLÈTE : on tape ce qu'on aurait dit, `resoudreAction` route,
 *   et l'action part au pont — exactement ce que fera la voix plus tard ;
 * - LE PONT SEUL : des boutons qui court-circuitent le routage, pour isoler un
 *   problème Android d'un problème de routage.
 */

type Etat = "ok" | "echec" | "attente";

interface Ligne {
  id: number;
  etat: Etat;
  titre: string;
  detail?: string;
}

const EXEMPLES = [
  "appelle Awa",
  "ouvre WhatsApp",
  "monte le son",
  "mets le volume à 30",
  "prends une photo",
  "aide-moi",
  "quel temps fait-il",
];

export default function BancTechnique() {
  const [pont, setPont] = useState<PontNatif | null>(null);
  const [natif, setNatif] = useState(false);
  const [capacites, setCapacites] = useState<CapacitesPont | null>(null);
  const [commande, setCommande] = useState("appelle Awa");
  const [nom, setNom] = useState("Awa");
  const [application, setApplication] = useState("WhatsApp");
  const [niveau, setNiveau] = useState(30);
  const [aConfirmer, setAConfirmer] = useState<ActionPass | null>(null);
  const [lignes, setLignes] = useState<Ligne[]>([]);

  const tracer = useCallback((etat: Etat, titre: string, detail?: string) => {
    setLignes((precedentes) => [{ id: Date.now() + Math.random(), etat, titre, detail }, ...precedentes].slice(0, 40));
  }, []);

  useEffect(() => {
    let vivant = true;
    void (async () => {
      const { pont: obtenu, natif: estNatif } = await obtenirPont();
      if (!vivant) return;
      setPont(obtenu);
      setNatif(estNatif);
      const lues = await obtenu.capacites();
      if (!vivant) return;
      setCapacites(lues);
      tracer("ok", estNatif ? "Pont natif Android chargé" : "Pont simulé (hors Android)", JSON.stringify(lues));
    })();
    return () => {
      vivant = false;
    };
  }, [tracer]);

  /** Remet une action au pont, après confirmation si elle l'exige. */
  const executer = useCallback(
    async (action: ActionPass, confirmee: boolean) => {
      if (!pont || !capacites) return;

      // Sûreté : rien de sensible ne part en silence. La confirmation est
      // décidée par @suta/pass (lot 1), pas par cet écran.
      if (!confirmee && exigeConfirmation(action)) {
        setAConfirmer(action);
        tracer("attente", demandeConfirmation(action)?.texte ?? "Confirmer ?");
        return;
      }
      setAConfirmer(null);

      if (action.nom === "assistance") {
        tracer("ok", annonce(action).texte || "(rien à dire)");
        return;
      }

      tracer("attente", annonce(action).texte);
      const resultat = await executerAction(pont, action, capacites);
      tracer(
        resultat.ok ? "ok" : "echec",
        messageResultat(resultat).texte,
        [resultat.code, resultat.detail].filter(Boolean).join(" · ") || undefined,
      );
    },
    [pont, capacites, tracer],
  );

  /** Chaîne complète : la commande écrite est routée comme le sera la parole. */
  const router = useCallback(async () => {
    const resolution = resoudreAction(commande);
    if (resolution.statut === "refusee") {
      tracer("echec", messageRefus().texte, "hors_perimetre");
      return;
    }
    if (resolution.statut === "precision") {
      tracer("attente", resolution.question, resolution.intention);
      return;
    }
    tracer("ok", `Routé : ${resolution.intention}`, JSON.stringify(resolution.action.entree));
    await executer(resolution.action, false);
  }, [commande, executer, tracer]);

  const pret = pont !== null && capacites !== null;

  return (
    <main>
      <h1>SUTA PASS — banc technique</h1>
      <p className="sous">
        {natif ? "Android natif." : "Pont simulé — ouvrez l'APK pour le pont réel."} Aucune reconnaissance
        vocale dans ce lot : on tape ce qu&apos;on aurait dit.
      </p>

      <section>
        <h2>Capacités du terminal</h2>
        <div className="capacites">
          {capacites ? (
            Object.entries(capacites).map(([nomCapacite, disponible]) => (
              <span key={nomCapacite} className={`puce ${disponible ? "oui" : "non"}`}>
                {nomCapacite} {disponible ? "✓" : "✗"}
              </span>
            ))
          ) : (
            <span className="puce">lecture…</span>
          )}
        </div>
      </section>

      <section>
        <h2>Chaîne complète — commande → @suta/pass → pont</h2>
        <label htmlFor="commande">Ce que la personne aurait dit</label>
        <input
          id="commande"
          value={commande}
          onChange={(evenement) => setCommande(evenement.target.value)}
          placeholder="appelle Awa"
        />
        <div className="grille" style={{ marginTop: 10 }}>
          <button className="principal" onClick={() => void router()} disabled={!pret}>
            Router et exécuter
          </button>
        </div>
        <label>Exemples</label>
        <div className="grille">
          {EXEMPLES.map((exemple) => (
            <button key={exemple} onClick={() => setCommande(exemple)}>
              {exemple}
            </button>
          ))}
        </div>
      </section>

      <section>
        <h2>Pont seul — sans routage</h2>
        <label htmlFor="nom">Contact à préparer</label>
        <input id="nom" value={nom} onChange={(evenement) => setNom(evenement.target.value)} />
        <div className="grille" style={{ marginTop: 8 }}>
          <button
            disabled={!pret}
            onClick={() => void executer({ nom: "appeler_contact", entree: { nom } }, false)}
          >
            Préparer l&apos;appel
          </button>
        </div>

        <label htmlFor="application">Application à ouvrir</label>
        <input
          id="application"
          value={application}
          onChange={(evenement) => setApplication(evenement.target.value)}
        />
        <div className="grille" style={{ marginTop: 8 }}>
          <button
            disabled={!pret}
            onClick={() => void executer({ nom: "ouvrir_application", entree: { application } }, false)}
          >
            Ouvrir
          </button>
        </div>

        <label htmlFor="niveau">Volume — niveau pour « définir » ({niveau})</label>
        <input
          id="niveau"
          type="range"
          min={0}
          max={100}
          value={niveau}
          onChange={(evenement) => setNiveau(Number(evenement.target.value))}
        />
        <div className="grille" style={{ marginTop: 8 }}>
          {(["monter", "baisser", "couper"] as const).map((sens) => (
            <button
              key={sens}
              disabled={!pret}
              onClick={() => void executer({ nom: "regler_volume", entree: { sens } }, false)}
            >
              {sens}
            </button>
          ))}
          <button
            disabled={!pret}
            onClick={() => void executer({ nom: "regler_volume", entree: { sens: "definir", niveau } }, false)}
          >
            définir {niveau}
          </button>
        </div>

        <label>Appareil photo</label>
        <div className="grille">
          {(["arriere", "avant"] as const).map((camera) => (
            <button
              key={camera}
              disabled={!pret}
              onClick={() => void executer({ nom: "prendre_photo", entree: { camera } }, false)}
            >
              photo {camera}
            </button>
          ))}
        </div>
      </section>

      {aConfirmer ? (
        <div className="confirmation">
          <p>{demandeConfirmation(aConfirmer)?.texte}</p>
          <div className="grille">
            <button className="principal" onClick={() => void executer(aConfirmer, true)}>
              Oui
            </button>
            <button
              onClick={() => {
                setAConfirmer(null);
                tracer("echec", "C'est annulé.", "annule_par_utilisateur");
              }}
            >
              Non
            </button>
          </div>
        </div>
      ) : null}

      <section>
        <h2>Journal</h2>
        {lignes.length === 0 ? (
          <p className="sous">Rien encore.</p>
        ) : (
          <ul className="journal">
            {lignes.map((ligne) => (
              <li key={ligne.id}>
                <span className={ligne.etat}>
                  {ligne.etat === "ok" ? "✓" : ligne.etat === "echec" ? "✗" : "…"} {ligne.titre}
                </span>
                {ligne.detail ? (
                  <>
                    <br />
                    <code>{ligne.detail}</code>
                  </>
                ) : null}
              </li>
            ))}
          </ul>
        )}
      </section>
    </main>
  );
}
