"""Application factory: CORS and routes."""

from fastapi import FastAPI, Request
from fastapi.exceptions import RequestValidationError
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse, RedirectResponse

from app.api import conditions, health, poi, route
from app.config import get_allowed_origins

app = FastAPI(title="Martian Map API")

app.add_middleware(
    CORSMiddleware,
    allow_origins=get_allowed_origins(),
    allow_methods=["GET", "POST", "OPTIONS"],
    allow_headers=["*"],
)


@app.exception_handler(RequestValidationError)
async def validation_error(request: Request, exc: RequestValidationError) -> JSONResponse:
    """Return 422 without echoing the input: NaN or infinity in it cannot be sent as JSON."""
    detail = [{k: v for k, v in e.items() if k not in ("input", "ctx")} for e in exc.errors()]
    return JSONResponse(status_code=422, content={"detail": detail})


for module in (route, conditions, poi, health):
    app.include_router(module.router, prefix="/api")


@app.get("/", include_in_schema=False)
def root() -> RedirectResponse:
    """Send browsers that open the bare address to the interactive API docs."""
    return RedirectResponse("/docs")
