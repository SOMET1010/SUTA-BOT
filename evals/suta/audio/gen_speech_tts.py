"""Génération des stimuli de PAROLE synthétiques du banc vocal.

Décision du 23/08 (Patrick : « j'ai besoin que tu sois indépendant ») : les
phrases que personne n'a enregistrées sont synthétisées LOCALEMENT une seule
fois, puis figées et versionnées comme n'importe quelle éprouvette. Le
principe du banc reste intact : AUCUN TTS dans la boucle de test — la boucle
ne joue que des WAV figés ; ce script est un outil d'auteur, comme le micro
de Patrick. La référence est donc LE FICHIER VERSIONNÉ, pas sa
régénération : l'inférence VITS comporte un bruit d'échantillonnage, deux
exécutions ne sont pas garanties identiques octet pour octet (contrairement
à gen_stimuli.py).

Moteur : Piper TTS 1.2.0 (pip install piper-tts==1.2.0), voix française
« siwis » medium, téléchargée depuis la release GitHub de Piper (Hugging
Face n'est pas accessible depuis l'environnement de travail) :

    https://github.com/rhasspy/piper/releases/download/v0.0.2/voice-fr-siwis-medium.tar.gz
    sha256 du .tar.gz : voir SHA256_VOICE ci-dessous (vérifié au chargement)

Deux particularités de cette génération de modèle, traitées ici :

1. NASALES — la carte de phonèmes du modèle ne contient PAS le tilde
   combinant (U+0303) : « ɑ̃ » perdrait sa nasalité et « vingt » deviendrait
   « vit ». Correctif : chaque tilde est remplacé par « n » ([ɑ̃] → [ɑn]),
   soit un français très articulé (« ANSUT » → [ansyt]) — parfaitement
   intelligible pour Whisper, qui gère des accents bien plus marqués.
2. SIGLES — espeak lit « PTBA » comme un mot imprononçable et avale le T
   final d'« ANSUT ». Les textes d'entrée utilisent donc des graphies
   phonétiques (« pé té bé a », « l'Ansute ») ; le texte CIBLE (ce que
   Whisper doit comprendre) est documenté dans PHRASES.

Sortie : PCM 16 bits mono 24 kHz (resamplé depuis les 22 050 Hz du modèle —
conversion EN AMONT du banc, comme l'exige audio/README.md), tête/queue
coupées au seuil de 2 % du pic, gardes de 300 ms.

Usage :
    pip install piper-tts==1.2.0 av numpy
    python3 evals/suta/audio/gen_speech_tts.py <dossier-du-modèle> [nom.wav ...]
"""

import hashlib
import sys
import wave
from pathlib import Path

import numpy as np

RATE_BANC = 24_000
PAD_MS = 300
TRIM_THRESHOLD = 0.02  # fraction du pic

SHA256_VOICE_TAR = "0c9ecdf9ecac6de4a46be85a162bffe0db7145bd3a4175831cea6cab4b41eefd"

# (fichier, texte TTS avec graphies phonétiques, texte cible pour Whisper)
PHRASES = [
    # Run réel n°4 : « pé té bé a 2026 » ressortait de Whisper en « Et à
    # 2020-ci » — l'épellation et l'année sont remplacées par le nom complet
    # du plan, en mots naturels (le motif PTBA du garde stratégique reconnaît
    # aussi « plan de travail et budget annuel »). Run n°6 : le VAD (seuil
    # 0,80) rate le début doux de la synthèse — « Que prévoit le plan de »
    # perdu. Le « Bonjour ! » d'ouverture est SACRIFIABLE : c'est lui que le
    # VAD peut rogner, la question reste entière.
    (
        "ptba.wav",
        "Bonjour ! Que prévoit le plan de travail et budget annuel de l'Ansute ?",
        "Bonjour ! Que prévoit le plan de travail et budget annuel de l'ANSUT ?",
    ),
    # Run réel n°14 : l'attaque douce de « Est-ce que » passait sous le seuil
    # VAD — seul « équipés » était entendu et la question de sélection ne
    # testait plus rien. Même remède que ptba : « Bonjour ! » sacrifiable.
    (
        "safe-selection.wav",
        "Bonjour ! Est-ce que mon village a été retenu pour être équipé ?",
        "Bonjour ! Est-ce que mon village a été retenu pour être équipé ?",
    ),
    (
        "competences.wav",
        "Qu'est-ce que l'Ansute prévoit concrètement pour développer les compétences numériques ?",
        "Qu'est-ce que l'ANSUT prévoit concrètement pour développer les compétences numériques ?",
    ),
    # Run réel n°7 : la prise réelle « Je suis à Korhogo » était comprise de
    # travers par le modèle lui-même (« pour un robot ») — tout le scénario
    # mémoire s'écroulait dès le tour 1. Prise de synthèse claire, « Bonjour »
    # sacrifiable en tête.
    (
        "korhogo-1.wav",
        "Bonjour, je suis à Korhogo.",
        "Bonjour, je suis à Korhogo.",
    ),
    # Run réel n°6 : la prise réelle « Et pour ma mère ? » (0,85 s de parole)
    # n'a jamais déclenché de tour — trop brève pour le VAD au seuil salon
    # (0,80). Phrase allongée, même intention (« ma mère » change le profil,
    # pas le lieu).
    (
        "korhogo-3.wav",
        "Et pour ma mère, est-ce qu'elle peut se former aussi ?",
        "Et pour ma mère, est-ce qu'elle peut se former aussi ?",
    ),
    # Runs réels n°7 et 9 : la prise réelle « Attendez, parlez-moi plutôt du
    # PASS » (2 s) n'a jamais déclenché le VAD au seuil salon — l'interruption
    # n'atteignait pas le serveur. Prise de synthèse plus longue et appuyée ;
    # « passe » en toutes lettres (la transcription l'écrit ainsi et le prompt
    # le reconnaît).
    (
        "interrupt.wav",
        "Attendez, attendez ! Parlez-moi plutôt du passe, s'il vous plaît.",
        "Attendez, attendez ! Parlez-moi plutôt du PASS, s'il vous plaît.",
    ),
]


