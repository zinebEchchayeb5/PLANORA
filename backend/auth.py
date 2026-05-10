from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from passlib.context import CryptContext
from jose import JWTError, jwt
from datetime import datetime, timedelta
from pydantic import BaseModel
from typing import Optional
import smtplib
from email.mime.text import MIMEText
from email.mime.multipart import MIMEMultipart

from database import get_db
from models import User

SECRET_KEY = "planora_secret_key_2024"
ALGORITHM = "HS256"
ACCESS_TOKEN_EXPIRE_HOURS = 24

# --- CONFIGURATION SMTP GMAIL ---
SMTP_HOST = "smtp.gmail.com"
SMTP_PORT = 587
SMTP_USER = "zineb.echchayeb.2005@gmail.com"  # Ton adresse Gmail d'envoi
SMTP_PASSWORD = "tcslqkeoysnarith"            # Ton mot de passe d'application de 16 caractères

# URL de ton application Frontend (React / Vite)
FRONTEND_URL = "http://localhost:5173"  

pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")
router = APIRouter(prefix="/auth", tags=["auth"])

# --- SCHÉMAS PYDANTIC ---

class RegisterRequest(BaseModel):
    nom: str
    email: str
    password: str
    role: str = "architecte"

class LoginRequest(BaseModel):
    email: str
    password: str

class ForgotPasswordRequest(BaseModel):
    email: str

class ResetPasswordRequest(BaseModel):
    token: str
    new_password: str

# --- FONCTIONS UTILITAIRES ---

def hash_password(password: str) -> str:
    return pwd_context.hash(password)

def verify_password(plain: str, hashed: str) -> bool:
    return pwd_context.verify(plain, hashed)

def create_token(data: dict, expires_delta: Optional[timedelta] = None) -> str:
    to_encode = data.copy()
    if expires_delta:
        expire = datetime.utcnow() + expires_delta
    else:
        expire = datetime.utcnow() + timedelta(hours=ACCESS_TOKEN_EXPIRE_HOURS)
    to_encode.update({"exp": expire})
    return jwt.encode(to_encode, SECRET_KEY, algorithm=ALGORITHM)

def send_reset_email(to_email: str, token: str):
    """Envoie un e-mail au format HTML hautement professionnel et structuré."""
    reset_link = f"{FRONTEND_URL}/reset-password?token={token}"
    
    msg = MIMEMultipart('alternative')
    msg['From'] = f"Planora Support <{SMTP_USER}>"
    msg['To'] = to_email
    msg['Subject'] = "Réinitialisation de votre mot de passe - Planora"
    
    # Version texte brut (alternative de secours)
    text_body = f"""
    Bonjour,

    Vous avez demandé la réinitialisation de votre mot de passe pour votre compte Planora.
    Veuillez copier-coller le lien suivant dans votre navigateur pour définir un nouveau mot de passe :
    {reset_link}

    Ce lien est valable pendant 15 minutes.
    Si vous n'êtes pas à l'origine de cette demande, vous pouvez ignorer cet e-mail en toute sécurité.

    L'équipe Planora.
    """
    
    # Version HTML soignée, structurée et moderne
    html_body = f"""
    <!DOCTYPE html>
    <html>
    <head>
        <meta charset="utf-8">
        <style>
            body {{
                font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
                background-color: #f8f9fa;
                color: #334155;
                margin: 0;
                padding: 0;
                -webkit-font-smoothing: antialiased;
            }}
            .container {{
                max-width: 550px;
                margin: 40px auto;
                background: #ffffff;
                border-radius: 12px;
                border: 1px solid #e2e8f0;
                box-shadow: 0 4px 12px rgba(0, 0, 0, 0.05);
                overflow: hidden;
            }}
            .header {{
                background-color: #1e293b;
                padding: 30px;
                text-align: center;
            }}
            .header h1 {{
                color: #ffffff;
                margin: 0;
                font-size: 26px;
                letter-spacing: 2px;
                font-weight: 700;
            }}
            .content {{
                padding: 40px 30px;
                line-height: 1.6;
            }}
            .content h2 {{
                font-size: 18px;
                color: #1e293b;
                margin-top: 0;
                margin-bottom: 16px;
            }}
            .content p {{
                font-size: 14px;
                color: #64748b;
                margin-bottom: 24px;
            }}
            .btn-container {{
                text-align: center;
                margin: 30px 0;
            }}
            .btn {{
                background-color: #1e293b;
                color: #ffffff !important;
                text-decoration: none;
                padding: 12px 28px;
                font-size: 14px;
                font-weight: 600;
                border-radius: 8px;
                display: inline-block;
                transition: background-color 0.2s;
            }}
            .footer {{
                background-color: #f8f9fa;
                padding: 20px 30px;
                text-align: center;
                border-top: 1px solid #e2e8f0;
                font-size: 12px;
                color: #94a3b8;
            }}
            .footer a {{
                color: #64748b;
                text-decoration: underline;
            }}
        </style>
    </head>
    <body>
        <div class="container">
            <div class="header">
                <h1>PLANORA</h1>
            </div>
            <div class="content">
                <h2>Bonjour,</h2>
                <p>Vous avez demandé la réinitialisation de votre mot de passe pour votre espace <strong>Planora</strong> (Bureau d'étude architectural).</p>
                <p>Pour définir un nouveau mot de passe, veuillez cliquer sur le bouton sécurisé ci-dessous. Ce lien est temporaire et expirera dans <strong>15 minutes</strong>.</p>
                
                <div class="btn-container">
                    <a href="{reset_link}" class="btn">Réinitialiser mon mot de passe</a>
                </div>
                
                <p style="font-size: 12px; color: #94a3b8;">Si le bouton ci-dessus ne fonctionne pas, vous pouvez également copier et coller ce lien dans votre navigateur :<br>
                <a href="{reset_link}" style="color: #1e293b; word-break: break-all;">{reset_link}</a></p>
            </div>
            <div class="footer">
                Si vous n'avez pas demandé ce changement, vous pouvez ignorer cet e-mail en toute sécurité. Votre mot de passe actuel restera inchangé.<br><br>
                &copy; {datetime.utcnow().year} Planora. Tous droits réservés.
            </div>
        </div>
    </body>
    </html>
    """
    
    msg.attach(MIMEText(text_body, 'plain', 'utf-8'))
    msg.attach(MIMEText(html_body, 'html', 'utf-8'))
    
    try:
        server = smtplib.SMTP(SMTP_HOST, SMTP_PORT)
        server.starttls()
        server.login(SMTP_USER, SMTP_PASSWORD)
        server.send_message(msg)
        server.quit()
    except Exception as e:
        print(f"Erreur d'envoi d'email : {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, 
            detail="Impossible d'envoyer l'e-mail de réinitialisation. Veuillez réessayer."
        )

