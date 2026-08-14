from motor.motor_asyncio import AsyncIOMotorClient
from app.core.config import settings

class Database:
    client: AsyncIOMotorClient = None
    db = None

db = Database()

async def connect_to_mongo():
    print(f"Connecting to MongoDB at {settings.MONGODB_URL}...")
    
    # Auto-detect TLS requirements or explicit MONGODB_TLS config
    is_srv = settings.MONGODB_URL.startswith("mongodb+srv://")
    use_tls = is_srv or settings.MONGODB_TLS
    
    client_options = {
        "serverSelectionTimeoutMS": 5000,
        "maxPoolSize": 50,
        "minPoolSize": 5,
    }
    
    if use_tls and not is_srv:
        client_options["tls"] = True
    
    db.client = AsyncIOMotorClient(settings.MONGODB_URL, **client_options)
    db.db = db.client[settings.DATABASE_NAME]
    print("Connected to MongoDB with secure connection settings!")

async def close_mongo_connection():
    print("Closing MongoDB connection...")
    if db.client:
        db.client.close()
        print("Closed.")

def get_database():
    return db.db
