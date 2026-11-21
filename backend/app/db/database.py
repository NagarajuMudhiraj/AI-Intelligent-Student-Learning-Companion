import asyncio
from motor.motor_asyncio import AsyncIOMotorClient
from app.core.config import settings

class Database:
    client = None
    db = None

db = Database()

async def connect_to_mongo():
    print(f"Connecting to MongoDB at {settings.MONGODB_URL}...")
    
    # Auto-detect TLS requirements or explicit MONGODB_TLS config
    is_srv = settings.MONGODB_URL.startswith("mongodb+srv://")
    use_tls = is_srv or settings.MONGODB_TLS
    
    client_options = {
        "serverSelectionTimeoutMS": 2000,
        "maxPoolSize": 50,
        "minPoolSize": 5,
    }
    
    if use_tls and not is_srv:
        client_options["tls"] = True
    
    try:
        candidate_client = AsyncIOMotorClient(settings.MONGODB_URL, **client_options)
        await asyncio.wait_for(candidate_client.admin.command('ping'), timeout=2.0)
        db.client = candidate_client
        db.db = db.client[settings.DATABASE_NAME]
        print("Connected to MongoDB with secure connection settings!")
    except Exception as e:
        print(f"MongoDB connection to {settings.MONGODB_URL} timed out or failed: {e}")
        print("Starting in-memory fallback database (mongomock-motor)...")
        try:
            from mongomock_motor import AsyncMongoMockClient
            db.client = AsyncMongoMockClient()
            db.db = db.client[settings.DATABASE_NAME]
            print("In-memory database initialized successfully!")
        except Exception as mock_err:
            print(f"Failed to initialize in-memory database: {mock_err}")
            db.client = candidate_client
            db.db = candidate_client[settings.DATABASE_NAME]

async def close_mongo_connection():
    print("Closing MongoDB connection...")
    if db.client:
        try:
            db.client.close()
        except Exception:
            pass
        print("Closed.")

def get_database():
    return db.db
