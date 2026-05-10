from fastapi import APIRouter
from pydantic import BaseModel
from typing import Optional
import os
from groq import Groq
from dotenv import load_dotenv

load_dotenv()
client = Groq(api_key=os.getenv("GROQ_API_KEY"))
router = APIRouter(prefix="/ia", tags=["ia"])

# ─── NORMES MAROCAINES ─────────────────────────────────────
NORMES = {
    "surface_min_chambre": 9.0,
    "surface_min_salon": 15.0,
    "surface_min_cuisine": 6.0,
    "surface_min_sdb": 3.5,
    "largeur_min_couloir": 1.2,
    "hauteur_min_plafond": 2.7,
    "recul_min_rue": 2.0,
    "recul_min_voisin": 1.5,
}

class PlanInput(BaseModel):
    rooms: list
    context: Optional[dict] = None
    total_surface: Optional[int] = None
    style: Optional[str] = None

class RapportInput(BaseModel):
    plan: dict
    titre: Optional[str] = "Rapport architectural"
    client_nom: Optional[str] = None

@router.post("/detect-conflicts")
def detect_conflicts(plan: PlanInput):
    conflicts = []
    warnings = []
    score = 100

    for r in plan.rooms:
        surface = round(r["w"] * r["h"], 1)
        name = r["name"]
        rtype = r.get("type", "")

        if rtype == "bedroom" and surface < NORMES["surface_min_chambre"]:
            conflicts.append({"rule": "surface_chambre", "message": f"{name}: {surface}m² < minimum {NORMES['surface_min_chambre']}m² (norme marocaine)"})
            score -= 15

        elif rtype == "living" and "salon" in name.lower() and surface < NORMES["surface_min_salon"]:
            warnings.append({"rule": "surface_salon", "message": f"{name}: {surface}m² recommandé ≥ {NORMES['surface_min_salon']}m²"})
            score -= 5

        elif rtype == "kitchen" and surface < NORMES["surface_min_cuisine"]:
            warnings.append({"rule": "surface_cuisine", "message": f"{name}: {surface}m² < recommandé {NORMES['surface_min_cuisine']}m²"})
            score -= 5

        elif rtype == "bathroom" and surface < NORMES["surface_min_sdb"]:
            conflicts.append({"rule": "surface_sdb", "message": f"{name}: {surface}m² < minimum {NORMES['surface_min_sdb']}m² (norme marocaine)"})
            score -= 10

        elif rtype == "corridor" and r["w"] < NORMES["largeur_min_couloir"]:
            warnings.append({"rule": "largeur_couloir", "message": f"{name}: largeur {r['w']}m < recommandé {NORMES['largeur_min_couloir']}m"})
            score -= 5

    # Vérif reculs
    ctx = plan.context or {}
    recul_av = ctx.get("recul_avant", 0)
    recul_lat = ctx.get("recul_lateral", 0)

    if recul_av < NORMES["recul_min_rue"]:
        conflicts.append({"rule": "recul_rue", "message": f"Recul avant {recul_av}m < minimum {NORMES['recul_min_rue']}m (PLU marocain)"})
        score -= 15

    if recul_lat < NORMES["recul_min_voisin"] and ctx.get("contexte") != "milieu_urbain":
        warnings.append({"rule": "recul_voisin", "message": f"Recul latéral {recul_lat}m < recommandé {NORMES['recul_min_voisin']}m"})
        score -= 5

    # Vérif SDB / Chambres ratio
    nb_ch = len([r for r in plan.rooms if r.get("type") == "bedroom"])
    nb_sdb = len([r for r in plan.rooms if r.get("type") == "bathroom"])
    if nb_ch >= 3 and nb_sdb < 2:
        warnings.append({"rule": "ratio_sdb", "message": f"{nb_ch} chambres avec seulement {nb_sdb} SDB — recommandé 2 SDB minimum"})
        score -= 5

    score = max(0, min(100, score))

    if score >= 90:
        status = "✅ Excellent — Plan conforme aux normes marocaines"
    elif score >= 70:
        status = "⚠️ Acceptable — Quelques points à corriger"
    else:
        status = "❌ Non conforme — Corrections importantes requises"

    return {
        "score": score,
        "status": status,
        "conflicts": conflicts,
        "warnings": warnings,
        "normes_ref": "DTM Maroc + Règlement général de construction"
    }


@router.post("/generate-rapport")
def generate_rapport(req: RapportInput):
    plan = req.plan
    rooms = plan.get("rooms", [])
    ctx = plan.get("context", {})
    cost = req.plan.get("cost", {})

    rooms_summary = "\n".join([f"- {r['name']}: {round(r['w']*r['h'],1)}m² ({r['type']})" for r in rooms])

    prompt = f"""Tu es un architecte expert. Rédige un rapport technique professionnel en français pour ce projet architectural.

PROJET: {req.titre}
{f"CLIENT: {req.client_nom}" if req.client_nom else ""}
TYPE: {ctx.get('type_bien','?')} | STYLE: {plan.get('style','?')} | SURFACE: {plan.get('total_surface','?')}m²
CONTEXTE: {ctx.get('contexte','?')}
RECULS: avant {ctx.get('recul_avant','?')}m / latéral {ctx.get('recul_lateral','?')}m / arrière {ctx.get('recul_arriere','?')}m

PIÈCES:
{rooms_summary}

BUDGET ESTIMÉ: {plan.get('cost', {}).get('total_cost_formatted', 'Non calculé') if isinstance(plan.get('cost'), dict) else 'Non calculé'}

Rédige un rapport structuré avec:
1. Description générale du projet
2. Analyse des espaces (surfaces, distribution, circulation)
3. Conformité aux normes marocaines
4. Matériaux recommandés selon le style et le contexte
5. Estimation budgétaire et recommandations
6. Conclusion et points d'amélioration

Style: professionnel, concis, 300-400 mots."""

    try:
        response = client.chat.completions.create(
            model="llama-3.3-70b-versatile",
            messages=[{"role":"user","content":prompt}],
            max_tokens=600,
            temperature=0.4
        )
        return {"success": True, "rapport": response.choices[0].message.content}
    except Exception as e:
        return {"success": False, "error": str(e)}