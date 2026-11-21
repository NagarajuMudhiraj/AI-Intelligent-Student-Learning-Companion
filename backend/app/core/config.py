from pydantic_settings import BaseSettings
from pydantic import field_validator

class Settings(BaseSettings):
    PROJECT_NAME: str = "AI Student Companion"
    VERSION: str = "1.0.0"
    API_V1_STR: str = "/api/v1"

    MONGODB_URL: str = "mongodb://localhost:27017"
    DATABASE_NAME: str = "aistudentdb"
    MONGODB_TLS: bool = False

    SECRET_KEY: str = "DEFAULT_SECRET_PLEASE_CHANGE"
    ALGORITHM: str = "HS256"
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 1440  # 24 hours

    GEMINI_API_KEY: str = "AIzaSy_REPLACE_WITH_YOUR_KEY"
    GOOGLE_CLIENT_ID: str = ""

    # Comma-separated list of allowed CORS origins
    CORS_ORIGINS: str = "http://localhost:5173,http://localhost,http://127.0.0.1:5173"

    @field_validator("GEMINI_API_KEY", mode="before")
    @classmethod
    def ensure_non_empty_key(cls, v):
        if not v or not str(v).strip():
            return "AIzaSy_REPLACE_WITH_YOUR_KEY"
        return str(v).strip()

    class Config:
        env_file = ".env"

settings = Settings()
