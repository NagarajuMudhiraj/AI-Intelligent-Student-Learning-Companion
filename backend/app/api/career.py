from fastapi import APIRouter, Depends, HTTPException
from app.api.deps import get_current_user
from app.models.user import UserOut
from app.db.database import get_database
from app.services.rag_service import search_documents
from app.core.config import settings
from langchain_google_genai import ChatGoogleGenerativeAI
from pydantic import BaseModel, Field
from typing import List, Optional, Dict
from bson import ObjectId
from datetime import datetime, timezone
import json
import re

router = APIRouter()

llm = ChatGoogleGenerativeAI(
    model="gemini-2.5-flash",
    google_api_key=settings.GEMINI_API_KEY,
    temperature=0.5
)

# ── Document-Analysis Prompt (existing) ─────────────────────────────────────────

CAREER_PROMPT = """You are a career counselor for students. Based on the academic subjects and topics the student has been studying, suggest suitable career paths.

Student's study topics:
{topics}

Return ONLY a valid JSON object with this structure:
{{
  "career_paths": [
    {{
      "title": "Career Title",
      "description": "Brief description",
      "match_score": 85,
      "key_skills": ["skill1", "skill2", "skill3"],
      "next_steps": ["step1", "step2"]
    }}
  ],
  "summary": "Brief personalized summary for the student"
}}

Suggest 4-6 relevant career paths. Do not include any text before or after the JSON."""


# ── Manual Roadmap Prompt ────────────────────────────────────────────────────────

MANUAL_ROADMAP_PROMPT = """You are an expert AI career counselor and roadmap architect. Generate a detailed, actionable, personalized career roadmap for the following student profile.

STUDENT PROFILE:
- Career Goal: {career_field}
- Current Skill Level: {skill_level}
- Degree: {degree}
- Branch/Specialization: {branch}
- Current Year of Study: {current_year}
- Expected Graduation: {graduation_year}
- Career Preferences: {preferences}

Generate a comprehensive roadmap. Return ONLY a valid JSON object with EXACTLY this structure (no extra text before or after):
{{
  "career_fit_score": 87,
  "recommended_career": "Full Career Title",
  "why_match": "2-3 sentences explaining why this career matches the student's profile, background and preferences.",
  "skills_required": ["Python", "Machine Learning", "TensorFlow", "SQL", "Cloud Computing"],
  "missing_skills": ["MLOps", "Kubernetes", "Spark"],
  "roadmap": {{
    "phase1": {{
      "title": "Foundation Building",
      "duration": "0–3 Months",
      "goal": "Build core fundamentals and start first project",
      "tasks": ["Learn Python basics", "Complete ML course on Coursera", "Build a simple classifier project"]
    }},
    "phase2": {{
      "title": "Skill Development",
      "duration": "3–6 Months",
      "goal": "Deepen practical skills and build portfolio",
      "tasks": ["Master TensorFlow/PyTorch", "Participate in Kaggle competitions", "Deploy a model with Flask/FastAPI"]
    }},
    "phase3": {{
      "title": "Specialization",
      "duration": "6–12 Months",
      "goal": "Specialize, contribute to open source, target internships",
      "tasks": ["Pick a specialization (NLP, CV, RL)", "Contribute to open source", "Apply for internships"]
    }},
    "phase4": {{
      "title": "Career Launch",
      "duration": "1–2 Years",
      "goal": "Land first job or internship and grow professionally",
      "tasks": ["Apply to full-time positions", "Network on LinkedIn", "Aim for FAANG or AI startups"]
    }}
  }},
  "technologies": ["Python", "TensorFlow", "PyTorch", "Scikit-learn", "Docker", "AWS/GCP"],
  "certifications": [
    {{"name": "Google ML Engineer", "provider": "Google Cloud", "priority": "High"}},
    {{"name": "AWS Certified ML Specialty", "provider": "Amazon", "priority": "Medium"}}
  ],
  "projects": [
    {{"title": "Sentiment Analyzer", "description": "Build an NLP model to classify tweets", "difficulty": "Beginner"}},
    {{"title": "Image Classification API", "description": "CNN model deployed as REST API", "difficulty": "Intermediate"}}
  ],
  "internship_strategy": "Detailed 3-4 sentence strategy for landing internships at top companies given this student's profile, timeline and preferences.",
  "resume_tips": [
    "Lead with your GitHub portfolio link",
    "Quantify every project outcome with metrics",
    "Include Kaggle ranking if top 10%"
  ],
  "interview_plan": [
    "Week 1-2: Revise ML fundamentals (bias-variance, overfitting)",
    "Week 3-4: LeetCode Easy/Medium Data Structures",
    "Week 5-6: System design basics and ML system design"
  ],
  "salary_range": {{
    "entry": "$70,000 – $95,000",
    "mid": "$100,000 – $140,000",
    "senior": "$150,000 – $200,000+",
    "currency_note": "USD, US market. Adjust for India: ₹8–25 LPA entry, ₹25–60 LPA senior"
  }},
  "growth_opportunities": [
    "ML Research Scientist at top labs",
    "AI Product Manager",
    "CTO of AI Startup",
    "MLOps / AI Platform Engineer"
  ]
}}"""


