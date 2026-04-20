import hashlib
import os
import re
import secrets
from datetime import date, datetime, timedelta, timezone
from functools import wraps
from pathlib import Path

from dotenv import load_dotenv
from flask import Flask, jsonify, request, session
from flask_sqlalchemy import SQLAlchemy
from sqlalchemy import func
from sqlalchemy.exc import IntegrityError
from werkzeug.security import check_password_hash, generate_password_hash

BASE_DIR = Path(__file__).resolve().parent
load_dotenv(BASE_DIR / ".env")


def utc_now() -> datetime:
    return datetime.now(timezone.utc)


def normalize_database_uri(raw_uri: str | None) -> str | None:
    if not raw_uri:
        return None
    if raw_uri.startswith("postgres://"):
        return raw_uri.replace("postgres://", "postgresql+psycopg://", 1)
    if raw_uri.startswith("postgresql://") and "+psycopg" not in raw_uri and "+psycopg2" not in raw_uri:
        return raw_uri.replace("postgresql://", "postgresql+psycopg://", 1)
    return raw_uri


app = Flask(__name__)

app.config["SECRET_KEY"] = os.getenv("SECRET_KEY", "change-me-in-production")
app.config["SQLALCHEMY_DATABASE_URI"] = normalize_database_uri(os.getenv("SUPABASE_DB_URL")) or "sqlite:///admin_portal.db"
app.config["SQLALCHEMY_TRACK_MODIFICATIONS"] = False
app.config["SESSION_COOKIE_HTTPONLY"] = True
app.config["SESSION_COOKIE_SAMESITE"] = "Lax"

db = SQLAlchemy(app)
EMAIL_REGEX = re.compile(r"^[^\s@]+@[^\s@]+\.[^\s@]+$")


class Admin(db.Model):
    __tablename__ = "admins"

    id = db.Column(db.Integer, primary_key=True)
    name = db.Column(db.String(120), nullable=False)
    email = db.Column(db.String(255), unique=True, nullable=False, index=True)
    password_hash = db.Column(db.String(255), nullable=False)
    created_at = db.Column(db.DateTime(timezone=True), nullable=False, default=utc_now)
    updated_at = db.Column(db.DateTime(timezone=True), nullable=False, default=utc_now, onupdate=utc_now)

    opportunities = db.relationship("Opportunity", backref="admin", lazy=True, cascade="all, delete-orphan")

    def to_dict(self) -> dict:
        return {
            "id": self.id,
            "name": self.name,
            "email": self.email,
            "createdAt": self.created_at.isoformat() if self.created_at else None,
        }


class Opportunity(db.Model):
    __tablename__ = "opportunities"

    id = db.Column(db.Integer, primary_key=True)
    admin_id = db.Column(db.Integer, db.ForeignKey("admins.id", ondelete="CASCADE"), nullable=False, index=True)

    name = db.Column(db.String(255), nullable=False)
    duration = db.Column(db.String(100), nullable=False)
    start_date = db.Column(db.Date, nullable=False)
    description = db.Column(db.Text, nullable=False)
    skills = db.Column(db.JSON, nullable=False, default=list)
    category = db.Column(db.String(80), nullable=False)
    future_opportunities = db.Column(db.Text, nullable=False)
    max_applicants = db.Column(db.Integer, nullable=True)
    prerequisites = db.Column(db.Text, nullable=True)

    created_at = db.Column(db.DateTime(timezone=True), nullable=False, default=utc_now)
    updated_at = db.Column(db.DateTime(timezone=True), nullable=False, default=utc_now, onupdate=utc_now)

    def to_dict(self) -> dict:
        return {
            "id": self.id,
            "name": self.name,
            "duration": self.duration,
            "startDate": self.start_date.isoformat() if self.start_date else None,
            "description": self.description,
            "skills": self.skills or [],
            "category": self.category,
            "futureOpportunities": self.future_opportunities,
            "maxApplicants": self.max_applicants,
            "prerequisites": self.prerequisites or "",
            "createdAt": self.created_at.isoformat() if self.created_at else None,
            "updatedAt": self.updated_at.isoformat() if self.updated_at else None,
        }


class PasswordResetToken(db.Model):
    __tablename__ = "password_reset_tokens"

    id = db.Column(db.Integer, primary_key=True)
    admin_id = db.Column(db.Integer, db.ForeignKey("admins.id", ondelete="CASCADE"), nullable=False, index=True)
    token_hash = db.Column(db.String(64), nullable=False, index=True)
    expires_at = db.Column(db.DateTime(timezone=True), nullable=False)
    used = db.Column(db.Boolean, nullable=False, default=False)
    created_at = db.Column(db.DateTime(timezone=True), nullable=False, default=utc_now)


def json_error(message: str, status_code: int = 400, errors: dict | None = None):
    payload = {"message": message}
    if errors:
        payload["errors"] = errors
    return jsonify(payload), status_code


def parse_json_body() -> dict:
    data = request.get_json(silent=True)
    if isinstance(data, dict):
        return data
    return {}


