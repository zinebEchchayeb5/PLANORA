from sqlalchemy import Column, Integer, String, Text, BigInteger, ForeignKey, DateTime, Boolean
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func
from database import Base

class User(Base):
    __tablename__ = "users"
    id = Column(Integer, primary_key=True, index=True)
    nom = Column(String(100), nullable=False)
    email = Column(String(150), unique=True, nullable=False)
    password_hash = Column(String(255), nullable=False)
    role = Column(String(20), default="architecte")
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    projets = relationship("Projet", back_populates="user")
    taches = relationship("Tache", back_populates="user")

class Client(Base):
    __tablename__ = "clients"
    id = Column(Integer, primary_key=True, index=True)
    nom = Column(String(100), nullable=False)
    email = Column(String(150))
    telephone = Column(String(20))
    adresse = Column(Text)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    projets = relationship("Projet", back_populates="client")

class Projet(Base):
    __tablename__ = "projets"
    id = Column(Integer, primary_key=True, index=True)
    titre = Column(String(200), nullable=False)
    description = Column(Text)
    client_id = Column(Integer, ForeignKey("clients.id"))
    user_id = Column(Integer, ForeignKey("users.id"))
    statut = Column(String(30), default="en_cours")
    surface = Column(Integer)
    type_bien = Column(String(50))
    budget_estime = Column(BigInteger)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    client = relationship("Client", back_populates="projets")
    user = relationship("User", back_populates="projets")
    factures = relationship("Facture", back_populates="projet")
    taches = relationship("Tache", back_populates="projet")

class Facture(Base):
    __tablename__ = "factures"
    id = Column(Integer, primary_key=True, index=True)
    projet_id = Column(Integer, ForeignKey("projets.id"))
    montant = Column(BigInteger, nullable=False)
    statut = Column(String(20), default="impayee")
    date_emission = Column(DateTime(timezone=True), server_default=func.now())
    date_echeance = Column(DateTime(timezone=True))
    projet = relationship("Projet", back_populates="factures")

class Tache(Base):
    __tablename__ = "taches"
    id = Column(Integer, primary_key=True, index=True)
    projet_id = Column(Integer, ForeignKey("projets.id"))
    user_id = Column(Integer, ForeignKey("users.id"))
    titre = Column(String(200), nullable=False)
    statut = Column(String(20), default="todo")
    deadline = Column(DateTime(timezone=True))
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    projet = relationship("Projet", back_populates="taches")
    user = relationship("User", back_populates="taches")