# ── Pydantic Models ─────────────────────────────────────────────────────────────

class CareerPath(BaseModel):
    title: str
    description: str
    match_score: int
    key_skills: List[str]
    next_steps: List[str]


class CareerAnalysis(BaseModel):
    career_paths: List[CareerPath]
    summary: str


class ManualRoadmapRequest(BaseModel):
    career_field: str
    skill_level: str
    degree: str = ""
    branch: str = ""
    current_year: str = ""
    graduation_year: str = ""
    preferences: List[str] = []


class RoadmapPhase(BaseModel):
    title: str
    duration: str
    goal: str
    tasks: List[str]


class Certification(BaseModel):
    name: str
    provider: str
    priority: str


class Project(BaseModel):
    title: str
    description: str
    difficulty: str


class SalaryRange(BaseModel):
    entry: str
    mid: str
    senior: str
    currency_note: str


class FullRoadmap(BaseModel):
    career_fit_score: int
    recommended_career: str
    why_match: str
    skills_required: List[str]
    missing_skills: List[str]
    roadmap: Dict[str, RoadmapPhase]
    technologies: List[str]
    certifications: List[Certification]
    projects: List[Project]
    internship_strategy: str
    resume_tips: List[str]
    interview_plan: List[str]
    salary_range: SalaryRange
    growth_opportunities: List[str]
    # echo back the request for storage
    career_field: Optional[str] = None
    skill_level: Optional[str] = None
    preferences: Optional[List[str]] = None


# ── Routes ──────────────────────────────────────────────────────────────────────

@router.post("/analyze", response_model=CareerAnalysis)
async def analyze_career(current_user: UserOut = Depends(get_current_user)):
    """Existing: analyze from uploaded documents."""
    db = get_database()

    docs_cursor = db["documents"].find({"user_id": current_user.id})
    docs = await docs_cursor.to_list(length=20)

    if not docs:
        raise HTTPException(
            status_code=400,
            detail="Upload study documents first so I can analyze your academic interests."
        )

    doc_names = [d.get("original_name", d.get("filename", "")) for d in docs]
    topics_str = "\n".join(doc_names)

    results = search_documents(
        query="main subject topics concepts studied",
        user_id=current_user.id,
        top_k=3
    )
    if results:
        content_sample = "\n".join([r.page_content[:300] for r in results[:4]])
        topics_str += f"\n\nContent samples:\n{content_sample}"

    prompt = CAREER_PROMPT.format(topics=topics_str[:2000])
    response = llm.invoke(prompt)
    raw = response.content.strip()

    match = re.search(r'\{.*\}', raw, re.DOTALL)
    if not match:
        raise HTTPException(status_code=500, detail="Failed to parse career analysis")

    try:
        data = json.loads(match.group())
        analysis = CareerAnalysis(**data)
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Analysis parsing error: {str(e)}")

    await db["career_roadmaps"].update_one(
        {"user_id": current_user.id},
        {"$set": {"analysis": data, "created_at": datetime.now(timezone.utc)}},
        upsert=True
    )

    return analysis


