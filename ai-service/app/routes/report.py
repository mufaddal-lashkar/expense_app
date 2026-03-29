import json
import logging
from fastapi import APIRouter
from fastapi.responses import StreamingResponse
from app.models import ReportRequest
from app.agents.reporter import stream_report

router = APIRouter()
logger = logging.getLogger(__name__)


def format_sse(text: str, done: bool = False) -> str:
    """Format a chunk as a valid SSE message."""
    payload = json.dumps({"text": text, "done": done})
    return f"data: {payload}\n\n"


@router.post("/generate-report")
async def generate_report_endpoint(req: ReportRequest) -> StreamingResponse:
    """
    Streams the AI-generated monthly report as SSE.
    Each chunk is a JSON object: { text: string, done: boolean }
    Final chunk has done: true and empty text.
    """
    async def event_generator():
        try:
            async for chunk in stream_report(req):
                yield format_sse(text=chunk, done=False)

            # Signal stream completion
            yield format_sse(text="", done=True)

        except Exception as e:
            logger.error(f"SSE generator error: {e}")
            yield format_sse(text="\n\n⚠️ Stream failed unexpectedly.", done=False)
            yield format_sse(text="", done=True)

    return StreamingResponse(
        event_generator(),
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache",
            "Connection": "keep-alive",
            "X-Accel-Buffering": "no",
        },
    )