# --- ROUTES API ---

@router.post("/register")
def register(req: RegisterRequest, db: Session = Depends(get_db)):
    existing = db.query(User).filter(User.email == req.email).first()
    if existing:
        raise HTTPException(status_code=400, detail="Email déjà utilisé")
    user = User(
        nom=req.nom,
        email=req.email,
        password_hash=hash_password(req.password),
        role=req.role
    )
    db.add(user)
    db.commit()
    db.refresh(user)
    token = create_token({"id": user.id, "role": user.role, "nom": user.nom})
    return {"token": token, "user": {"id": user.id, "nom": user.nom, "role": user.role}}

@router.post("/login")
def login(req: LoginRequest, db: Session = Depends(get_db)):
    user = db.query(User).filter(User.email == req.email).first()
    if not user or not verify_password(req.password, user.password_hash):
        raise HTTPException(status_code=401, detail="Email ou mot de passe incorrect")
    token = create_token({"id": user.id, "role": user.role, "nom": user.nom})
    return {"token": token, "user": {"id": user.id, "nom": user.nom, "email": user.email, "role": user.role}}

@router.post("/forgot-password")
def forgot_password(req: ForgotPasswordRequest, db: Session = Depends(get_db)):
    user = db.query(User).filter(User.email == req.email).first()
    if not user:
        raise HTTPException(status_code=404, detail="Aucun compte associé à cet email")
    
    reset_token = create_token(
        data={"id": user.id, "purpose": "password_reset"}, 
        expires_delta=timedelta(minutes=15)
    )
    
    send_reset_email(user.email, reset_token)
    return {"message": "Un e-mail de réinitialisation vous a été envoyé."}

@router.post("/reset-password")
def reset_password(req: ResetPasswordRequest, db: Session = Depends(get_db)):
    try:
        payload = jwt.decode(req.token, SECRET_KEY, algorithms=[ALGORITHM])
        
        if payload.get("purpose") != "password_reset":
            raise HTTPException(status_code=400, detail="Token invalide pour cet usage")
            
        user_id = payload.get("id")
        user = db.query(User).filter(User.id == user_id).first()
        
        if not user:
            raise HTTPException(status_code=404, detail="Utilisateur non trouvé")
            
        user.password_hash = hash_password(req.new_password)
        db.commit()
        
        return {"message": "Mot de passe réinitialisé avec succès"}
        
    except JWTError:
        raise HTTPException(status_code=400, detail="Le lien de réinitialisation a expiré ou est invalide")