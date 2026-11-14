from fastapi import APIRouter

from app import datasets
from app.schemas import ConditionsResponse

router = APIRouter()


@router.get("/conditions", response_model=ConditionsResponse)
def get_conditions(sol: int | None = None) -> ConditionsResponse:
    """Return surface conditions for ``sol`` (nearest sol with data), or the latest sol."""
    return datasets.get_conditions(sol)
