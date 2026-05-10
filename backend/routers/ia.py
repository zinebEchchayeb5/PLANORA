from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session
from pydantic import BaseModel
from typing import Optional
from database import get_db
from models import Projet, Facture, Client
from chatbot_groq import chat_groq
import json

router = APIRouter(prefix="/ia", tags=["ia"])

# ══════════════════════════════════════════════════
# 1. DÉTECTION CONFLITS NORMES MAROCAINES
# ══════════════════════════════════════════════════
NORMES_MAROC = {
    "surface_min_chambre": 9,
    "surface_min_salon": 20,
    "surface_min_cuisine": 8,
    "surface_min_sdb": 3.5,
    "largeur_min_couloir": 1.2,
    "recul_avant_min": 3,
    "recul_lateral_min": 1.5,
    "hauteur_min_piece": 2.5,
}

@router.post("/detect-conflicts")
def detect_conflicts(plan: dict):
    conflicts = []
    warnings = []
    rooms = plan.get("rooms", [])
    context = plan.get("context", {})

    for room in rooms:
        s = room.get("w", 0) * room.get("h", 0)
        name = room.get("name", "")
        rtype = room.get("type", "")

        if rtype == "bedroom" and s < NORMES_MAROC["surface_min_chambre"]:
            conflicts.append({
                "type": "error",
                "piece": name,
                "message": f"{name}: {s}m² < minimum réglementaire {NORMES_MAROC['surface_min_chambre']}m²",
                "norme": "Art. 15 — Règlement de construction Maroc"
            })
        elif rtype == "living" and s < NORMES_MAROC["surface_min_salon"]:
            warnings.append({
                "type": "warning",
                "piece": name,
                "message": f"{name}: {s}m² — recommandé ≥ {NORMES_MAROC['surface_min_salon']}m²",
                "norme": "Recommandation DTM"
            })
        elif rtype == "kitchen" and s < NORMES_MAROC["surface_min_cuisine"]:
            conflicts.append({
                "type": "error",
                "piece": name,
                "message": f"{name}: {s}m² < minimum {NORMES_MAROC['surface_min_cuisine']}m²",
                "norme": "Art. 18 — Règlement sanitaire"
            })
        elif rtype == "bathroom" and s < NORMES_MAROC["surface_min_sdb"]:
            warnings.append({
                "type": "warning",
                "piece": name,
                "message": f"{name}: {s}m² — recommandé ≥ {NORMES_MAROC['surface_min_sdb']}m²",
                "norme": "Norme sanitaire marocaine"
            })
        elif rtype == "corridor" and room.get("w", 0) < NORMES_MAROC["largeur_min_couloir"]:
            conflicts.append({
                "type": "error",
                "piece": name,
                "message": f"Couloir: largeur {room.get('w')}m < minimum {NORMES_MAROC['largeur_min_couloir']}m",
                "norme": "Accessibilité PMR — Décret 2-17-467"
            })

    # Vérif reculs
    recul_avant = context.get("recul_avant", 0)
    recul_lat = context.get("recul_lateral", 0)
    if recul_avant < NORMES_MAROC["recul_avant_min"]:
        conflicts.append({
            "type": "error",
            "piece": "Recul avant",
            "message": f"Recul avant {recul_avant}m < minimum {NORMES_MAROC['recul_avant_min']}m",
            "norme": "Art. 42 — Règlement de voirie"
        })
    if recul_lat < NORMES_MAROC["recul_lateral_min"]:
        warnings.append({
            "type": "warning",
            "piece": "Recul latéral",
            "message": f"Recul latéral {recul_lat}m — recommandé ≥ {NORMES_MAROC['recul_lateral_min']}m",
            "norme": "Art. 43 — Règlement de construction"
        })

    score = max(0, 100 - len(conflicts) * 20 - len(warnings) * 5)
    status = "✅ Conforme" if len(conflicts) == 0 else "❌ Non conforme"

    return {
        "score": score,
        "status": status,
        "conflicts": conflicts,
        "warnings": warnings,
        "total_issues": len(conflicts) + len(warnings),
        "normes_verifiees": len(NORMES_MAROC)
    }


# ══════════════════════════════════════════════════
# 2. GÉNÉRATION RAPPORT IA AUTOMATIQUE
# ══════════════════════════════════════════════════
class RapportRequest(BaseModel):
    projet_id: Optional[int] = None
    plan: Optional[dict] = None
    titre: str = "Rapport de projet"

