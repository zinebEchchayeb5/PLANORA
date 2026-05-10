from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from pydantic import BaseModel
from typing import Optional
from database import get_db
from models import Facture, Projet
from datetime import datetime

router = APIRouter(prefix="/factures", tags=["factures"])

class FactureCreate(BaseModel):
    projet_id: int
    montant: int
    statut: str = "impayee"
    date_echeance: Optional[str] = None

@router.get("/")
def get_factures(db: Session = Depends(get_db)):
    factures = db.query(Facture).order_by(Facture.date_emission.desc()).all()
    result = []
    for f in factures:
        projet = db.query(Projet).filter(Projet.id == f.projet_id).first()
        result.append({
            "id": f.id, "montant": f.montant, "statut": f.statut,
            "date_emission": str(f.date_emission), "date_echeance": str(f.date_echeance) if f.date_echeance else None,
            "projet": {"id": projet.id, "titre": projet.titre} if projet else None
        })
    return result

@router.post("/")
def create_facture(req: FactureCreate, db: Session = Depends(get_db)):
    facture = Facture(
        projet_id=req.projet_id, montant=req.montant, statut=req.statut,
        date_echeance=datetime.fromisoformat(req.date_echeance) if req.date_echeance else None
    )
    db.add(facture); db.commit(); db.refresh(facture)
    return {"id": facture.id, "message": "Facture créée"}

@router.put("/{facture_id}/statut")
def update_statut(facture_id: int, statut: str, db: Session = Depends(get_db)):
    f = db.query(Facture).filter(Facture.id == facture_id).first()
    if not f:
        raise HTTPException(status_code=404, detail="Facture introuvable")
    f.statut = statut
    db.commit()
    return {"message": f"Statut mis à jour: {statut}"}

@router.delete("/{facture_id}")
def delete_facture(facture_id: int, db: Session = Depends(get_db)):
    f = db.query(Facture).filter(Facture.id == facture_id).first()
    if not f:
        raise HTTPException(status_code=404, detail="Facture introuvable")
    db.delete(f); db.commit()
    return {"message": "Facture supprimée"}