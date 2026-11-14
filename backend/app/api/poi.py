from fastapi import APIRouter

from app.schemas import PoiCollection
from app.stubs.loader import load_stub

router = APIRouter()


@router.get("/poi", response_model=PoiCollection)
def get_poi() -> PoiCollection:
    """Return the contract example points of interest (stub)."""
    return PoiCollection.model_validate(load_stub("poi"))
