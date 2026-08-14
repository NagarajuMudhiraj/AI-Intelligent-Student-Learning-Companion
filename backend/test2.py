import asyncio
import os
from dotenv import load_dotenv
load_dotenv()

from app.db.database import connect_to_mongo, get_database
from app.services.rag_service import search_documents

async def test():
    await connect_to_mongo()
    db = get_database()
    doc = await db['documents'].find_one()
    if not doc:
        print("No document found")
        return
    print('Doc:', doc['_id'])
    
    try:
        res = search_documents('explain', str(doc['user_id']), str(doc['_id']), 4)
        print('Docs:', len(res))
    except Exception as e:
        print("Error:", e)
        import traceback
        traceback.print_exc()

if __name__ == "__main__":
    asyncio.run(test())