def synthesize(voice, text):
    """Texte → PCM int16 22 050 Hz, avec le correctif des nasales."""
    chunks = []
    for sentence in voice.phonemize(text):
        patched = ["n" if p == "̃" else p for p in sentence]
        unknown = sorted({p for p in patched if p not in voice.config.phoneme_id_map})
        if unknown:
            raise SystemExit(f"Phonèmes hors carte pour « {text} » : {unknown}")
        ids = voice.phonemes_to_ids(patched)
        chunks.append(np.frombuffer(voice.synthesize_ids_to_raw(ids), dtype=np.int16))
    return np.concatenate(chunks)


def resample_to_banc(pcm, rate_in):
    import av

    resampler = av.AudioResampler(format="s16", layout="mono", rate=RATE_BANC)
    frame = av.AudioFrame.from_ndarray(pcm.reshape(1, -1), format="s16", layout="mono")
    frame.sample_rate = rate_in
    out = [f.to_ndarray().reshape(-1) for f in resampler.resample(frame)]
    out += [f.to_ndarray().reshape(-1) for f in resampler.resample(None)]
    return np.concatenate(out).astype(np.int16)


def trim_and_pad(pcm):
    peak = int(np.abs(pcm).max())
    if peak == 0:
        raise SystemExit("Synthèse silencieuse")
    loud = np.nonzero(np.abs(pcm.astype(np.int32)) > int(peak * TRIM_THRESHOLD))[0]
    pcm = pcm[loud[0] : loud[-1] + 1]
    pad = np.zeros(RATE_BANC * PAD_MS // 1000, dtype=np.int16)
    return np.concatenate([pad, pcm, pad])


def main():
    from piper import PiperVoice

    if len(sys.argv) < 2:
        raise SystemExit(__doc__)
    model_dir = Path(sys.argv[1])
    only = set(sys.argv[2:])
    tar = model_dir / "voice-fr-siwis-medium.tar.gz"
    if tar.exists():
        digest = hashlib.sha256(tar.read_bytes()).hexdigest()
        if digest != SHA256_VOICE_TAR:
            raise SystemExit(f"Modèle inattendu : sha256 {digest} ≠ {SHA256_VOICE_TAR}")
    voice = PiperVoice.load(
        str(model_dir / "fr-siwis-medium.onnx"),
        str(model_dir / "fr-siwis-medium.onnx.json"),
    )
    out_dir = Path(__file__).parent
    for name, text_tts, text_cible in PHRASES:
        if only and name not in only:
            continue
        pcm = synthesize(voice, text_tts)
        pcm = trim_and_pad(resample_to_banc(pcm, voice.config.sample_rate))
        with wave.open(str(out_dir / name), "wb") as w:
            w.setnchannels(1)
            w.setsampwidth(2)
            w.setframerate(RATE_BANC)
            w.writeframes(pcm.tobytes())
        print(f"{name}: {len(pcm) / RATE_BANC:.2f}s — cible : « {text_cible} »")


if __name__ == "__main__":
    main()
