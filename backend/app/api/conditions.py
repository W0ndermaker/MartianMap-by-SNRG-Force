from fastapi import APIRouter

from app.schemas import ConditionsResponse
from app.stubs.loader import load_stub

router = APIRouter()


@router.get("/conditions", response_model=ConditionsResponse)
def get_conditions(sol: int | None = None) -> ConditionsResponse:
    """Return the contract example conditions (stub; ``sol`` is ignored for now)."""
    return ConditionsResponse.model_validate(load_stub("conditions"))
