from pydantic import BaseModel
from zenml.config.global_config import GlobalConfiguration


class ServerStatusModel(BaseModel):
    is_connected: bool
    store_type: str
    store_url: str


def check_server_status() -> str:
    gc = GlobalConfiguration()

    is_connected = False
    store_type = ""
    store_url = ""

    if gc.store:
        store_url = gc.store.url
        if gc.store.type == "rest":
            is_connected = True
            if "127.0.0.1" in store_url or "localhost" in store_url:
                store_type = "local server"
            else:
                store_type = "remote server"
        elif gc.store.type == "sql":
            store_type = "local database"
            is_connected = False
    else:
        is_connected = False

    server_status = ServerStatusModel(
        is_connected=is_connected, store_type=store_type, store_url=store_url
    )
    return server_status.json(indent=4)


if __name__ == "__main__":
    print(check_server_status())
