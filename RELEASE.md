# Release Process Guide

This document describes the process for testing and releasing new versions of the ZenML VSCode extension.

## Testing Releases

Before publishing a new version of the extension, you should test the release process to ensure everything works correctly. We have a dedicated GitHub Actions workflow for this purpose.

### Using the Test Workflow

1. **Prepare your changes**

   - Update the version in `package.json`
   - Update `CHANGELOG.md` with the new version and changes
   - Commit these changes to your branch

2. **Run the test workflow**

   - Go to the Actions tab in the GitHub repository
   - Select "Test VSCode Extension Release" workflow
   - Click "Run workflow"
   - Select the branch containing your changes
   - Click "Run workflow" again

3. **Review the workflow output**

   - Check that all steps completed successfully
   - Verify the package content and validation passed
   - Review the generated changelog and release notes

4. **Test the extension locally**
   - Download the VSIX artifact from the workflow run
   - Install it in VS Code using: `code --install-extension zenml.vsix`
   - Test that all features work as expected

### How the Test Workflow Works

The test workflow (`.github/workflows/test-publish.yml`) performs these steps:

1. **Build and Package**

   - Builds the extension source code
   - Packages it into a VSIX file
   - Runs the test suite

2. **Validate**

   - Verifies the package content
   - Validates required fields in package.json
   - Simulates the publishing process without actually publishing

3. **Generate Documentation**

   - Creates a changelog from git history since the last tag
   - Extracts the current version's information from CHANGELOG.md

4. **Upload Artifacts**
   - Makes the VSIX package available for download
   - Provides the generated changelog and release notes for review

## Publishing a Release

Once you've tested the release and everything looks good, you can publish it:

1. **Tag the Release**

   ```bash
   git tag -a 0.0.x -m "Version 0.0.x"
   git push origin 0.0.x
   ```

2. **Create a GitHub Release**
   - Go to the Releases page in the GitHub repository
   - Click "Draft a new release"
   - Select the tag you just pushed
   - Title the release "Version 0.0.x"
   - The release workflow will automatically:
     - Publish the extension to the VS Code Marketplace
     - Attach the VSIX file to the GitHub release
     - Use the content from CHANGELOG.md as release notes

### Release Workflow Details

The release workflow (`.github/workflows/release.yml`) is triggered when a GitHub release is created. It:

1. Builds and packages the extension
2. Runs tests to ensure quality
3. Publishes the extension to the VS Code Marketplace
4. Updates the GitHub release with artifacts and release notes

## Troubleshooting

If you encounter issues during the release process:

- **Build failures**: Check the logs for specific error messages
- **Test failures**: Run tests locally to debug before retrying
- **Publication issues**: Verify the VSCE_PAT secret is valid in the repository settings
- **Version conflicts**: Ensure the version in package.json matches your tag