@router.post("/generate-rapport")
def generate_rapport(req: RapportRequest, db: Session = Depends(get_db)):
    context_parts = []

    if req.projet_id:
        projet = db.query(Projet).filter(Projet.id == req.projet_id).first()
        if projet:
            client = db.query(Client).filter(Client.id == projet.client_id).first()
            context_parts.append(f"""
PROJET: {projet.titre}
Type: {projet.type_bien} | Style: N/A | Surface: {projet.surface}m²
Client: {client.nom if client else 'N/A'}
Budget estimé: {projet.budget_estime:,} MAD
Statut: {projet.statut}
""")

    if req.plan:
        rooms = req.plan.get("rooms", [])
        rooms_info = "\n".join([f"- {r['name']}: {round(r['w']*r['h'],1)}m² ({r['type']})" for r in rooms])
        style = req.plan.get("style", "")
        layout = req.plan.get("layout", "")
        context_parts.append(f"""
PLAN ARCHITECTURAL:
Style: {style} | Layout: {layout} | Surface totale: {req.plan.get('total_surface')}m²
Pièces:
{rooms_info}
""")

    full_context = "\n".join(context_parts)
    prompt = f"""Tu es un architecte expert. Génère un rapport technique professionnel et complet pour ce projet architectural.

{full_context}

Le rapport doit contenir:
1. PRÉSENTATION DU PROJET
2. ANALYSE DES ESPACES (surfaces, ratios, conformité)
3. RECOMMANDATIONS ARCHITECTURALES
4. MATÉRIAUX RECOMMANDÉS (contexte marocain)
5. ESTIMATION BUDGÉTAIRE DÉTAILLÉE
6. CONCLUSION ET AVIS PROFESSIONNEL

Sois précis, professionnel, et utilise des données chiffrées. Maximum 600 mots."""

    try:
        rapport_text = chat_groq(prompt)
        return {
            "success": True,
            "titre": req.titre,
            "rapport": rapport_text,
            "date": __import__("datetime").datetime.now().strftime("%d/%m/%Y"),
        }
    except Exception as e:
        return {"success": False, "error": str(e)}


# ══════════════════════════════════════════════════
# 3. PRÉVISION CA
# ══════════════════════════════════════════════════
@router.get("/prevision-ca")
def prevision_ca(db: Session = Depends(get_db)):
    from datetime import datetime, timedelta

    projets = db.query(Projet).all()
    factures = db.query(Facture).all()

    # CA par mois (6 derniers mois)
    now = datetime.now()
    ca_historique = []
    for i in range(5, -1, -1):
        debut = (now - timedelta(days=30*i)).replace(day=1)
        fin = (now - timedelta(days=30*(i-1))).replace(day=1) if i > 0 else now
        ca = sum(
            f.montant for f in factures
            if f.statut == "payee" and f.date_emission and debut <= f.date_emission <= fin
        )
        ca_historique.append({"mois": debut.strftime("%b %Y"), "ca": ca})

    # Prévision simple: moyenne pondérée des 3 derniers mois
    recent = [m["ca"] for m in ca_historique[-3:] if m["ca"] > 0]
    if recent:
        prevision = int(sum(r * (i+1) for i, r in enumerate(recent)) / sum(range(1, len(recent)+1)))
        tendance = "hausse" if len(recent) >= 2 and recent[-1] > recent[0] else "baisse" if len(recent) >= 2 and recent[-1] < recent[0] else "stable"
    else:
        # Basé sur projets en cours
        prevision = int(sum(p.budget_estime or 0 for p in projets if p.statut == "en_cours") * 0.1)
        tendance = "stable"

    # Projets à facturer ce mois
    projets_a_facturer = db.query(Projet).filter(Projet.statut == "en_cours").count()

    return {
        "historique": ca_historique,
        "prevision_mois_prochain": prevision,
        "prevision_formatted": f"{prevision:,} MAD",
        "tendance": tendance,
        "projets_en_cours": projets_a_facturer,
        "conseil": f"Tendance {tendance} — {'Bon momentum, continuez!' if tendance == 'hausse' else 'Attention aux recouvrements' if tendance == 'baisse' else 'Activité stable ce trimestre'}"
    }


# ══════════════════════════════════════════════════
# 4. SMART ASSIGNMENT
# ══════════════════════════════════════════════════
@router.get("/smart-assignment/{projet_id}")
def smart_assignment(projet_id: int, db: Session = Depends(get_db)):
    from models import User
    projet = db.query(Projet).filter(Projet.id == projet_id).first()
    if not projet:
        return {"error": "Projet introuvable"}

    users = db.query(User).all()
    suggestions = []

    for u in users:
        nb_projets = db.query(Projet).filter(
            Projet.user_id == u.id,
            Projet.statut == "en_cours"
        ).count()
        nb_taches = db.query(Tache).filter(
            Tache.user_id == u.id,
            Tache.statut != "done"
        ).count() if hasattr(db.query(Tache), 'filter') else 0

        charge_score = nb_projets * 30 + nb_taches * 10
        disponibilite = "Disponible" if charge_score < 60 else "Chargé" if charge_score < 100 else "Surchargé"

        suggestions.append({
            "user_id": u.id,
            "nom": f"{u.nom}",
            "role": u.role,
            "projets_en_cours": nb_projets,
            "taches_actives": nb_taches,
            "charge_score": charge_score,
            "disponibilite": disponibilite,
            "recommande": charge_score < 60
        })

    suggestions.sort(key=lambda x: x["charge_score"])
    return {
        "projet": projet.titre,
        "suggestions": suggestions,
        "meilleur_choix": suggestions[0] if suggestions else None
    }


# Import Tache model for smart assignment
try:
    from models import Tache
except ImportError:
    pass