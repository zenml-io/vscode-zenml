# zenml_global_config.py
from zenml.config.global_config import GlobalConfiguration
from models import UserModel

gc = GlobalConfiguration()


def fetch_active_user():
    """Fetches the active user."""
    active_user = gc.zen_store.get_user()
    user_model = UserModel(id=active_user.id, name=active_user.name)
    return user_model.json(indent=2)


def fetch_store_info():
    store_type = gc.store.type
    store_url = gc.store.url
    return store_type, store_url


if __name__ == "__main__":
    print(gc.json(indent=2))
