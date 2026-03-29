from langchain_groq import ChatGroq
from app.config import settings


def get_llm(temperature: float = 0.2, streaming: bool = False) -> ChatGroq:
    """
    Central factory for the LLM instance using Groq Cloud API.
    All agent code gets its model from here — never instantiate ChatGroq elsewhere.
    """
    return ChatGroq(
        model_name=settings.groq_model,
        groq_api_key=settings.groq_api_key,
        temperature=temperature,
        streaming=streaming,
        timeout=30,
        max_retries=2,
    )