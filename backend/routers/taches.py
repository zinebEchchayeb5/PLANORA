from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from pydantic import BaseModel
from typing import Optional, List
from database import get_db
from models import Tache, Projet, User

router = APIRouter(prefix="/taches", tags=["taches"])

class TacheCreate(BaseModel):
    titre: str
    projet_id: Optional[int] = None
    user_id: Optional[int] = None
    statut: str = "todo"
    deadline: Optional[str] = None

class TacheUpdate(BaseModel):
    titre: Optional[str] = None
    statut: Optional[str] = None
    user_id: Optional[int] = None
    deadline: Optional[str] = None

@router.get("/")
def get_taches(db: Session = Depends(get_db)):
    taches = db.query(Tache).order_by(Tache.created_at.desc()).all()
    result = []
    for t in taches:
        result.append({
            "id": t.id, "titre": t.titre, "statut": t.statut,
            "projet_id": t.projet_id, "user_id": t.user_id,
            "deadline": str(t.deadline) if t.deadline else None,
            "created_at": str(t.created_at)
        })
    return result

@router.post("/")
def create_tache(req: TacheCreate, db: Session = Depends(get_db)):
    from datetime import datetime
    tache = Tache(
        titre=req.titre,
        projet_id=req.projet_id,
        user_id=req.user_id,
        statut=req.statut,
        deadline=datetime.fromisoformat(req.deadline) if req.deadline else None
    )
    db.add(tache); db.commit(); db.refresh(tache)
    return {"id": tache.id, "message": "Tâche créée"}

@router.put("/{tache_id}")
def update_tache(tache_id: int, req: TacheUpdate, db: Session = Depends(get_db)):
    t = db.query(Tache).filter(Tache.id == tache_id).first()
    if not t:
        raise HTTPException(status_code=404, detail="Tâche introuvable")
    for k, v in req.dict(exclude_none=True).items():
        setattr(t, k, v)
    db.commit()
    return {"message": "Tâche mise à jour"}

@router.delete("/{tache_id}")
def delete_tache(tache_id: int, db: Session = Depends(get_db)):
    t = db.query(Tache).filter(Tache.id == tache_id).first()
    if not t:
        raise HTTPException(status_code=404, detail="Tâche introuvable")
    db.delete(t); db.commit()
    return {"message": "Tâche supprimée"}