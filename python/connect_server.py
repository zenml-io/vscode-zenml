import sys
from zenml.zen_server.deploy.deployer import ServerDeployer


def connect_to_server(server_name, username, password, verify_ssl=True):
    if not server_name or not username or not password:
        print("Missing arguments. Server name, username, and password are required.")
        return
    deployer = ServerDeployer()
    try:
        deployer.connect_to_server(server_name, username, password, verify_ssl)
        print("Connected successfully.")
    except Exception as e:
        print(f"Failed to connect: {str(e)}")


if __name__ == "__main__":
    args = sys.argv[1:]
    if len(args) < 3:
        print("Error: Missing required arguments.")
        sys.exit(1)
    server_name, username, password = args
    # verify_ssl from sys.argv if needed
    connect_to_server(server_name, username, password)
