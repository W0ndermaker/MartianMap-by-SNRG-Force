"""Application factory: CORS and routes."""

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.api import conditions, health, poi, route
from app.config import get_allowed_origins

app = FastAPI(title="Martian Map API")

app.add_middleware(
    CORSMiddleware,
    allow_origins=get_allowed_origins(),
    allow_methods=["GET", "POST", "OPTIONS"],
    allow_headers=["*"],
)

for module in (route, conditions, poi, health):
    app.include_router(module.router, prefix="/api")
