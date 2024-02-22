from pydantic import BaseModel, Field
from zenml.zen_server.utils import get_active_server_details
from urllib.parse import urlparse
from global_config import fetch_store_info


class ServerStatusModel(BaseModel):
    is_connected: bool
    host: str = ""
    port: int = 0
    store_type: str = Field(default=None, alias="storeType")
    store_url: str = Field(default=None, alias="storeUrl")


def check_server_status() -> str:
    store_type, store_url = fetch_store_info()
    try:
        url, port = get_active_server_details()
        parsed_url = urlparse(url)
        server_status = ServerStatusModel(
            is_connected=(False if store_type == "sql" else True),
            host=parsed_url.hostname,
            port=parsed_url.port if port is None else port,
            storeType=(store_type if store_type == "sql" else None),
            storeUrl=(store_url if store_type == "sql" else None),
        )
    except RuntimeError:
        server_status = ServerStatusModel(
            is_connected=False,
            storeType=store_type if store_type == "sql" else None,
            storeUrl=store_url if store_type == "sql" else None,
        )

    return server_status.json(indent=4)


if __name__ == "__main__":
    print(check_server_status())
