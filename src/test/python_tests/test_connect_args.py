#  Copyright (c) ZenML GmbH 2024. All Rights Reserved.
#  Licensed under the Apache License, Version 2.0 (the "License");
#  you may not use this file except in compliance with the License.
#  You may obtain a copy of the License at:
#
#       http://www.apache.org/licenses/LICENSE-2.0
#
#  Unless required by applicable law or agreed to in writing, software
#  distributed under the License is distributed on an "AS IS" BASIS,
#  WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express
#  or implied. See the License for the specific language governing
#  permissions and limitations under the License.
"""Tests for ZenServerWrapper.connect() argument parsing.

Validates that both the corrected and legacy arg shapes correctly extract
docker and port options for local connections.
"""
import sys
from pathlib import Path
from unittest.mock import MagicMock

import pytest

# Add bundled/tool to sys.path so we can import zenml_wrappers directly
BUNDLED_TOOL = str(Path(__file__).resolve().parents[3] / "bundled" / "tool")
if BUNDLED_TOOL not in sys.path:
    sys.path.insert(0, BUNDLED_TOOL)

from zenml_wrappers import ZenServerWrapper


@pytest.fixture()
def server_wrapper():
    """Create a ZenServerWrapper with mocked dependencies."""
    config_wrapper = MagicMock()
    projects_wrapper = MagicMock()

    mock_start_local_server = MagicMock(return_value=None)

    def mock_lazy_import(module: str, name: str):
        if name == "start_local_server":
            return mock_start_local_server
        return MagicMock()

    wrapper = ZenServerWrapper(config_wrapper, projects_wrapper)
    wrapper.lazy_import = mock_lazy_import
    wrapper._mock_start_local_server = mock_start_local_server  # type: ignore[attr-defined]
    return wrapper


class TestLocalConnectArgs:
    """Tests for local connection argument parsing (P0 bug fix)."""

    def test_empty_args_returns_error(self, server_wrapper: ZenServerWrapper):
        result = server_wrapper.connect([])
        assert "error" in result

    def test_corrected_shape_extracts_options(self, server_wrapper: ZenServerWrapper):
        """Corrected shape: ['local', options_dict]."""
        result = server_wrapper.connect(["local", {"docker": True, "port": 9000}])
        assert result == {"message": "Local ZenML server started and connected successfully."}

        server_wrapper._mock_start_local_server.assert_called_once_with(  # type: ignore[attr-defined]
            docker=True, port=9000
        )

    def test_legacy_shape_extracts_options(self, server_wrapper: ZenServerWrapper):
        """Legacy shape: ['local', url_placeholder, options_dict, verify_ssl]."""
        result = server_wrapper.connect(["local", "", {"docker": False, "port": 8237}, True])
        assert result == {"message": "Local ZenML server started and connected successfully."}

        server_wrapper._mock_start_local_server.assert_called_once_with(  # type: ignore[attr-defined]
            docker=False, port=8237
        )

    def test_local_no_options_uses_defaults(self, server_wrapper: ZenServerWrapper):
        """['local'] with no options should default to docker=False, port=None."""
        result = server_wrapper.connect(["local"])
        assert result == {"message": "Local ZenML server started and connected successfully."}

        server_wrapper._mock_start_local_server.assert_called_once_with(  # type: ignore[attr-defined]
            docker=False, port=None
        )

    def test_local_empty_dict_uses_defaults(self, server_wrapper: ZenServerWrapper):
        """['local', {}] should use default values."""
        result = server_wrapper.connect(["local", {}])
        assert result == {"message": "Local ZenML server started and connected successfully."}

        server_wrapper._mock_start_local_server.assert_called_once_with(  # type: ignore[attr-defined]
            docker=False, port=None
        )


class TestRemoteConnectArgs:
    """Tests for remote connection argument parsing."""

    def test_remote_missing_url_returns_error(self, server_wrapper: ZenServerWrapper):
        result = server_wrapper.connect(["remote"])
        assert "error" in result
        assert "URL" in result["error"]
