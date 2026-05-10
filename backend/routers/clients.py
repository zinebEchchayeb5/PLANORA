from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from pydantic import BaseModel
from typing import Optional, List
from database import get_db
from models import Client, Projet

router = APIRouter(prefix="/clients", tags=["clients"])

class ClientCreate(BaseModel):
    nom: str
    email: Optional[str] = None
    telephone: Optional[str] = None
    adresse: Optional[str] = None

class ClientUpdate(BaseModel):
    nom: Optional[str] = None
    email: Optional[str] = None
    telephone: Optional[str] = None
    adresse: Optional[str] = None

@router.get("/")
def get_clients(db: Session = Depends(get_db)):
    clients = db.query(Client).order_by(Client.created_at.desc()).all()
    result = []
    for c in clients:
        nb_projets = db.query(Projet).filter(Projet.client_id == c.id).count()
        result.append({
            "id": c.id, "nom": c.nom, "email": c.email,
            "telephone": c.telephone, "adresse": c.adresse,
            "created_at": str(c.created_at), "nb_projets": nb_projets
        })
    return result

@router.get("/{client_id}")
def get_client(client_id: int, db: Session = Depends(get_db)):
    c = db.query(Client).filter(Client.id == client_id).first()
    if not c:
        raise HTTPException(status_code=404, detail="Client introuvable")
    projets = db.query(Projet).filter(Projet.client_id == client_id).all()
    return {
        "id": c.id, "nom": c.nom, "email": c.email,
        "telephone": c.telephone, "adresse": c.adresse,
        "created_at": str(c.created_at),
        "projets": [{"id": p.id, "titre": p.titre, "statut": p.statut} for p in projets]
    }

@router.post("/")
def create_client(req: ClientCreate, db: Session = Depends(get_db)):
    client = Client(**req.dict())
    db.add(client); db.commit(); db.refresh(client)
    return {"id": client.id, "nom": client.nom, "message": "Client créé"}

@router.put("/{client_id}")
def update_client(client_id: int, req: ClientUpdate, db: Session = Depends(get_db)):
    c = db.query(Client).filter(Client.id == client_id).first()
    if not c:
        raise HTTPException(status_code=404, detail="Client introuvable")
    for k, v in req.dict(exclude_none=True).items():
        setattr(c, k, v)
    db.commit()
    return {"message": "Client mis à jour"}

@router.delete("/{client_id}")
def delete_client(client_id: int, db: Session = Depends(get_db)):
    c = db.query(Client).filter(Client.id == client_id).first()
    if not c:
        raise HTTPException(status_code=404, detail="Client introuvable")
    db.delete(c); db.commit()
    return {"message": "Client supprimé"}