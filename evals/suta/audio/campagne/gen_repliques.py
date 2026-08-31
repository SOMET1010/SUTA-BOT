"""Répliques de l'AGENT-CITOYEN de la campagne conversationnelle.

Même contrat que gen_speech_tts.py (le banc de mesure) : les répliques sont
synthétisées UNE fois par ce script d'auteur, figées et versionnées — la
boucle de campagne (vocal-qa/campagne.mjs) ne joue que des WAV figés, aucun
TTS en cours de test. La conversation est dynamique par le CHOIX de la
réplique suivante (selon ce que SUTA vient de dire), jamais par sa synthèse.

Mêmes règles de fabrication que le banc (voir gen_speech_tts.py) :
- Piper 1.2.0, voix fr-siwis-medium (sha256 vérifié), nasales corrigées ;
- graphies phonétiques pour les sigles (« l'Ansute »), texte cible documenté ;
- phrases assez longues et attaquées par un mot sacrifiable — les prises trop
  brèves ou trop douces ne déclenchent pas le VAD au seuil salon (runs 6/7/9) ;
- sortie PCM 16 bits mono 24 kHz, tête/queue taillées, gardes de 300 ms.

Usage :
    pip install piper-tts==1.2.0 av numpy
    python3 evals/suta/audio/campagne/gen_repliques.py <dossier-du-modèle> [nom.wav ...]
"""

import hashlib
import sys
import wave
from pathlib import Path

import numpy as np

RATE_BANC = 24_000
PAD_MS = 300
TRIM_THRESHOLD = 0.02

SHA256_VOICE_TAR = "0c9ecdf9ecac6de4a46be85a162bffe0db7145bd3a4175831cea6cab4b41eefd"

# (fichier, texte TTS avec graphies phonétiques, texte cible pour Whisper)
REPLIQUES = [
    ("bonjour-village.wav",
     "Bonjour ! Je veux savoir si mon village est connecté.",
     "Bonjour ! Je veux savoir si mon village est connecté."),
    ("localite-tieme.wav",
     "C'est le village de Tiémé, du côté d'Odienné.",
     "C'est le village de Tiémé, du côté d'Odienné."),
    ("dis-moi-plus.wav",
     "D'accord ! Dites-moi en plus, s'il vous plaît.",
     "D'accord ! Dites-moi en plus, s'il vous plaît."),
    ("encore.wav",
     "Et ensuite ? Continuez, je vous écoute.",
     "Et ensuite ? Continuez, je vous écoute."),
    ("internet-maison.wav",
     "Et pour avoir internet à la maison, comment je fais ?",
     "Et pour avoir internet à la maison, comment je fais ?"),
    ("merci.wav",
     "Merci beaucoup, c'est très clair.",
     "Merci beaucoup, c'est très clair."),
    ("service-universel.wav",
     "Bonjour ! C'est quoi le service universel ?",
     "Bonjour ! C'est quoi le service universel ?"),
    ("rnhd.wav",
     "Et le réseau national haut débit, c'est quoi exactement ?",
     "Et le réseau national haut débit, c'est quoi exactement ?"),
    ("bonjour-equiper.wav",
     "Bonjour ! Comment je peux m'équiper en ordinateur ?",
     "Bonjour ! Comment je peux m'équiper en ordinateur ?"),
    ("interruption-former.wav",
     "Attendez, attendez ! Et pour me former, on fait comment ?",
     "Attendez, attendez ! Et pour me former, on fait comment ?"),
    ("rendez-vous.wav",
     "Prenez-moi un rendez-vous, s'il vous plaît.",
     "Prenez-moi un rendez-vous, s'il vous plaît."),
    ("conseiller.wav",
     "Je veux parler à un conseiller, une vraie personne.",
     "Je veux parler à un conseiller, une vraie personne."),
    ("capitale-france.wav",
     "Au fait, quelle est la capitale de la France ?",
     "Au fait, quelle est la capitale de la France ?"),
    ("au-revoir.wav",
     "C'est bon, merci ! Au revoir.",
     "C'est bon, merci ! Au revoir."),
]


def synthesize(voice, text):
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
    for name, text_tts, text_cible in REPLIQUES:
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
