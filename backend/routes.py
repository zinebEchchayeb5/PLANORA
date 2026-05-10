from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from sqlalchemy import func
from pydantic import BaseModel
from typing import Optional, List
from datetime import datetime, timedelta
from database import get_db
from models import (Projet, Client, Tache, Facture, User,
                    StatutProjet, StatutFacture, RoleEnum)
from auth import get_current_user, require_role
import json

# ══════════════════════════════════════════════════
# CLIENTS
# ══════════════════════════════════════════════════
clients_router = APIRouter(prefix="/clients", tags=["clients"])

class ClientCreate(BaseModel):
    nom: str
    prenom: str = None
    email: str = None
    telephone: str = None
    adresse: str = None
    ville: str = None
    cin: str = None
    notes: str = None

class ClientOut(BaseModel):
    id: int
    nom: str
    prenom: str = None
    email: str = None
    telephone: str = None
    ville: str = None
    cin: str = None
    notes: str = None
    created_at: datetime
    class Config:
        from_attributes = True

@clients_router.get("/", response_model=List[ClientOut])
def list_clients(db: Session = Depends(get_db), _=Depends(get_current_user)):
    return db.query(Client).order_by(Client.created_at.desc()).all()

@clients_router.post("/", response_model=ClientOut)
def create_client(data: ClientCreate, db: Session = Depends(get_db), _=Depends(get_current_user)):
    client = Client(**data.dict())
    db.add(client); db.commit(); db.refresh(client)
    return client

@clients_router.get("/{client_id}", response_model=ClientOut)
def get_client(client_id: int, db: Session = Depends(get_db), _=Depends(get_current_user)):
    c = db.query(Client).filter(Client.id == client_id).first()
    if not c: raise HTTPException(404, "Client introuvable")
    return c

@clients_router.put("/{client_id}", response_model=ClientOut)
def update_client(client_id: int, data: ClientCreate, db: Session = Depends(get_db), _=Depends(get_current_user)):
    c = db.query(Client).filter(Client.id == client_id).first()
    if not c: raise HTTPException(404, "Client introuvable")
    for k, v in data.dict(exclude_none=True).items():
        setattr(c, k, v)
    db.commit(); db.refresh(c)
    return c

@clients_router.delete("/{client_id}")
def delete_client(client_id: int, db: Session = Depends(get_db), _=Depends(require_role(RoleEnum.gerant))):
    c = db.query(Client).filter(Client.id == client_id).first()
    if not c: raise HTTPException(404, "Client introuvable")
    db.delete(c); db.commit()
    return {"message": "Client supprimé"}

# ══════════════════════════════════════════════════
# PROJETS
# ══════════════════════════════════════════════════
projets_router = APIRouter(prefix="/projets", tags=["projets"])

class ProjetCreate(BaseModel):
    titre: str
    description: str = None
    type_bien: str = None
    style: str = None
    surface: float = None
    budget: float = None
    statut: StatutProjet = StatutProjet.en_attente
    date_debut: datetime = None
    date_fin_prevue: datetime = None
    adresse_terrain: str = None
    ville: str = None
    client_id: int = None
    responsable_id: int = None

class ProjetOut(BaseModel):
    id: int
    titre: str
    description: str = None
    type_bien: str = None
    style: str = None
    surface: float = None
    budget: float = None
    statut: StatutProjet
    date_debut: datetime = None
    date_fin_prevue: datetime = None
    ville: str = None
    client_id: int = None
    responsable_id: int = None
    created_at: datetime
    class Config:
        from_attributes = True

@projets_router.get("/", response_model=List[ProjetOut])
def list_projets(statut: str = None, db: Session = Depends(get_db), _=Depends(get_current_user)):
    q = db.query(Projet)
    if statut:
        q = q.filter(Projet.statut == statut)
    return q.order_by(Projet.created_at.desc()).all()

@projets_router.post("/", response_model=ProjetOut)
def create_projet(data: ProjetCreate, db: Session = Depends(get_db), _=Depends(get_current_user)):
    projet = Projet(**data.dict())
    db.add(projet); db.commit(); db.refresh(projet)
    return projet

