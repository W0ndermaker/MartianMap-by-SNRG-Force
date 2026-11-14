from fastapi import APIRouter

from app import datasets
from app.schemas import PoiCollection

router = APIRouter()


@router.get("/poi", response_model=PoiCollection)
def get_poi() -> PoiCollection:
    """Return points of interest inside the working area."""
    return datasets.get_poi()