@router.get("/roadmap", response_model=CareerAnalysis)
async def get_roadmap(current_user: UserOut = Depends(get_current_user)):
    """Existing: load last document-analysis roadmap."""
    db = get_database()
    roadmap = await db["career_roadmaps"].find_one({"user_id": current_user.id})
    if not roadmap:
        raise HTTPException(status_code=404, detail="No career analysis found. Run analyze first.")
    return CareerAnalysis(**roadmap["analysis"])


@router.post("/manual-roadmap", response_model=FullRoadmap)
async def generate_manual_roadmap(
    request: ManualRoadmapRequest,
    current_user: UserOut = Depends(get_current_user),
):
    """New: generate a full phased roadmap from user's manual profile input."""
    db = get_database()
    
    # ── 1. Check if identical query already generated ─────────────────────────
    cached_doc = await db["career_manual_roadmaps"].find_one({"user_id": current_user.id})
    if cached_doc and "inputs" in cached_doc and "roadmap" in cached_doc:
        cached_inputs = cached_doc["inputs"]
        current_inputs = request.dict()
        
        # Check if parameters are identical
        if (cached_inputs.get("career_field") == current_inputs.get("career_field") and
            cached_inputs.get("skill_level") == current_inputs.get("skill_level") and
            cached_inputs.get("degree") == current_inputs.get("degree") and
            cached_inputs.get("branch") == current_inputs.get("branch") and
            cached_inputs.get("current_year") == current_inputs.get("current_year") and
            cached_inputs.get("graduation_year") == current_inputs.get("graduation_year") and
            sorted(cached_inputs.get("preferences", [])) == sorted(current_inputs.get("preferences", []))):
            
            # Cache Hit! Log usage as hit
            from app.services.cache_service import log_token_usage_optimized
            await log_token_usage_optimized(current_user.id, "career", 1500, 0, True)
            return FullRoadmap(**cached_doc["roadmap"])

    # ── 2. Cache Miss: Generate roadmap ───────────────────────────────────────
    prompt = MANUAL_ROADMAP_PROMPT.format(
        career_field=request.career_field,
        skill_level=request.skill_level,
        degree=request.degree or "Not specified",
        branch=request.branch or "Not specified",
        current_year=request.current_year or "Not specified",
        graduation_year=request.graduation_year or "Not specified",
        preferences=", ".join(request.preferences) if request.preferences else "No specific preferences",
    )

    response = llm.invoke(prompt)
    raw = response.content.strip()

    # Strip markdown code fences if present
    raw = re.sub(r'^```(?:json)?\s*', '', raw, flags=re.MULTILINE)
    raw = re.sub(r'\s*```$', '', raw, flags=re.MULTILINE)

    match = re.search(r'\{.*\}', raw, re.DOTALL)
    if not match:
        raise HTTPException(status_code=500, detail="Failed to parse roadmap from AI response")

    try:
        data = json.loads(match.group())
        # Attach request context
        data["career_field"] = request.career_field
        data["skill_level"] = request.skill_level
        data["preferences"] = request.preferences
        roadmap = FullRoadmap(**data)
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Roadmap parsing error: {str(e)}")

    # Persist to MongoDB
    await db["career_manual_roadmaps"].update_one(
        {"user_id": current_user.id},
        {"$set": {
            "roadmap": data,
            "inputs": request.dict(),
            "created_at": datetime.now(timezone.utc)
        }},
        upsert=True
    )

    # Log token metrics as cache miss
    from app.services.cache_service import log_token_usage_optimized, estimate_tokens
    tokens_before = estimate_tokens(prompt) + 1200
    tokens_after = 0
    actual_usage = None
    if hasattr(response, 'usage_metadata') and response.usage_metadata:
        actual_usage = response.usage_metadata
        tokens_after = actual_usage.get("total_tokens", 0)
    else:
        tokens_after = estimate_tokens(prompt) + estimate_tokens(raw)
        
    await log_token_usage_optimized(
        current_user.id,
        "career",
        tokens_before,
        tokens_after,
        False,
        actual_usage
    )

    return roadmap


