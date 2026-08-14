from fastapi import FastAPI, Request
from fastapi.responses import JSONResponse
from fastapi.middleware.cors import CORSMiddleware
from contextlib import asynccontextmanager
from app.core.config import settings
from app.core.security_headers import SecurityHeadersMiddleware
from app.db.database import connect_to_mongo, close_mongo_connection
from app.api.auth import router as auth_router
from app.api.documents import router as documents_router
from app.api.chat import router as chat_router
from app.api.quiz import router as quiz_router
from app.api.flashcards import router as flashcards_router
from app.api.planner import router as planner_router
from app.api.analytics import router as analytics_router
from app.api.settings import router as settings_router
from app.api.career import router as career_router


@asynccontextmanager
async def lifespan(app: FastAPI):
    """Manage application startup and shutdown lifecycle."""
    await connect_to_mongo()
    yield
    await close_mongo_connection()


app = FastAPI(
    title=settings.PROJECT_NAME,
    version=settings.VERSION,
    openapi_url=f"{settings.API_V1_STR}/openapi.json",
    lifespan=lifespan,
)

# Set up CORS — origins driven from env for multi-environment support
origins = [o.strip() for o in settings.CORS_ORIGINS.split(",") if o.strip()]

app.add_middleware(SecurityHeadersMiddleware)
app.add_middleware(
    CORSMiddleware,
    allow_origins=origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.exception_handler(Exception)
async def global_exception_handler(request: Request, exc: Exception):
    # Do NOT expose raw exception message to clients in production
    return JSONResponse(
        status_code=500,
        content={"detail": "An internal server error occurred. Please try again later."},
        headers={"Access-Control-Allow-Origin": "*"},
    )


app.include_router(auth_router,       prefix=f"{settings.API_V1_STR}/auth",       tags=["auth"])
app.include_router(documents_router,  prefix=f"{settings.API_V1_STR}/documents",  tags=["documents"])
app.include_router(chat_router,       prefix=f"{settings.API_V1_STR}/chat",       tags=["chat"])
app.include_router(quiz_router,       prefix=f"{settings.API_V1_STR}/quiz",       tags=["quiz"])
app.include_router(flashcards_router, prefix=f"{settings.API_V1_STR}/flashcards", tags=["flashcards"])
app.include_router(planner_router,    prefix=f"{settings.API_V1_STR}/planner",    tags=["planner"])
app.include_router(analytics_router,  prefix=f"{settings.API_V1_STR}/analytics",  tags=["analytics"])
app.include_router(settings_router,   prefix=f"{settings.API_V1_STR}/settings",   tags=["settings"])
app.include_router(career_router,     prefix=f"{settings.API_V1_STR}/career",     tags=["career"])


@app.get("/")
async def root():
    return {"message": "Welcome to AI Student Companion API!"}
