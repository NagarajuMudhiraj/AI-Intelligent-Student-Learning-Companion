from pydantic_settings import BaseSettings

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

    GEMINI_API_KEY: str = ""
    GOOGLE_CLIENT_ID: str = ""

    # Comma-separated list of allowed CORS origins
    CORS_ORIGINS: str = "http://localhost:5173,http://localhost,http://127.0.0.1:5173"

    class Config:
        env_file = ".env"

settings = Settings()
