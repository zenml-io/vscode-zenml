# get_active_stack.py
from zenml.client import Client
from pydantic import BaseModel
from models import StackModel, serialize_stack_component


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