def is_valid_email(value: str) -> bool:
    return bool(EMAIL_REGEX.match(value))


def parse_skills(raw_skills) -> list[str]:
    if isinstance(raw_skills, str):
        return [item.strip() for item in raw_skills.split(",") if item.strip()]
    if isinstance(raw_skills, list):
        clean = []
        for item in raw_skills:
            if not isinstance(item, str):
                continue
            value = item.strip()
            if value:
                clean.append(value)
        return clean
    return []


def parse_start_date(value: str) -> date | None:
    try:
        return datetime.strptime(value, "%Y-%m-%d").date()
    except (ValueError, TypeError):
        return None


def parse_max_applicants(value):
    if value in ("", None):
        return None
    try:
        parsed = int(value)
    except (TypeError, ValueError):
        return "invalid"
    return parsed if parsed >= 0 else "invalid"


def validate_opportunity_payload(payload: dict, partial: bool = False) -> tuple[dict, dict]:
    errors = {}
    cleaned = {}
    allowed_fields = {
        "name",
        "duration",
        "startDate",
        "description",
        "skills",
        "category",
        "futureOpportunities",
        "maxApplicants",
        "prerequisites",
    }
    required_fields = {
        "name",
        "duration",
        "startDate",
        "description",
        "skills",
        "category",
        "futureOpportunities",
    }

    unknown_fields = set(payload.keys()) - allowed_fields
    if unknown_fields:
        errors["payload"] = f"Unknown field(s): {', '.join(sorted(unknown_fields))}"

    if not partial:
        for field in required_fields:
            value = payload.get(field)
            if value is None or (isinstance(value, str) and not value.strip()) or (field == "skills" and not parse_skills(value)):
                errors[field] = "This field is required."

    if partial and not any(field in payload for field in allowed_fields):
        errors["payload"] = "At least one updatable field is required."

    if "name" in payload:
        name = str(payload.get("name", "")).strip()
        if not name:
            errors["name"] = "Name is required."
        elif len(name) > 255:
            errors["name"] = "Name must be 255 characters or fewer."
        else:
            cleaned["name"] = name

    if "duration" in payload:
        duration = str(payload.get("duration", "")).strip()
        if not duration:
            errors["duration"] = "Duration is required."
        elif len(duration) > 100:
            errors["duration"] = "Duration must be 100 characters or fewer."
        else:
            cleaned["duration"] = duration

    if "startDate" in payload:
        parsed_date = parse_start_date(payload.get("startDate"))
        if not parsed_date:
            errors["startDate"] = "Start date must be in YYYY-MM-DD format."
        else:
            cleaned["start_date"] = parsed_date

    if "description" in payload:
        description = str(payload.get("description", "")).strip()
        if not description:
            errors["description"] = "Description is required."
        else:
            cleaned["description"] = description

    if "skills" in payload:
        skills = parse_skills(payload.get("skills"))
        if not skills:
            errors["skills"] = "At least one skill is required."
        else:
            cleaned["skills"] = skills

    if "category" in payload:
        category = str(payload.get("category", "")).strip()
        if not category:
            errors["category"] = "Category is required."
        else:
            cleaned["category"] = category

    if "futureOpportunities" in payload:
        future = str(payload.get("futureOpportunities", "")).strip()
        if not future:
            errors["futureOpportunities"] = "Future opportunities are required."
        else:
            cleaned["future_opportunities"] = future

    if "maxApplicants" in payload:
        parsed_max = parse_max_applicants(payload.get("maxApplicants"))
        if parsed_max == "invalid":
            errors["maxApplicants"] = "Max applicants must be a non-negative number."
        else:
            cleaned["max_applicants"] = parsed_max

    if "prerequisites" in payload:
        prerequisites = payload.get("prerequisites")
        cleaned["prerequisites"] = str(prerequisites).strip() if prerequisites is not None else ""

    return cleaned, errors


def require_auth(fn):
    @wraps(fn)
    def wrapped(*args, **kwargs):
        if not session.get("admin_id"):
            return json_error("Authentication required.", 401)
        return fn(*args, **kwargs)

    return wrapped


def get_current_admin() -> Admin | None:
    admin_id = session.get("admin_id")
    if not admin_id:
        return None
    return db.session.get(Admin, admin_id)


def get_owned_opportunity(opportunity_id: int, admin_id: int) -> Opportunity | None:
    return Opportunity.query.filter_by(id=opportunity_id, admin_id=admin_id).first()


@app.get("/")
def index():
    return jsonify({"service": "admin-portal-backend", "status": "ok"})


@app.get("/health")
def health():
    return jsonify({"status": "healthy"})


