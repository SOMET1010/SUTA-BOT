"""Génère `presence-operateurs-mai-2026.json` depuis l'export interne ANSUT
« localités complètes / présence opérateurs v2 » (xlsx, 8 151 localités,
export du 2 mai 2026, méthode Haversine).

Le fichier SOURCE ne se verse jamais dans ce dépôt public — seules les
fiches dérivées, communicables, le sont (règle de `load-fiches`). Chaque
fiche est factuelle : présence des opérateurs mobiles autour de la localité,
sans aucune donnée de sélection ni de priorisation.

Usage :
    pip install openpyxl
    python3 supabase/fiches/generer-presence-operateurs.py <export.xlsx>

Puis chargement par le circuit normal (supabase/README.md) :
load-fiches (url raw.githubusercontent du JSON) puis embed-chunks
jusqu'à `remaining = 0`.
"""

import json
import re
import sys
from pathlib import Path

import openpyxl

DATE_DONNEES = "2 mai 2026"
SOURCE_ID = "presence-operateurs-2026-05"

OPERATEURS = {"ORANGE": "Orange", "MOOV": "Moov", "MTN": "MTN"}


def nom_propre(brut):
    """ABBE-BEGNINI -> Abbe-Begnini ; N'DOUCI -> N'Douci — chaque mot est
    capitalisé quel que soit le séparateur (espace, trait d'union même
    typographique, apostrophe)."""
    return re.sub(
        r"[A-Za-zÀ-ÖØ-öø-ÿ]+",
        lambda m: m.group(0)[:1].upper() + m.group(0)[1:].lower(),
        str(brut).strip(),
    )


def de_(nom):
    """« de Agboville » -> « d'Agboville » — l'élision française."""
    return f"d'{nom}" if nom[:1].upper() in "AEIOUH" else f"de {nom}"


def liste_operateurs(brut):
    noms = [OPERATEURS.get(op.strip().upper(), nom_propre(op)) for op in str(brut).split(",") if op.strip()]
    if not noms:
        return ""
    if len(noms) == 1:
        return noms[0]
    return ", ".join(noms[:-1]) + " et " + noms[-1]


def fr_nombre(n):
    return f"{int(n):,}".replace(",", " ")


def fr_km(d):
    return f"{float(d):.1f}".replace(".", ",")


def fiche(d):
    nom = nom_propre(d["nom_localite"])
    sp = nom_propre(d["sous_prefecture"])
    dep = nom_propre(d["departement"])
    region = nom_propre(d["region"])
    morceaux = [f"{nom}, sous-préfecture {de_(sp)}, département {de_(dep)}, région {region}."]
    if d.get("population"):
        morceaux.append(f"Population : {fr_nombre(d['population'])} habitants.")

    nb3 = int(d.get("nb_sites_3km") or 0)
    nb5 = int(d.get("nb_sites_5km") or 0)
    dist = d.get("distance_min_km")
    op_proche = OPERATEURS.get(str(d.get("operateur_proche") or "").upper(), "")

    if nb3 > 0:
        ops = liste_operateurs(d.get("operateurs_3km") or "")
        phrase = (
            f"Présence des opérateurs mobiles (données ANSUT au {DATE_DONNEES}) : "
            f"{nb3} site{'s' if nb3 > 1 else ''} à moins de 3 km de la localité"
        )
        if ops:
            phrase += f" — opérateur{'s' if ',' in str(d.get('operateurs_3km') or '') else ''} : {ops}"
        phrase += "."
        morceaux.append(phrase)
    elif nb5 > 0:
        ops5 = liste_operateurs(d.get("operateurs_5km") or "")
        phrase = (
            f"Aucun site mobile à moins de 3 km de la localité, mais {nb5} "
            f"site{'s' if nb5 > 1 else ''} à moins de 5 km"
        )
        if ops5:
            phrase += f" ({ops5})"
        phrase += f" (données ANSUT au {DATE_DONNEES})."
        morceaux.append(phrase)
    else:
        morceaux.append(
            f"Aucun site mobile n'est recensé à moins de 5 km de la localité "
            f"(données ANSUT au {DATE_DONNEES}) : c'est une des zones où la couverture "
            "est la plus incertaine."
        )
    if dist and nb5 > 0:
        qui = f" ({op_proche})" if op_proche else ""
        morceaux.append(f"Le site le plus proche est à environ {fr_km(dist)} km{qui}.")
    morceaux.append(
        "Distances calculées à vol d'oiseau entre la localité et les sites recensés ; "
        "la qualité réelle du signal peut varier sur place."
    )

    return {
        "id": f"presence-op-{d['code_localite']}",
        "title": f"Opérateurs mobiles — {nom} ({sp})",
        "content": " ".join(morceaux),
        "visibility": "PUBLIC",
        "region": region,
        "metadata": {
            "lat": float(d["latitude"]) if d.get("latitude") is not None else None,
            "lng": float(d["longitude"]) if d.get("longitude") is not None else None,
            "nom": nom,
            "departement": dep,
            "sous_prefecture": sp,
            "statut": d.get("statut_synthese"),
            "date_donnees": "2026-05-02",
            "theme": "présence des opérateurs mobiles",
        },
    }


def main():
    if len(sys.argv) != 2:
        raise SystemExit(__doc__)
    wb = openpyxl.load_workbook(sys.argv[1], read_only=True, data_only=True)
    ws = wb["Liste complète"]
    lignes = ws.iter_rows(values_only=True)
    header = next(lignes)
    fiches = []
    vus = set()
    ecartees = 0
    for ligne in lignes:
        d = dict(zip(header, ligne))
        if not d.get("code_localite") or not d.get("nom_localite"):
            continue
        code = str(d["code_localite"])
        if code in vus:
            continue
        vus.add(code)
        if d.get("latitude") is None or d.get("longitude") is None:
            continue
        # Coordonnées sentinelles (999/999 dans l'export = position inconnue) :
        # les distances Haversine de ces lignes sont fausses par construction —
        # on n'affirme rien sur ces localités plutôt que d'affirmer faux.
        lat, lng = float(d["latitude"]), float(d["longitude"])
        if not (4 < lat < 11 and -9 < lng < -2):
            ecartees += 1
            continue
        fiches.append(fiche(d))
    sortie = Path(__file__).parent / "presence-operateurs-mai-2026.json"
    sortie.write_text(json.dumps(fiches, ensure_ascii=False, indent=1), encoding="utf-8")
    print(f"{len(fiches)} fiches -> {sortie} ({sortie.stat().st_size // 1024} Ko) — {ecartees} localité(s) écartée(s) (position inconnue)")


if __name__ == "__main__":
    main()
