import os
from datetime import datetime
from fastapi import APIRouter, Depends, UploadFile, File, Form, HTTPException, Query
from fastapi.responses import FileResponse
from sqlalchemy.orm import Session
from sqlalchemy import Column, Integer, String, Float, DateTime, ForeignKey, Text
from database import Base, get_db, SessionLocal, engine

router = APIRouter(prefix="/documents", tags=["Documents"])

# ==================== MODÈLES (définis localement) ====================

class Document(Base):
    __tablename__ = "documents"

    id = Column(Integer, primary_key=True, index=True)
    nom = Column(String(255), nullable=False)
    description = Column(String(500), default="")
    categorie = Column(String(50), default="autre")
    format_fichier = Column(String(10))
    taille = Column(Float, default=0)
    version_actuelle = Column(Integer, default=1)
    cree_par = Column(String(100))
    date_creation = Column(DateTime, default=datetime.utcnow)
    chemin_fichier = Column(String(500))

    versions = relationship("DocumentVersion", back_populates="document", cascade="all, delete-orphan")


class DocumentVersion(Base):
    __tablename__ = "versions_documents"

    id = Column(Integer, primary_key=True, index=True)
    document_id = Column(Integer, ForeignKey("documents.id", ondelete="CASCADE"), nullable=False)
    version_numero = Column(Integer, nullable=False)
    chemin_fichier = Column(String(500))
    commentaire = Column(String(300), default="")
    modifie_par = Column(String(100))
    date_modification = Column(DateTime, default=datetime.utcnow)

    document = relationship("Document", back_populates="versions")


# ==================== CRÉATION DES TABLES ====================
Base.metadata.create_all(bind=engine, tables=[Document.__table__, DocumentVersion.__table__])


# ==================== CONFIGURATION ====================
UPLOAD_DIR = "uploads/documents"
os.makedirs(UPLOAD_DIR, exist_ok=True)


# ==================== ENDPOINTS ====================

@router.get("/")
def list_documents(db: Session = Depends(get_db)):
    """Liste tous les documents"""
    docs = db.query(Document).order_by(Document.date_creation.desc()).all()
    return docs


@router.post("/upload")
async def upload_document(
    file: UploadFile = File(...),
    description: str = Form(""),
    categorie: str = Form("autre"),
    cree_par: str = Form("Architecte"),
    commentaire: str = Form("Version initiale"),
    db: Session = Depends(get_db)
):
    """Upload un nouveau document avec version initiale"""
    
    # Lire le contenu du fichier
    contents = await file.read()
    taille_mo = round(len(contents) / (1024 * 1024), 2)

    # Extension
    ext = os.path.splitext(file.filename)[1].lower() if file.filename else ""
    format_fichier = ext

    # Créer le document
    new_doc = Document(
        nom=file.filename,
        description=description,
        categorie=categorie,
        format_fichier=format_fichier,
        taille=taille_mo,
        version_actuelle=1,
        cree_par=cree_par,
        chemin_fichier=""
    )
    db.add(new_doc)
    db.commit()
    db.refresh(new_doc)

    # Sauvegarder le fichier physiquement
    file_name = f"{new_doc.id}_{file.filename}"
    file_path = os.path.join(UPLOAD_DIR, file_name)

    with open(file_path, "wb") as f:
        f.write(contents)

    # Mettre à jour le chemin
    new_doc.chemin_fichier = file_path
    db.commit()

    # Créer la version v1
    version = DocumentVersion(
        document_id=new_doc.id,
        version_numero=1,
        chemin_fichier=file_path,
        commentaire=commentaire,
        modifie_par=cree_par
    )
    db.add(version)
    db.commit()

    return {"message": "Fichier importé avec succès", "doc_id": new_doc.id}


@router.get("/download/{doc_id}")
def download_document(
    doc_id: int,
    version: int = Query(None, description="Numéro de version spécifique"),
    db: Session = Depends(get_db)
):
    """Télécharge un document (dernière version ou version spécifique)"""
    
    doc = db.query(Document).filter(Document.id == doc_id).first()
    if not doc:
        raise HTTPException(status_code=404, detail="Document introuvable")

    if version:
        ver = db.query(DocumentVersion).filter(
            DocumentVersion.document_id == doc_id,
            DocumentVersion.version_numero == version
        ).first()
        if not ver:
            raise HTTPException(status_code=404, detail="Version introuvable")
        file_path = ver.chemin_fichier
    else:
        file_path = doc.chemin_fichier

    if not os.path.exists(file_path):
        raise HTTPException(status_code=404, detail="Fichier physique introuvable")

    return FileResponse(file_path, filename=doc.nom)


@router.get("/{doc_id}/history")
def document_history(doc_id: int, db: Session = Depends(get_db)):
    """Historique des versions d'un document"""
    
    doc = db.query(Document).filter(Document.id == doc_id).first()
    if not doc:
        raise HTTPException(status_code=404, detail="Document introuvable")

    versions = (
        db.query(DocumentVersion)
        .filter(DocumentVersion.document_id == doc_id)
        .order_by(DocumentVersion.version_numero.desc())
        .all()
    )
    return versions


@router.delete("/{doc_id}")
def delete_document(doc_id: int, db: Session = Depends(get_db)):
    """Supprime un document et toutes ses versions"""
    
    doc = db.query(Document).filter(Document.id == doc_id).first()
    if not doc:
        raise HTTPException(status_code=404, detail="Document introuvable")

    # Supprimer les fichiers physiques
    if doc.chemin_fichier and os.path.exists(doc.chemin_fichier):
        os.remove(doc.chemin_fichier)
    
    for version in doc.versions:
        if version.chemin_fichier and os.path.exists(version.chemin_fichier):
            if version.chemin_fichier != doc.chemin_fichier:  # éviter de supprimer 2x
                os.remove(version.chemin_fichier)

    db.delete(doc)
    db.commit()
    
    return {"message": "Document et versions supprimés avec succès"}