@projets_router.get("/{projet_id}", response_model=ProjetOut)
def get_projet(projet_id: int, db: Session = Depends(get_db), _=Depends(get_current_user)):
    p = db.query(Projet).filter(Projet.id == projet_id).first()
    if not p: raise HTTPException(404, "Projet introuvable")
    return p

@projets_router.put("/{projet_id}", response_model=ProjetOut)
def update_projet(projet_id: int, data: ProjetCreate, db: Session = Depends(get_db), _=Depends(get_current_user)):
    p = db.query(Projet).filter(Projet.id == projet_id).first()
    if not p: raise HTTPException(404, "Projet introuvable")
    for k, v in data.dict(exclude_none=True).items():
        setattr(p, k, v)
    p.updated_at = datetime.utcnow()
    db.commit(); db.refresh(p)
    return p

@projets_router.delete("/{projet_id}")
def delete_projet(projet_id: int, db: Session = Depends(get_db), _=Depends(require_role(RoleEnum.gerant))):
    p = db.query(Projet).filter(Projet.id == projet_id).first()
    if not p: raise HTTPException(404, "Projet introuvable")
    db.delete(p); db.commit()
    return {"message": "Projet supprimé"}

# ══════════════════════════════════════════════════
# TACHES
# ══════════════════════════════════════════════════
taches_router = APIRouter(prefix="/taches", tags=["taches"])

class TacheCreate(BaseModel):
    titre: str
    description: str = None
    statut: str = "a_faire"
    priorite: str = "normale"
    date_debut: datetime = None
    date_echeance: datetime = None
    projet_id: int = None
    assignee_id: int = None

class TacheOut(BaseModel):
    id: int
    titre: str
    description: str = None
    statut: str
    priorite: str
    date_echeance: datetime = None
    projet_id: int = None
    assignee_id: int = None
    created_at: datetime
    class Config:
        from_attributes = True

@taches_router.get("/", response_model=List[TacheOut])
def list_taches(projet_id: int = None, assignee_id: int = None,
                db: Session = Depends(get_db), _=Depends(get_current_user)):
    q = db.query(Tache)
    if projet_id: q = q.filter(Tache.projet_id == projet_id)
    if assignee_id: q = q.filter(Tache.assignee_id == assignee_id)
    return q.order_by(Tache.date_echeance).all()

@taches_router.post("/", response_model=TacheOut)
def create_tache(data: TacheCreate, db: Session = Depends(get_db), _=Depends(get_current_user)):
    tache = Tache(**data.dict())
    db.add(tache); db.commit(); db.refresh(tache)
    return tache

@taches_router.put("/{tache_id}", response_model=TacheOut)
def update_tache(tache_id: int, data: TacheCreate, db: Session = Depends(get_db), _=Depends(get_current_user)):
    t = db.query(Tache).filter(Tache.id == tache_id).first()
    if not t: raise HTTPException(404, "Tâche introuvable")
    for k, v in data.dict(exclude_none=True).items():
        setattr(t, k, v)
    db.commit(); db.refresh(t)
    return t

@taches_router.delete("/{tache_id}")
def delete_tache(tache_id: int, db: Session = Depends(get_db), _=Depends(get_current_user)):
    t = db.query(Tache).filter(Tache.id == tache_id).first()
    if not t: raise HTTPException(404, "Tâche introuvable")
    db.delete(t); db.commit()
    return {"message": "Tâche supprimée"}

# ══════════════════════════════════════════════════
# FACTURES & DEVIS
# ══════════════════════════════════════════════════
factures_router = APIRouter(prefix="/factures", tags=["factures"])

class FactureCreate(BaseModel):
    type_doc: str = "facture"
    montant_ht: float
    tva: float = 20
    statut: StatutFacture = StatutFacture.brouillon
    date_echeance: datetime = None
    notes: str = None
    lignes_json: str = None
    client_id: int = None
    projet_id: int = None

