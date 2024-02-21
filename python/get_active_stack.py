from zenml.client import Client
from pydantic import BaseModel, UUID4, Field
from typing import List, Dict


class StackComponentModel(BaseModel):
    id: UUID4
    name: str
    flavor: str
    type: str


class StackModel(BaseModel):
    id: UUID4
    name: str
    components: Dict[str, List[StackComponentModel]] = Field(default_factory=dict)


def serialize_stack_component(component) -> StackComponentModel:
    """Serializes a single stack component to a StackComponentModel instance."""
    return StackComponentModel(
        id=component.id,
        name=component.name,
        flavor=component.flavor,
        type=component.type,
    )


def get_active_stack_info() -> str:
    client = Client()
    try:
        active_stack = client.active_stack_model
        stack_components = {}

        for component_type, components in active_stack.components.items():
            stack_components[component_type] = [
                serialize_stack_component(c) for c in components
            ]

        stack_model = StackModel(
            id=active_stack.id, name=active_stack.name, components=stack_components
        )

        return stack_model.json(indent=4)
    except Exception as e:
        error_model = BaseModel.parse_obj({"error": str(e)})
        return error_model.json()


if __name__ == "__main__":
    print(get_active_stack_info())