@router.post("/manual-roadmap/refresh", response_model=FullRoadmap)
async def refresh_manual_roadmap(
    request: ManualRoadmapRequest,
    current_user: UserOut = Depends(get_current_user),
):
    """Force regenerate manual career roadmap (ignoring cache checks)"""
    prompt = MANUAL_ROADMAP_PROMPT.format(
        career_field=request.career_field,
        skill_level=request.skill_level,
        degree=request.degree or "Not specified",
        branch=request.branch or "Not specified",
        current_year=request.current_year or "Not specified",
        graduation_year=request.graduation_year or "Not specified",
        preferences=", ".join(request.preferences) if request.preferences else "No specific preferences",
    )

    response = llm.invoke(prompt)
    raw = response.content.strip()

    # Strip markdown code fences if present
    raw = re.sub(r'^```(?:json)?\s*', '', raw, flags=re.MULTILINE)
    raw = re.sub(r'\s*```$', '', raw, flags=re.MULTILINE)

    match = re.search(r'\{.*\}', raw, re.DOTALL)
    if not match:
        raise HTTPException(status_code=500, detail="Failed to parse roadmap from AI response")

    try:
        data = json.loads(match.group())
        data["career_field"] = request.career_field
        data["skill_level"] = request.skill_level
        data["preferences"] = request.preferences
        roadmap = FullRoadmap(**data)
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Roadmap parsing error: {str(e)}")

    # Persist to MongoDB
    db = get_database()
    await db["career_manual_roadmaps"].update_one(
        {"user_id": current_user.id},
        {"$set": {
            "roadmap": data,
            "inputs": request.dict(),
            "created_at": datetime.now(timezone.utc)
        }},
        upsert=True
    )

    # Log metrics to DB
    from app.services.cache_service import log_token_usage_optimized, estimate_tokens
    tokens_before = estimate_tokens(prompt) + 1200
    tokens_after = 0
    actual_usage = None
    if hasattr(response, 'usage_metadata') and response.usage_metadata:
        actual_usage = response.usage_metadata
        tokens_after = actual_usage.get("total_tokens", 0)
    else:
        tokens_after = estimate_tokens(prompt) + estimate_tokens(raw)
        
    await log_token_usage_optimized(
        current_user.id,
        "career",
        tokens_before,
        tokens_after,
        False,
        actual_usage
    )

    return roadmap


@router.get("/manual-roadmap", response_model=FullRoadmap)
async def get_manual_roadmap(current_user: UserOut = Depends(get_current_user)):
    """Load the last saved manual roadmap for this user."""
    db = get_database()
    doc = await db["career_manual_roadmaps"].find_one({"user_id": current_user.id})
    if not doc:
        raise HTTPException(status_code=404, detail="No manual roadmap found yet.")
    return FullRoadmap(**doc["roadmap"])


@router.delete("/manual-roadmap")
async def delete_manual_roadmap(current_user: UserOut = Depends(get_current_user)):
    """Delete/clear the saved manual roadmap for this user."""
    db = get_database()
    await db["career_manual_roadmaps"].delete_one({"user_id": current_user.id})
    return {"message": "Manual career roadmap cleared"}

