# models.py
from pydantic import BaseModel, UUID4, Field
from typing import List, Dict, Optional


class StackComponentModel(BaseModel):
    id: UUID4
    name: str
    flavor: str
    type: str


class StackModel(BaseModel):
    id: UUID4
    name: str
    components: Dict[str, List[StackComponentModel]] = Field(default_factory=dict)


class UserModel(BaseModel):
    id: Optional[UUID4]
    name: Optional[str]


def serialize_stack_component(component) -> StackComponentModel:
    """Serializes a single stack component to a StackComponentModel instance."""
    return StackComponentModel(
        id=str(component.id),
        name=component.name,
        flavor=component.flavor,
        type=component.type,
    )
