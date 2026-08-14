import asyncio
import os
from dotenv import load_dotenv

load_dotenv()

from app.db.database import connect_to_mongo, get_database
from app.services.rag_service import search_documents
from app.api.chat import llm, RAG_PROMPT_TEMPLATE
from langchain_core.prompts import PromptTemplate

async def test():
    await connect_to_mongo()
    db = get_database()
    user = await db['users'].find_one()
    if not user:
        print("No user found")
        return
    print('User:', user['_id'])
    
    try:
        res = search_documents('explain', str(user['_id']), None, 4)
        print('Docs:', len(res))
        
        context_text = "\n\n---\n\n".join([doc.page_content for doc in res])
        prompt = PromptTemplate(
            template=RAG_PROMPT_TEMPLATE,
            input_variables=["context", "question"],
        )
        final_prompt = prompt.format(context=context_text, question='explain')
        
        response = llm.invoke(final_prompt)
        print("LLM Response:", response.content)
    except Exception as e:
        print("Error:", e)
        import traceback
        traceback.print_exc()

if __name__ == "__main__":
    asyncio.run(test())