class FactureOut(BaseModel):
    id: int
    numero: str = None
    type_doc: str
    montant_ht: float
    tva: float
    montant_ttc: float
    statut: StatutFacture
    date_emission: datetime
    date_echeance: datetime = None
    date_paiement: datetime = None
    client_id: int = None
    projet_id: int = None
    notes: str = None
    class Config:
        from_attributes = True

def gen_numero(db, type_doc):
    count = db.query(Facture).filter(Facture.type_doc == type_doc).count() + 1
    prefix = "FAC" if type_doc == "facture" else "DEV"
    return f"{prefix}-{datetime.now().year}-{count:04d}"

@factures_router.get("/", response_model=List[FactureOut])
def list_factures(statut: str = None, type_doc: str = None,
                  db: Session = Depends(get_db), _=Depends(get_current_user)):
    q = db.query(Facture)
    if statut: q = q.filter(Facture.statut == statut)
    if type_doc: q = q.filter(Facture.type_doc == type_doc)
    return q.order_by(Facture.date_emission.desc()).all()

@factures_router.post("/", response_model=FactureOut)
def create_facture(data: FactureCreate, db: Session = Depends(get_db), _=Depends(get_current_user)):
    montant_ttc = data.montant_ht * (1 + data.tva / 100)
    facture = Facture(
        **data.dict(),
        montant_ttc=montant_ttc,
        numero=gen_numero(db, data.type_doc)
    )
    db.add(facture); db.commit(); db.refresh(facture)
    return facture

@factures_router.put("/{facture_id}", response_model=FactureOut)
def update_facture(facture_id: int, data: FactureCreate, db: Session = Depends(get_db), _=Depends(get_current_user)):
    f = db.query(Facture).filter(Facture.id == facture_id).first()
    if not f: raise HTTPException(404, "Facture introuvable")
    for k, v in data.dict(exclude_none=True).items():
        setattr(f, k, v)
    f.montant_ttc = f.montant_ht * (1 + f.tva / 100)
    db.commit(); db.refresh(f)
    return f

@factures_router.patch("/{facture_id}/payer")
def marquer_paye(facture_id: int, db: Session = Depends(get_db), _=Depends(get_current_user)):
    f = db.query(Facture).filter(Facture.id == facture_id).first()
    if not f: raise HTTPException(404, "Facture introuvable")
    f.statut = StatutFacture.payee
    f.date_paiement = datetime.utcnow()
    db.commit()
    return {"message": "Facture marquée comme payée"}

# ══════════════════════════════════════════════════
# ÉQUIPE / USERS
# ══════════════════════════════════════════════════
equipe_router = APIRouter(prefix="/equipe", tags=["equipe"])

class UserOut(BaseModel):
    id: int
    nom: str
    prenom: str
    email: str
    role: RoleEnum
    telephone: str = None
    actif: bool
    class Config:
        from_attributes = True

@equipe_router.get("/", response_model=List[UserOut])
def list_equipe(db: Session = Depends(get_db), _=Depends(require_role(RoleEnum.gerant))):
    return db.query(User).all()

@equipe_router.patch("/{user_id}/actif")
def toggle_actif(user_id: int, actif: bool, db: Session = Depends(get_db),
                 _=Depends(require_role(RoleEnum.gerant))):
    u = db.query(User).filter(User.id == user_id).first()
    if not u: raise HTTPException(404, "Utilisateur introuvable")
    u.actif = actif
    db.commit()
    return {"message": "Statut mis à jour"}

# ══════════════════════════════════════════════════
# DASHBOARD — KPIs
# ══════════════════════════════════════════════════
dashboard_router = APIRouter(prefix="/dashboard", tags=["dashboard"])

