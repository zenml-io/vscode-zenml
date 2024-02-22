# fetch_stacks.py
import json
from zenml.client import Client
from global_config import fetch_active_user
from models import StackModel, serialize_stack_component


def fetch_stacks():
    active_user_json = fetch_active_user()
    active_user = json.loads(active_user_json)
    user_id = active_user["id"]

    client = Client()
    stacks = client.list_stacks(hydrate=True, user_id=user_id)
    stacks_data = [
        StackModel(
            id=stack.id,
            name=stack.name,
            components={
                component_type: [serialize_stack_component(c) for c in components]
                for component_type, components in stack.components.items()
            },
        ).json(indent=4)
        for stack in stacks.items
    ]

    return "[" + ", ".join(stacks_data) + "]"


if __name__ == "__main__":
    print(fetch_stacks())
