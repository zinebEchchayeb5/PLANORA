from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from pydantic import BaseModel
from typing import Optional, List
from database import get_db
from models import Projet, Client, User, Facture, Tache

router = APIRouter(prefix="/projets", tags=["projets"])

STATUTS = ["en_cours", "en_attente", "termine", "annule"]

class ProjetCreate(BaseModel):
    titre: str
    description: Optional[str] = None
    client_id: Optional[int] = None
    user_id: Optional[int] = None
    surface: Optional[int] = None
    type_bien: Optional[str] = None
    budget_estime: Optional[int] = None
    statut: str = "en_cours"

class ProjetUpdate(BaseModel):
    titre: Optional[str] = None
    description: Optional[str] = None
    statut: Optional[str] = None
    surface: Optional[int] = None
    type_bien: Optional[str] = None
    budget_estime: Optional[int] = None

@router.get("/")
def get_projets(db: Session = Depends(get_db)):
    projets = db.query(Projet).order_by(Projet.created_at.desc()).all()
    result = []
    for p in projets:
        client = db.query(Client).filter(Client.id == p.client_id).first()
        user = db.query(User).filter(User.id == p.user_id).first()
        nb_taches = db.query(Tache).filter(Tache.projet_id == p.id).count()
        nb_taches_done = db.query(Tache).filter(Tache.projet_id == p.id, Tache.statut == "done").count()
        result.append({
            "id": p.id, "titre": p.titre, "description": p.description,
            "statut": p.statut, "surface": p.surface, "type_bien": p.type_bien,
            "budget_estime": p.budget_estime, "created_at": str(p.created_at),
            "client": {"id": client.id, "nom": client.nom} if client else None,
            "user": {"id": user.id, "nom": user.nom} if user else None,
            "progression": round(nb_taches_done / nb_taches * 100) if nb_taches > 0 else 0
        })
    return result

@router.get("/stats")
def get_stats(db: Session = Depends(get_db)):
    total = db.query(Projet).count()
    en_cours = db.query(Projet).filter(Projet.statut == "en_cours").count()
    termines = db.query(Projet).filter(Projet.statut == "termine").count()
    nb_clients = db.query(Client).count()
    factures_impayees = db.query(Facture).filter(Facture.statut == "impayee").count()
    budget_total = db.query(Projet).all()
    ca_total = sum(p.budget_estime or 0 for p in budget_total)
    return {
        "total_projets": total,
        "en_cours": en_cours,
        "termines": termines,
        "nb_clients": nb_clients,
        "factures_impayees": factures_impayees,
        "ca_total": ca_total,
        "ca_formatted": f"{ca_total:,} MAD"
    }

@router.get("/{projet_id}")
def get_projet(projet_id: int, db: Session = Depends(get_db)):
    p = db.query(Projet).filter(Projet.id == projet_id).first()
    if not p:
        raise HTTPException(status_code=404, detail="Projet introuvable")
    client = db.query(Client).filter(Client.id == p.client_id).first()
    taches = db.query(Tache).filter(Tache.projet_id == projet_id).all()
    factures = db.query(Facture).filter(Facture.projet_id == projet_id).all()
    return {
        "id": p.id, "titre": p.titre, "description": p.description,
        "statut": p.statut, "surface": p.surface, "type_bien": p.type_bien,
        "budget_estime": p.budget_estime, "created_at": str(p.created_at),
        "client": {"id": client.id, "nom": client.nom, "telephone": client.telephone} if client else None,
        "taches": [{"id": t.id, "titre": t.titre, "statut": t.statut} for t in taches],
        "factures": [{"id": f.id, "montant": f.montant, "statut": f.statut} for f in factures]
    }

@router.post("/")
def create_projet(req: ProjetCreate, db: Session = Depends(get_db)):
    projet = Projet(**req.dict())
    db.add(projet); db.commit(); db.refresh(projet)
    return {"id": projet.id, "titre": projet.titre, "message": "Projet créé"}

@router.put("/{projet_id}")
def update_projet(projet_id: int, req: ProjetUpdate, db: Session = Depends(get_db)):
    p = db.query(Projet).filter(Projet.id == projet_id).first()
    if not p:
        raise HTTPException(status_code=404, detail="Projet introuvable")
    for k, v in req.dict(exclude_none=True).items():
        setattr(p, k, v)
    db.commit()
    return {"message": "Projet mis à jour"}

@router.delete("/{projet_id}")
def delete_projet(projet_id: int, db: Session = Depends(get_db)):
    p = db.query(Projet).filter(Projet.id == projet_id).first()
    if not p:
        raise HTTPException(status_code=404, detail="Projet introuvable")
    db.delete(p); db.commit()
    return {"message": "Projet supprimé"}