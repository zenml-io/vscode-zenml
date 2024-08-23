# Release Process

This document describes the process of publishing releases for our VS Code extension and provides an explanation of the GitHub Actions workflow file.

## Overview

The release process is automated using GitHub Actions. When a new release is created on GitHub, it triggers the release workflow defined in `.github/workflows/release.yml`. The workflow performs the following steps:

1. Checks out the repository.
2. Installs Node.js and the required dependencies.
3. Builds the extension using webpack.
4. Packages the extension into a `.vsix` file.
5. Publishes the extension to the Visual Studio Code Marketplace.
6. Generates a changelog based on the commit messages.
7. Creates a GitHub release with the packaged extension file as an artifact and the changelog.

## Prerequisites

Before creating a release, ensure that:

- The extension is properly configured and builds successfully.
- The Personal Access Token (PAT) is set as a repository secret named `VSCE_PAT`.

## Creating a Release

To create a new release:

1. Go to the GitHub repository page.
2. Click on the "Releases" tab.
3. Click on the "Draft a new release" button.
4. Enter the tag version for the release (e.g., `v1.0.0`).
5. Set the release title and description.
6. Choose the appropriate release type (e.g., pre-release or stable release).
7. Click on the "Publish release" button.

Creating the release will trigger the release workflow automatically.

## Workflow File Explanation

The release workflow is defined in `.github/workflows/release.yml`. Here's an explanation of each step in the workflow:

1. **Checkout Repository**: This step checks out the repository using the `actions/checkout@v2` action.

2. **Install Node.js**: This step sets up Node.js using the `actions/setup-node@v2` action. It specifies the Node.js version and enables caching of npm dependencies.

3. **Install dependencies**: This step runs `npm ci` to install the project dependencies.

4. **Build Extension**: This step runs `npm run package` to build the extension using webpack.

5. **Package Extension**: This step runs `npm run vsce-package` to package the extension into a `.vsix` file named `zenml.vsix`.

6. **Publish Extension**: This step runs `npm run deploy` to publish the extension to the Visual Studio Code Marketplace. It uses the `VSCE_PAT` secret for authentication. This step only runs if the previous steps succeeded and the workflow was triggered by a new tag push.

7. **Generate Changelog**: This step generates a changelog by running `git log` to retrieve the commit messages between the latest tag and the current commit. The changelog is saved in a file named `CHANGELOG.txt`. This step only runs if the previous steps succeeded and the workflow was triggered by a new tag push.

8. **Create GitHub Release**: This step uses the `ncipollo/release-action@v1` action to create a GitHub release. It attaches the `zenml.vsix` file as an artifact, includes the changelog, and sets the release tag based on the pushed tag. This step only runs if the previous steps succeeded and the workflow was triggered by a new tag push.

## Conclusion

The provided GitHub Actions workflow automates the publishing of the ZenML VSCode extension. The workflow ensures that the extension is built, packaged, published to the marketplace, and a GitHub release is created with the necessary artifacts and changelog.

Remember to keep the extension code up to date, maintain the required dependencies, and test the extension thoroughly before creating a release.
