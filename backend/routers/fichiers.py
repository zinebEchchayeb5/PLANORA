from fastapi import APIRouter, Depends, UploadFile, File, HTTPException, Form
from fastapi.responses import FileResponse, StreamingResponse
from sqlalchemy.orm import Session
from sqlalchemy import Column, Integer, String, Text, DateTime, ForeignKey, Boolean, Float
from pydantic import BaseModel
from typing import Optional, List
from datetime import datetime
from database import get_db, engine
from models import Base
import os, shutil, json, uuid

# ── Storage ──────────────────────────────────────
UPLOAD_DIR = "uploads"
os.makedirs(UPLOAD_DIR, exist_ok=True)

# ── Models ────────────────────────────────────────
class FichierProjet(Base):
    __tablename__ = "fichiers_projets"
    id = Column(Integer, primary_key=True, index=True)
    projet_id = Column(Integer, nullable=True)
    nom_original = Column(String(300))
    nom_stockage = Column(String(300))
    type_fichier = Column(String(50))   # pdf, dwg, image, contrat, devis, plan
    categorie = Column(String(100))     # plan, contrat, devis, photo, autre
    taille = Column(Integer, default=0) # bytes
    version = Column(Integer, default=1)
    parent_id = Column(Integer, nullable=True)  # pour versioning
    description = Column(Text)
    uploaded_by = Column(String(100))
    created_at = Column(DateTime, default=datetime.utcnow)
    actif = Column(Boolean, default=True)

class CommentaireFichier(Base):
    __tablename__ = "commentaires_fichiers"
    id = Column(Integer, primary_key=True)
    fichier_id = Column(Integer, ForeignKey("fichiers_projets.id"))
    auteur = Column(String(100))
    texte = Column(Text)
    created_at = Column(DateTime, default=datetime.utcnow)

class HistoriqueModification(Base):
    __tablename__ = "historique_modifications"
    id = Column(Integer, primary_key=True)
    fichier_id = Column(Integer, ForeignKey("fichiers_projets.id"))
    action = Column(String(100))  # upload, modifie, commenter, telecharger
    auteur = Column(String(100))
    detail = Column(Text)
    created_at = Column(DateTime, default=datetime.utcnow)

Base.metadata.create_all(bind=engine)

router = APIRouter(prefix="/fichiers", tags=["fichiers"])

ALLOWED_TYPES = {
    "application/pdf": ("pdf", "plan"),
    "image/jpeg": ("image", "photo"),
    "image/png": ("image", "photo"),
    "image/webp": ("image", "photo"),
    "application/octet-stream": ("dwg", "plan"),
    "application/vnd.openxmlformats-officedocument.wordprocessingml.document": ("docx", "contrat"),
    "application/msword": ("doc", "contrat"),
    "application/dxf": ("dxf", "plan"),
}

def get_file_icon(type_fichier):
    icons = {"pdf":"📄","image":"🖼️","dwg":"📐","dxf":"📐","docx":"📝","doc":"📝","default":"📁"}
    return icons.get(type_fichier, icons["default"])

def log_history(db, fichier_id, action, auteur, detail=""):
    h = HistoriqueModification(fichier_id=fichier_id, action=action, auteur=auteur, detail=detail)
    db.add(h); db.commit()

