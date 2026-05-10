from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import StreamingResponse
from fastapi.staticfiles import StaticFiles
from pydantic import BaseModel
from typing import Optional, List
import os
from agent import generate_plan, estimate_cost
from chatbot_groq import chat_groq_stream
from database import engine
from models import Base
import auth
from routers import (projets, clients, factures, taches, ia, export, ocr,
                     stock, comptabilite, notifications, versioning, plan_editor, fichiers)

Base.metadata.create_all(bind=engine)

# Uploads directory
os.makedirs("uploads", exist_ok=True)

app = FastAPI(title="PLANORA API v6")
app.add_middleware(CORSMiddleware, allow_origins=["*"], allow_methods=["*"], allow_headers=["*"])

# Serve uploaded files statically
app.mount("/uploads", StaticFiles(directory="uploads"), name="uploads")

app.include_router(auth.router)
app.include_router(projets.router)
app.include_router(clients.router)
app.include_router(factures.router)
app.include_router(taches.router)
app.include_router(ia.router)
app.include_router(export.router)
app.include_router(ocr.router)
app.include_router(stock.router)
app.include_router(comptabilite.router)
app.include_router(notifications.router)
app.include_router(versioning.router)
app.include_router(plan_editor.router)
app.include_router(fichiers.router)

class PlanRequest(BaseModel):
    surface: int = 120
    chambres: int = 3
    sdb: int = 2
    style: str = "moderne"
    type_bien: str = "maison"
    contexte: str = "sur_rue"

class Message(BaseModel):
    role: str
    content: str

class ChatRequest(BaseModel):
    question: str
    history: Optional[List[Message]] = []
    plan_context: Optional[dict] = None

@app.get("/")
def root():
    return {"message": "PLANORA API v6 — Full ERP running!"}

@app.post("/generate")
def generate(req: PlanRequest):
    return generate_plan(req.surface, req.chambres, req.sdb, req.style, req.type_bien, req.contexte)

@app.post("/chat/stream")
def chat_stream(req: ChatRequest):
    history = [{"role": m.role, "content": m.content} for m in (req.history or [])]
    def stream():
        try:
            for token in chat_groq_stream(req.question, history, req.plan_context):
                yield token
        except Exception as e:
            yield f"Erreur: {e}"
    return StreamingResponse(stream(), media_type="text/plain")

@app.post("/estimate")
def estimate(plan: dict):
    return estimate_cost(plan)