@app.post("/signup")
def signup():
    payload = parse_json_body()

    name = str(payload.get("name", "")).strip()
    email = str(payload.get("email", "")).strip().lower()
    password = str(payload.get("password", ""))
    confirm_password = str(payload.get("confirmPassword", ""))

    errors = {}
    if not name:
        errors["name"] = "Full name is required."
    if not email or not is_valid_email(email):
        errors["email"] = "A valid email address is required."
    if len(password) < 8:
        errors["password"] = "Password must be at least 8 characters."
    if password != confirm_password:
        errors["confirmPassword"] = "Passwords do not match."

    if not errors:
        existing_admin = Admin.query.filter(func.lower(Admin.email) == email).first()
        if existing_admin:
            errors["email"] = "Email is already registered."

    if errors:
        return json_error("Validation failed.", 400, errors)

    new_admin = Admin(name=name, email=email, password_hash=generate_password_hash(password))
    db.session.add(new_admin)

    try:
        db.session.commit()
    except IntegrityError:
        db.session.rollback()
        return json_error("Validation failed.", 400, {"email": "Email is already registered."})

    return (
        jsonify(
            {
                "message": "Account created successfully.",
                "admin": new_admin.to_dict(),
            }
        ),
        201,
    )


@app.post("/login")
def login():
    payload = parse_json_body()
    email = str(payload.get("email", "")).strip().lower()
    password = str(payload.get("password", ""))
    remember_me = bool(payload.get("rememberMe"))

    admin = Admin.query.filter(func.lower(Admin.email) == email).first() if email else None
    if not admin or not check_password_hash(admin.password_hash, password):
        return json_error("Invalid email or password.", 401)

    session.clear()
    session["admin_id"] = admin.id
    session["admin_name"] = admin.name
    session["admin_email"] = admin.email
    session.permanent = remember_me

    return jsonify({"message": "Login successful.", "admin": admin.to_dict()})


@app.post("/forgot-password")
def forgot_password():
    payload = parse_json_body()
    email = str(payload.get("email", "")).strip().lower()
    generic_message = "If the email exists, a reset link has been generated."

    if email and is_valid_email(email):
        admin = Admin.query.filter(func.lower(Admin.email) == email).first()
        if admin:
            raw_token = secrets.token_urlsafe(32)
            token_hash = hashlib.sha256(raw_token.encode("utf-8")).hexdigest()
            expires_at = utc_now() + timedelta(hours=1)
            token = PasswordResetToken(admin_id=admin.id, token_hash=token_hash, expires_at=expires_at)
            db.session.add(token)
            db.session.commit()

            app.logger.info(
                "Password reset token generated | admin_id=%s | email=%s | token=%s | expires_at=%s",
                admin.id,
                admin.email,
                raw_token,
                expires_at.isoformat(),
            )

    return jsonify({"message": generic_message})


@app.get("/session")
def session_status():
    admin = get_current_admin()
    if not admin:
        session.clear()
        return jsonify({"authenticated": False})

    return jsonify({"authenticated": True, "admin": admin.to_dict()})


@app.post("/logout")
def logout():
    session.clear()
    return jsonify({"message": "Logged out successfully."})


@app.get("/opportunities")
@require_auth
def list_opportunities():
    admin_id = session["admin_id"]
    opportunities = (
        Opportunity.query.filter_by(admin_id=admin_id).order_by(Opportunity.created_at.desc(), Opportunity.id.desc()).all()
    )
    return jsonify({"opportunities": [item.to_dict() for item in opportunities]})


@app.post("/opportunities")
@require_auth
def create_opportunity():
    payload = parse_json_body()
    cleaned, errors = validate_opportunity_payload(payload, partial=False)
    if errors:
        return json_error("Validation failed.", 400, errors)

    opportunity = Opportunity(admin_id=session["admin_id"], **cleaned)
    db.session.add(opportunity)
    db.session.commit()

    return jsonify({"message": "Opportunity created successfully.", "opportunity": opportunity.to_dict()}), 201


@app.get("/opportunities/<int:opportunity_id>")
@require_auth
def get_opportunity(opportunity_id: int):
    opportunity = get_owned_opportunity(opportunity_id, session["admin_id"])
    if not opportunity:
        return json_error("Opportunity not found.", 404)
    return jsonify({"opportunity": opportunity.to_dict()})


@app.put("/opportunities/<int:opportunity_id>")
@require_auth
def update_opportunity(opportunity_id: int):
    opportunity = get_owned_opportunity(opportunity_id, session["admin_id"])
    if not opportunity:
        return json_error("Opportunity not found.", 404)

    payload = parse_json_body()
    cleaned, errors = validate_opportunity_payload(payload, partial=True)
    if errors:
        return json_error("Validation failed.", 400, errors)

    for key, value in cleaned.items():
        setattr(opportunity, key, value)

    db.session.commit()
    return jsonify({"message": "Opportunity updated successfully.", "opportunity": opportunity.to_dict()})


@app.delete("/opportunities/<int:opportunity_id>")
@require_auth
def delete_opportunity(opportunity_id: int):
    opportunity = get_owned_opportunity(opportunity_id, session["admin_id"])
    if not opportunity:
        return json_error("Opportunity not found.", 404)

    db.session.delete(opportunity)
    db.session.commit()
    return jsonify({"message": "Opportunity deleted successfully."})


with app.app_context():
    db.create_all()


if __name__ == "__main__":
    app.run(debug=True)
