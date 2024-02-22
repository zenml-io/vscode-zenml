from zenml.zen_server.deploy.deployer import ServerDeployer


def disconnect_from_server():
    deployer = ServerDeployer()
    try:
        deployer.disconnect_from_server()
        print("Disconnected successfully.")
    except Exception as e:
        print(f"Failed to disconnect: {str(e)}")


if __name__ == "__main__":
    disconnect_from_server()
