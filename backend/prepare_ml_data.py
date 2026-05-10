# models.py (extrait à ajouter)
from sqlalchemy import Column, Integer, String, Float, DateTime, ForeignKey, Text
from sqlalchemy.orm import relationship
from datetime import datetime

class Document(Base):
    __tablename__ = "documents"

    id = Column(Integer, primary_key=True, index=True)
    nom = Column(String(255), nullable=False)
    description = Column(String(500), default="")
    categorie = Column(String(50), default="autre")   # plan, contrat, devis, autre
    format_fichier = Column(String(10))               # ex: ".pdf", ".dwg"
    taille = Column(Float, default=0)                 # en Mo
    version_actuelle = Column(Integer, default=1)
    cree_par = Column(String(100))
    date_creation = Column(DateTime, default=datetime.utcnow)
    chemin_fichier = Column(String(500))              # chemin relatif (stockage local)

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