# Copyright (c) Microsoft Corporation. All rights reserved.
# Licensed under the MIT License.
"""All the action we need during build"""

import json
import os
import pathlib
import urllib.request as url_lib
from typing import List

import nox  # pylint: disable=import-error

PYTHON_DIRS = ["./bundled/tool", "./src/test/python_tests", "noxfile.py"]
EXCLUDE_PATTERN = "--exclude __init__.py"


def _install_bundle(session: nox.Session) -> None:
    session.install(
        "-t",
        "./bundled/libs",
        "--no-cache-dir",
        "--implementation",
        "py",
        "--no-deps",
        "--upgrade",
        "-r",
        "./requirements.txt",
    )


def _check_files(names: List[str]) -> None:
    root_dir = pathlib.Path(__file__).parent
    for name in names:
        file_path = root_dir / name
        lines: List[str] = file_path.read_text().splitlines()
        if any(line for line in lines if line.startswith("# TODO:")):
            # pylint: disable=broad-exception-raised
            raise Exception(f"Please update {os.fspath(file_path)}.")


def _update_pip_packages(session: nox.Session) -> None:
    session.run(
        "pip-compile",
        "--generate-hashes",
        "--resolver=backtracking",
        "--upgrade",
        "./requirements.in",
    )
    session.run(
        "pip-compile",
        "--generate-hashes",
        "--resolver=backtracking",
        "--upgrade",
        "./src/test/python_tests/requirements.in",
    )


def _get_package_data(package):
    json_uri = f"https://registry.npmjs.org/{package}"
    with url_lib.urlopen(json_uri) as response:
        return json.loads(response.read())


def _update_npm_packages(session: nox.Session) -> None:
    pinned = {
        "vscode-languageclient",
        "@types/vscode",
        "@types/node",
    }
    package_json_path = pathlib.Path(__file__).parent / "package.json"
    package_json = json.loads(package_json_path.read_text(encoding="utf-8"))

    for package in package_json["dependencies"]:
        if package not in pinned:
            data = _get_package_data(package)
            latest = "^" + data["dist-tags"]["latest"]
            package_json["dependencies"][package] = latest

    for package in package_json["devDependencies"]:
        if package not in pinned:
            data = _get_package_data(package)
            latest = "^" + data["dist-tags"]["latest"]
            package_json["devDependencies"][package] = latest

    # Ensure engine matches the package
    if package_json["engines"]["vscode"] != package_json["devDependencies"]["@types/vscode"]:
        print("Please check VS Code engine version and @types/vscode version in package.json.")

    new_package_json = json.dumps(package_json, indent=4)
    # JSON dumps uses \n for line ending on all platforms by default
    if not new_package_json.endswith("\n"):
        new_package_json += "\n"
    package_json_path.write_text(new_package_json, encoding="utf-8")
    session.run("npm", "install", external=True)


def _setup_template_environment(session: nox.Session) -> None:
    session.install("wheel", "pip-tools")
    session.run(
        "pip-compile",
        "--generate-hashes",
        "--resolver=backtracking",
        "--upgrade",
        "./requirements.in",
    )
    session.run(
        "pip-compile",
        "--generate-hashes",
        "--resolver=backtracking",
        "--upgrade",
        "./src/test/python_tests/requirements.in",
    )
    _install_bundle(session)


@nox.session()
def setup(session: nox.Session) -> None:
    """Sets up the template for development."""
    _setup_template_environment(session)
    print(f"DEBUG – Virtual Environment Interpreter: {session.bin}/python")


@nox.session()
def tests(session: nox.Session) -> None:
    """Runs all the tests for the extension."""
    session.install("-r", "src/test/python_tests/requirements.txt")
    session.run("pytest", "src/test/python_tests")


def _run_ruff_on_all_dirs(session, command, *args):
    """Run a ruff command on all Python directories."""
    for directory in PYTHON_DIRS:
        session.run("ruff", command, *args, directory)


@nox.session()
def lint(session: nox.Session) -> None:
    """Runs linter and formatter checks on python files."""
    session.install("-r", "./requirements.txt", "-r", "src/test/python_tests/requirements.txt")
    session.install("pylint", "ruff")

    # Pylint checks
    session.run("pylint", "-d", "W0511", "./bundled/tool")
    session.run(
        "pylint",
        "-d",
        "W0511",
        "--ignore=./src/test/python_tests/test_data",
        "./src/test/python_tests",
    )
    session.run("pylint", "-d", "W0511", "noxfile.py")

    # Ruff checks
    _run_ruff_on_all_dirs(session, "check")

    # Unused imports and variables
    for directory in PYTHON_DIRS:
        session.run(
            "ruff", "check", "--select", "F401,F841", EXCLUDE_PATTERN, "--isolated", directory
        )

    # Check formatting
    _run_ruff_on_all_dirs(session, "format", "--check")

    # Check typescript
    session.run("npm", "run", "lint", external=True)


@nox.session()
def build_package(session: nox.Session) -> None:
    """Builds VSIX package for publishing."""
    _check_files(["README.md", "LICENSE", "SECURITY.md", "SUPPORT.md"])
    _setup_template_environment(session)
    session.run("npm", "install", external=True)
    session.run("npm", "run", "vsce-package", external=True)


@nox.session()
def format(session: nox.Session) -> None:
    """Formats python files."""
    session.install("-r", "./requirements.txt", "-r", "src/test/python_tests/requirements.txt")
    session.install("ruff")

    # Remove unused imports and variables
    for directory in PYTHON_DIRS:
        session.run(
            "ruff",
            "check",
            "--select",
            "F401,F841",
            "--fix",
            EXCLUDE_PATTERN,
            "--isolated",
            directory,
        )

    # Sort imports
    for directory in PYTHON_DIRS:
        session.run("ruff", "check", "--select", "I", "--fix", "--ignore", "D", directory)

    # Format code
    _run_ruff_on_all_dirs(session, "format")

    # Format TypeScript
    session.run("npm", "run", "format", external=True)


@nox.session()
def update_packages(session: nox.Session) -> None:
    """Update pip and npm packages."""
    session.install("wheel", "pip-tools")
    _update_pip_packages(session)
    _update_npm_packages(session)