# ── Upload ────────────────────────────────────────
@router.post("/upload")
async def upload_fichier(
    file: UploadFile = File(...),
    projet_id: Optional[int] = Form(None),
    categorie: str = Form("autre"),
    description: str = Form(""),
    uploaded_by: str = Form("Utilisateur"),
    db: Session = Depends(get_db)
):
    content = await file.read()
    taille = len(content)

    # Determine type
    content_type = file.content_type or "application/octet-stream"
    ext = file.filename.split(".")[-1].lower() if "." in file.filename else "bin"
    type_map = {"pdf":"pdf","jpg":"image","jpeg":"image","png":"image","webp":"image",
                "dwg":"dwg","dxf":"dxf","docx":"docx","doc":"doc","xlsx":"xlsx","zip":"zip"}
    type_fichier = type_map.get(ext, "autre")

    # Unique storage name
    uid = str(uuid.uuid4())[:8]
    nom_stockage = f"{uid}_{file.filename}"
    path = os.path.join(UPLOAD_DIR, nom_stockage)

    with open(path, "wb") as f:
        f.write(content)

    fichier = FichierProjet(
        projet_id=projet_id,
        nom_original=file.filename,
        nom_stockage=nom_stockage,
        type_fichier=type_fichier,
        categorie=categorie,
        taille=taille,
        description=description,
        uploaded_by=uploaded_by,
    )
    db.add(fichier); db.commit(); db.refresh(fichier)
    log_history(db, fichier.id, "upload", uploaded_by, f"Fichier uploadé: {file.filename}")

    return {
        "id": fichier.id,
        "nom": file.filename,
        "type": type_fichier,
        "taille": taille,
        "version": 1,
        "message": "Fichier uploadé avec succès"
    }

# ── New version ───────────────────────────────────
@router.post("/nouvelle-version/{fichier_id}")
async def nouvelle_version(
    fichier_id: int,
    file: UploadFile = File(...),
    uploaded_by: str = Form("Utilisateur"),
    description: str = Form(""),
    db: Session = Depends(get_db)
):
    parent = db.query(FichierProjet).filter(FichierProjet.id == fichier_id).first()
    if not parent: raise HTTPException(404, "Fichier introuvable")

    content = await file.read()
    ext = file.filename.split(".")[-1].lower() if "." in file.filename else "bin"
    type_map = {"pdf":"pdf","jpg":"image","jpeg":"image","png":"image","dwg":"dwg","dxf":"dxf","docx":"docx"}
    type_fichier = type_map.get(ext, "autre")

    uid = str(uuid.uuid4())[:8]
    nom_stockage = f"{uid}_{file.filename}"
    path = os.path.join(UPLOAD_DIR, nom_stockage)
    with open(path, "wb") as f:
        f.write(content)

    # Get max version
    max_v = db.query(FichierProjet).filter(
        FichierProjet.parent_id == fichier_id
    ).count()

    new_f = FichierProjet(
        projet_id=parent.projet_id,
        nom_original=file.filename,
        nom_stockage=nom_stockage,
        type_fichier=type_fichier,
        categorie=parent.categorie,
        taille=len(content),
        version=parent.version + max_v + 1,
        parent_id=fichier_id,
        description=description or f"Version {parent.version + max_v + 1}",
        uploaded_by=uploaded_by,
    )
    db.add(new_f); db.commit(); db.refresh(new_f)
    log_history(db, fichier_id, "nouvelle_version", uploaded_by, f"Version {new_f.version}")

    return {"id": new_f.id, "version": new_f.version, "message": f"Version {new_f.version} créée"}

# ── List fichiers ─────────────────────────────────
@router.get("/")
def list_fichiers(projet_id: Optional[int] = None, categorie: Optional[str] = None, db: Session = Depends(get_db)):
    q = db.query(FichierProjet).filter(FichierProjet.actif == True, FichierProjet.parent_id == None)
    if projet_id: q = q.filter(FichierProjet.projet_id == projet_id)
    if categorie: q = q.filter(FichierProjet.categorie == categorie)
    fichiers = q.order_by(FichierProjet.created_at.desc()).all()

    result = []
    for f in fichiers:
        # Count versions
        nb_versions = db.query(FichierProjet).filter(FichierProjet.parent_id == f.id).count() + 1
        nb_comments = db.query(CommentaireFichier).filter(CommentaireFichier.fichier_id == f.id).count()
        result.append({
            "id": f.id, "nom": f.nom_original, "type": f.type_fichier,
            "categorie": f.categorie, "taille": f.taille,
            "taille_formatted": _format_size(f.taille),
            "version": f.version, "nb_versions": nb_versions,
            "nb_commentaires": nb_comments,
            "description": f.description, "uploaded_by": f.uploaded_by,
            "created_at": str(f.created_at)[:16],
            "icon": get_file_icon(f.type_fichier),
            "projet_id": f.projet_id,
        })
    return result

