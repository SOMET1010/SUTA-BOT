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
  type LanguePass,
  type PontNatif,
} from "@suta/pass";
import { obtenirPont } from "@/lib/bridge";
import { EXEMPLES, NOM_LANGUE } from "@/lib/exemples";
import {
  PHRASE_EPREUVE,
  TOPONYMES_EPREUVE,
  filtrerFrancaises,
  verdictMoteur,
  type VoixTerminal,
} from "@/lib/voix";

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
/** Le seul endroit qui touche au type DOM : `voix.ts` reste pur, donc testable. */
const enVoixTerminal = (voix: SpeechSynthesisVoice): VoixTerminal => ({
  nom: voix.name,
  langue: voix.lang,
  horsLigne: voix.localService,
});

export default function BancTechnique() {
  const [pont, setPont] = useState<PontNatif | null>(null);
  const [natif, setNatif] = useState(false);
  const [capacites, setCapacites] = useState<CapacitesPont | null>(null);
  const [commande, setCommande] = useState("appelle Awa");
  const [langue, setLangue] = useState<LanguePass>("fr");
  const [voixBrutes, setVoixBrutes] = useState<SpeechSynthesisVoice[]>([]);
  const [voixChoisie, setVoixChoisie] = useState("");
  const [texteAVoix, setTexteAVoix] = useState<string>(PHRASE_EPREUVE);
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

  /**
   * Les voix du terminal n'arrivent pas toujours au premier rendu : le moteur
   * les charge en différé et prévient par `voiceschanged`. Lire une seule fois
   * conclurait à tort qu'il n'y a aucune voix.
   */
  useEffect(() => {
    if (typeof window === "undefined" || !("speechSynthesis" in window)) return;
    const lire = () => {
      const lues = window.speechSynthesis.getVoices();
      if (lues.length === 0) return;
      setVoixBrutes(lues);
      setVoixChoisie((precedente) => {
        if (precedente) return precedente;
        const francaises = filtrerFrancaises(lues.map(enVoixTerminal));
        // À défaut de française, on ne choisit rien : mieux vaut un choix vide
        // qu'une voix anglaise qui ferait croire à un français raté.
        return francaises[0]?.nom ?? "";
      });
    };
    lire();
    window.speechSynthesis.addEventListener("voiceschanged", lire);
    return () => window.speechSynthesis.removeEventListener("voiceschanged", lire);
  }, []);

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

  /** Fait dire un texte par le moteur du terminal, et consigne QUELLE voix a parlé. */
  const parler = useCallback(
    (texte: string) => {
      if (typeof window === "undefined" || !("speechSynthesis" in window)) {
        tracer("echec", "Ce terminal n'expose aucun moteur de synthèse.");
        return;
      }
      const choisie = voixBrutes.find((voix) => voix.name === voixChoisie);
      const enonce = new SpeechSynthesisUtterance(texte);
      if (choisie) {
        enonce.voice = choisie;
        enonce.lang = choisie.lang;
      }
      enonce.onerror = (evenement) => tracer("echec", `Synthèse en échec : « ${texte} »`, evenement.error);
      window.speechSynthesis.cancel();
      window.speechSynthesis.speak(enonce);
      tracer(
        "ok",
        `Dit : « ${texte} »`,
        choisie
          ? `${choisie.name} · ${choisie.lang} · ${choisie.localService ? "hors ligne" : "distante"}`
          : "voix par défaut du terminal",
      );
    },
    [voixBrutes, voixChoisie, tracer],
  );

  /** Chaîne complète : la commande écrite est routée comme le sera la parole. */
  const router = useCallback(async () => {
    // La langue est un PARAMÈTRE de `resoudreAction`, pas une devinette : sans
    // elle, une commande dioula serait lue avec les motifs français, donc
    // refusée. Le journal la mentionne pour que le testeur sache ce qui a été
    // appliqué à son énoncé.
    const resolution = resoudreAction(commande, langue);
    if (resolution.statut === "refusee") {
      tracer("echec", messageRefus().texte, `hors_perimetre · ${NOM_LANGUE[langue]}`);
      return;
    }
    if (resolution.statut === "precision") {
      tracer("attente", resolution.question, `${resolution.intention} · ${NOM_LANGUE[langue]}`);
      return;
    }
    tracer(
      "ok",
      `Routé : ${resolution.intention}`,
      `${NOM_LANGUE[langue]} · ${JSON.stringify(resolution.action.entree)}`,
    );
    await executer(resolution.action, false);
  }, [commande, langue, executer, tracer]);

  const pret = pont !== null && capacites !== null;
  const verdict = verdictMoteur(voixBrutes.map(enVoixTerminal));

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
        <label>Langue de la session</label>
        <div className="grille">
          {(["fr", "dyu"] as const).map((code) => (
            <button
              key={code}
              className={langue === code ? "principal" : undefined}
              onClick={() => {
                setLangue(code);
                setCommande(EXEMPLES[code][0]);
              }}
            >
              {NOM_LANGUE[code]}
            </button>
          ))}
        </div>
        {langue === "dyu" ? (
          <p className="sous">
            Le français reste actif en session dioula : l&apos;alternance codique est la norme, une
            commande qui mêle les deux doit passer. Les formes dioula proposées ci-dessous ne sont
            <strong> pas validées</strong> — c&apos;est à un locuteur natif de les corriger.
          </p>
        ) : null}
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
          {EXEMPLES[langue].map((exemple) => (
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
        <h2>La bouche — moteur de synthèse du terminal</h2>
        <p className="sous">
          Le moteur du <strong>système</strong>, celui qu&apos;une application peut appeler — pas celui de
          Chrome, dont les voix ne sont pas exposées aux applications tierces. Seule une voix{" "}
          <strong>hors ligne</strong> est utilisable par PASS.
        </p>
        <div className="capacites">
          <span className={`puce ${verdict.francaisesHorsLigne > 0 ? "oui" : "non"}`}>
            {verdict.francaisesHorsLigne} française(s) hors ligne
          </span>
          <span className="puce">{verdict.francaises} française(s)</span>
          <span className="puce">{verdict.total} voix au total</span>
          {verdict.codesRencontres.map((code) => (
            <span key={code} className="puce">
              {code}
            </span>
          ))}
        </div>
        <p className="sous">{verdict.conclusion}</p>

        <label htmlFor="voix">Voix</label>
        <select id="voix" value={voixChoisie} onChange={(evenement) => setVoixChoisie(evenement.target.value)}>
          <option value="">— voix par défaut du terminal —</option>
          {voixBrutes.map((voix) => (
            <option key={`${voix.name}-${voix.lang}`} value={voix.name}>
              {voix.name} — {voix.lang}
              {voix.localService ? " — hors ligne" : " — distante"}
            </option>
          ))}
        </select>

        <label htmlFor="texteVoix">Texte à dire</label>
        <input
          id="texteVoix"
          value={texteAVoix}
          onChange={(evenement) => setTexteAVoix(evenement.target.value)}
        />
        <div className="grille" style={{ marginTop: 10 }}>
          <button className="principal" onClick={() => parler(texteAVoix)}>
            Faire parler
          </button>
        </div>

        <label>Les six noms de l&apos;épreuve</label>
        <div className="grille">
          {TOPONYMES_EPREUVE.map((nom) => (
            <button
              key={nom}
              onClick={() => {
                setTexteAVoix(nom);
                parler(nom);
              }}
            >
              {nom}
            </button>
          ))}
        </div>
      </section>

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
