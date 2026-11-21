from langchain_google_genai import ChatGoogleGenerativeAI
from app.core.config import settings

class NormalizedChatLLM:
    def __init__(self, base_llm):
        self._llm = base_llm

    def invoke(self, *args, **kwargs):
        res = self._llm.invoke(*args, **kwargs)
        if hasattr(res, "content") and isinstance(res.content, list):
            res.content = "".join(
                part.get("text", "") if isinstance(part, dict) else str(part)
                for part in res.content
            )
        return res

    async def ainvoke(self, *args, **kwargs):
        res = await self._llm.ainvoke(*args, **kwargs)
        if hasattr(res, "content") and isinstance(res.content, list):
            res.content = "".join(
                part.get("text", "") if isinstance(part, dict) else str(part)
                for part in res.content
            )
        return res

    def __getattr__(self, name):
        return getattr(self._llm, name)

def get_chat_llm(temperature: float = 0.3) -> NormalizedChatLLM:
    base = ChatGoogleGenerativeAI(
        model="gemini-3.5-flash-lite",
        google_api_key=settings.GEMINI_API_KEY,
        temperature=temperature,
    )
    return NormalizedChatLLM(base)