@dashboard_router.get("/stats")
def get_stats(db: Session = Depends(get_db), _=Depends(require_role(RoleEnum.gerant))):
    now = datetime.utcnow()
    debut_mois = now.replace(day=1, hour=0, minute=0, second=0)

    # Projets
    total_projets = db.query(Projet).count()
    projets_en_cours = db.query(Projet).filter(Projet.statut == StatutProjet.en_cours).count()
    projets_termines = db.query(Projet).filter(Projet.statut == StatutProjet.termine).count()

    # Clients
    total_clients = db.query(Client).count()
    nouveaux_clients_mois = db.query(Client).filter(Client.created_at >= debut_mois).count()

    # Factures
    ca_total = db.query(func.sum(Facture.montant_ttc)).filter(
        Facture.statut == StatutFacture.payee).scalar() or 0
    ca_mois = db.query(func.sum(Facture.montant_ttc)).filter(
        Facture.statut == StatutFacture.payee,
        Facture.date_paiement >= debut_mois).scalar() or 0
    impayees = db.query(Facture).filter(
        Facture.statut.in_([StatutFacture.envoyee, StatutFacture.en_retard])).count()
    montant_impaye = db.query(func.sum(Facture.montant_ttc)).filter(
        Facture.statut.in_([StatutFacture.envoyee, StatutFacture.en_retard])).scalar() or 0

    # Tâches
    taches_retard = db.query(Tache).filter(
        Tache.statut != "termine",
        Tache.date_echeance < now).count()

    # Équipe
    total_employes = db.query(User).filter(User.actif == True).count()

    # CA par mois (6 derniers mois)
    ca_par_mois = []
    for i in range(5, -1, -1):
        debut = (now - timedelta(days=30 * i)).replace(day=1, hour=0, minute=0, second=0)
        fin = (now - timedelta(days=30 * (i - 1))).replace(day=1, hour=0, minute=0, second=0) if i > 0 else now
        ca = db.query(func.sum(Facture.montant_ttc)).filter(
            Facture.statut == StatutFacture.payee,
            Facture.date_paiement >= debut,
            Facture.date_paiement < fin).scalar() or 0
        ca_par_mois.append({
            "mois": debut.strftime("%b %Y"),
            "ca": round(ca)
        })

    # Projets par statut
    projets_par_statut = [
        {"statut": s.value, "count": db.query(Projet).filter(Projet.statut == s).count()}
        for s in StatutProjet
    ]

    return {
        "projets": {
            "total": total_projets,
            "en_cours": projets_en_cours,
            "termines": projets_termines,
        },
        "clients": {
            "total": total_clients,
            "nouveaux_ce_mois": nouveaux_clients_mois,
        },
        "finances": {
            "ca_total": round(ca_total),
            "ca_ce_mois": round(ca_mois),
            "factures_impayees": impayees,
            "montant_impaye": round(montant_impaye),
        },
        "equipe": {
            "total_employes": total_employes,
            "taches_en_retard": taches_retard,
        },
        "ca_par_mois": ca_par_mois,
        "projets_par_statut": projets_par_statut,
    }

@dashboard_router.get("/alertes")
def get_alertes(db: Session = Depends(get_db), _=Depends(require_role(RoleEnum.gerant))):
    now = datetime.utcnow()
    alertes = []

    # Factures impayées > 30 jours
    limite = now - timedelta(days=30)
    impayees = db.query(Facture).filter(
        Facture.statut == StatutFacture.envoyee,
        Facture.date_emission < limite).all()
    for f in impayees:
        alertes.append({
            "type": "danger",
            "message": f"Facture {f.numero} impayée depuis +30 jours ({f.montant_ttc:,.0f} MAD)"
        })

    # Tâches en retard
    taches = db.query(Tache).filter(
        Tache.statut != "termine",
        Tache.date_echeance < now).all()
    for t in taches:
        alertes.append({
            "type": "warning",
            "message": f"Tâche en retard: {t.titre}"
        })

    # Projets deadline dépassée
    projets = db.query(Projet).filter(
        Projet.statut == StatutProjet.en_cours,
        Projet.date_fin_prevue < now).all()
    for p in projets:
        alertes.append({
            "type": "warning",
            "message": f"Projet en retard: {p.titre}"
        })

    return {"alertes": alertes, "total": len(alertes)}