# ── Get versions ──────────────────────────────────
@router.get("/{fichier_id}/versions")
def get_versions(fichier_id: int, db: Session = Depends(get_db)):
    parent = db.query(FichierProjet).filter(FichierProjet.id == fichier_id).first()
    if not parent: raise HTTPException(404)
    versions = db.query(FichierProjet).filter(FichierProjet.parent_id == fichier_id).all()
    all_v = [parent] + list(versions)
    return [{
        "id": v.id, "nom": v.nom_original, "version": v.version,
        "description": v.description, "uploaded_by": v.uploaded_by,
        "created_at": str(v.created_at)[:16], "taille": _format_size(v.taille)
    } for v in sorted(all_v, key=lambda x: x.version, reverse=True)]

# ── Download ──────────────────────────────────────
@router.get("/{fichier_id}/download")
def download_fichier(fichier_id: int, db: Session = Depends(get_db)):
    f = db.query(FichierProjet).filter(FichierProjet.id == fichier_id).first()
    if not f: raise HTTPException(404)
    path = os.path.join(UPLOAD_DIR, f.nom_stockage)
    if not os.path.exists(path): raise HTTPException(404, "Fichier non trouvé sur disque")
    log_history(db, fichier_id, "telechargement", "Utilisateur", "")
    return FileResponse(path, filename=f.nom_original)

# ── Comments ──────────────────────────────────────
class CommentCreate(BaseModel):
    texte: str
    auteur: str = "Utilisateur"

@router.post("/{fichier_id}/commentaires")
def add_comment(fichier_id: int, req: CommentCreate, db: Session = Depends(get_db)):
    c = CommentaireFichier(fichier_id=fichier_id, auteur=req.auteur, texte=req.texte)
    db.add(c); db.commit(); db.refresh(c)
    log_history(db, fichier_id, "commentaire", req.auteur, req.texte[:100])
    return {"id": c.id, "message": "Commentaire ajouté"}

@router.get("/{fichier_id}/commentaires")
def get_comments(fichier_id: int, db: Session = Depends(get_db)):
    comments = db.query(CommentaireFichier).filter(
        CommentaireFichier.fichier_id == fichier_id
    ).order_by(CommentaireFichier.created_at.desc()).all()
    return [{"id":c.id,"auteur":c.auteur,"texte":c.texte,"date":str(c.created_at)[:16]} for c in comments]

# ── Historique ────────────────────────────────────
@router.get("/{fichier_id}/historique")
def get_history(fichier_id: int, db: Session = Depends(get_db)):
    h = db.query(HistoriqueModification).filter(
        HistoriqueModification.fichier_id == fichier_id
    ).order_by(HistoriqueModification.created_at.desc()).limit(30).all()
    return [{"id":x.id,"action":x.action,"auteur":x.auteur,"detail":x.detail,"date":str(x.created_at)[:16]} for x in h]

# ── Delete ────────────────────────────────────────
@router.delete("/{fichier_id}")
def delete_fichier(fichier_id: int, db: Session = Depends(get_db)):
    f = db.query(FichierProjet).filter(FichierProjet.id == fichier_id).first()
    if not f: raise HTTPException(404)
    f.actif = False
    db.commit()
    return {"message": "Fichier supprimé"}

# ── Stats ─────────────────────────────────────────
@router.get("/stats/overview")
def get_stats(db: Session = Depends(get_db)):
    total = db.query(FichierProjet).filter(FichierProjet.actif==True).count()
    from sqlalchemy import func
    size = db.query(func.sum(FichierProjet.taille)).scalar() or 0
    by_type = db.query(FichierProjet.type_fichier, func.count()).filter(
        FichierProjet.actif==True
    ).group_by(FichierProjet.type_fichier).all()
    return {
        "total_fichiers": total,
        "taille_totale": _format_size(size),
        "par_type": [{"type":t,"count":c} for t,c in by_type]
    }

def _format_size(size):
    if size < 1024: return f"{size} B"
    elif size < 1024**2: return f"{size//1024} KB"
    else: return f"{size//1024**2} MB"