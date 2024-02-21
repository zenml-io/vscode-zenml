from pydantic import BaseModel
from zenml.zen_server.utils import get_active_server_details
from urllib.parse import urlparse


class ServerStatusModel(BaseModel):
    is_connected: bool
    host: str
    port: int


def check_server_status() -> str:
    try:
        url, port = get_active_server_details()
        parsed_url = urlparse(url)
        server_status = ServerStatusModel(
            is_connected=True,
            host=parsed_url.hostname,
            port=parsed_url.port if port is None else port,
        )
    except RuntimeError:
        server_status = ServerStatusModel(is_connected=False, host="", port=0)

    return server_status.json(indent=4)


if __name__ == "__main__":
    print(check_server_status())
