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
"""Wrapper for ZenML deployment operations."""

from datetime import date, datetime, time
from typing import Any, Dict, Optional, Tuple, Union
from uuid import UUID

from type_hints import (
    Deployment,
    DeploymentInvokeResponse,
    DeploymentLogsResponse,
    DeploymentOperationResponse,
    DeploymentSnapshot,
    ErrorResponse,
    ListDeploymentsResponse,
)
from zenml_serializers import serialize_response


def _serialize_for_json(obj: Any) -> Any:
    """Recursively serialize an object for JSON, handling datetime and UUID types."""
    if obj is None:
        return None
    if isinstance(obj, (datetime, date, time)):
        return obj.isoformat()
    if isinstance(obj, UUID):
        return str(obj)
    if isinstance(obj, dict):
        return {key: _serialize_for_json(value) for key, value in obj.items()}
    if isinstance(obj, (list, tuple)):
        return [_serialize_for_json(item) for item in obj]
    if isinstance(obj, (str, int, float, bool)):
        return obj
    if hasattr(obj, "value"):
        return obj.value
    return obj


def _get_field_from_response(obj, field_name, default=None):
    """Helper to get field from body or resources location."""
    if hasattr(obj, field_name):
        value = getattr(obj, field_name)
        if value is not None:
            return value

    if hasattr(obj, "resources") and hasattr(obj.resources, field_name):
        value = getattr(obj.resources, field_name)
        if value is not None:
            return value

    return default


def _get_deployment_status(deployment) -> str:
    """Get the status from a deployment, handling model structure."""
    status = getattr(deployment, "status", None)
    if status is not None:
        if hasattr(status, "_value_"):
            return status._value_
        if hasattr(status, "value"):
            return status.value
        return str(status)

    if hasattr(deployment, "body") and deployment.body is not None:
        status = getattr(deployment.body, "status", None)
        if status is not None:
            if hasattr(status, "_value_"):
                return status._value_
            if hasattr(status, "value"):
                return status.value
            return str(status)

    return "unknown"


class DeploymentsWrapper:
    """Wrapper class for ZenML deployment operations."""

    def __init__(self, client):
        """Initialize the deployments wrapper.

        Args:
            client: The ZenML client instance
        """
        self.client = client

    @property
    def ZenMLBaseException(self):
        """Lazy import of ZenMLBaseException."""
        from lazy_import import lazy_import

        return lazy_import("zenml.exceptions", "ZenMLBaseException")

    @property
    def ValidationError(self):
        """Lazy import of ValidationError."""
        from lazy_import import lazy_import

        return lazy_import("pydantic", "ValidationError")

    def _check_deployments_support(self) -> bool:
        """Check if the current ZenML version supports deployments."""
        try:
            # Try to access deployment-related methods
            return hasattr(self.client, "list_deployments")
        except Exception:
            return False

    def _serialize_snapshot(self, snapshot) -> Optional[DeploymentSnapshot]:
        """Serialize a snapshot object to a dictionary."""
        if snapshot is None:
            return None

        try:
            return {
                "id": str(getattr(snapshot, "id", "")),
                "name": getattr(snapshot, "name", None),
                "createdAt": _serialize_for_json(
                    getattr(snapshot, "created", None) or getattr(snapshot, "created_at", None)
                ),
                "version": getattr(snapshot, "version", None),
            }
        except Exception:
            return None

    def _serialize_deployment(self, deployment) -> Deployment:
        """Serialize a deployment response to a dictionary."""
        # Get snapshot info
        snapshot = _get_field_from_response(deployment, "snapshot")
        serialized_snapshot = self._serialize_snapshot(snapshot)

        # Get pipeline name
        pipeline = _get_field_from_response(deployment, "pipeline")
        pipeline_name = getattr(pipeline, "name", None) if pipeline else None

        # Get stack name
        stack = _get_field_from_response(deployment, "stack")
        stack_name = getattr(stack, "name", None) if stack else None

        # Get deployer name
        deployer = _get_field_from_response(deployment, "deployer")
        deployer_name = getattr(deployer, "name", None) if deployer else None

        # Get user info
        user = _get_field_from_response(deployment, "user")
        user_id = str(getattr(user, "id", "")) if user else None
        user_name = getattr(user, "name", None) if user else None

        # Get URL from body if available
        url = getattr(deployment, "url", None)
        if url is None and hasattr(deployment, "body"):
            url = getattr(deployment.body, "url", None)

        return {
            "id": str(getattr(deployment, "id", "")),
            "name": getattr(deployment, "name", ""),
            "url": url,
            "status": _get_deployment_status(deployment),
            "pipelineName": pipeline_name,
            "snapshot": serialized_snapshot,
            "stackName": stack_name,
            "deployerName": deployer_name,
            "createdAt": _serialize_for_json(
                getattr(deployment, "created", None) or getattr(deployment, "created_at", None)
            ),
            "updatedAt": _serialize_for_json(
                getattr(deployment, "updated", None) or getattr(deployment, "updated_at", None)
            ),
            "userId": user_id,
            "userName": user_name,
        }

    @serialize_response
    def list_deployments(
        self, args: Tuple[int, int, Optional[str]]
    ) -> Union[ListDeploymentsResponse, ErrorResponse]:
        """List deployments with pagination.

        Args:
            args: Tuple of (page, items_per_page, project_name)

        Returns:
            ListDeploymentsResponse or ErrorResponse
        """
        page, items_per_page, project_name = args

        try:
            if not self._check_deployments_support():
                return {"error": "Deployments are not supported in this ZenML version"}

            # Get deployments from ZenML client
            response = self.client.list_deployments(
                page=page,
                size=items_per_page,
                hydrate=True,
            )

            deployments = [self._serialize_deployment(deployment) for deployment in response.items]

            return {
                "deployments": deployments,
                "total": response.total,
                "total_pages": response.total_pages,
                "current_page": response.index,
                "items_per_page": response.max_size,
            }

        except self.ZenMLBaseException as e:
            return {"error": str(e)}
        except self.ValidationError as e:
            return {"error": f"ValidationError: {e}"}
        except Exception as e:
            return {"error": f"Failed to list deployments: {str(e)}"}

    @serialize_response
    def get_deployment(self, args: Tuple[str]) -> Union[Deployment, ErrorResponse]:
        """Get a specific deployment by ID.

        Args:
            args: Tuple containing (deployment_id,)

        Returns:
            Deployment or ErrorResponse
        """
        (deployment_id,) = args

        try:
            deployment = self.client.get_deployment(deployment_id, hydrate=True)
            return self._serialize_deployment(deployment)

        except self.ZenMLBaseException as e:
            return {"error": str(e)}
        except Exception as e:
            return {"error": f"Failed to get deployment: {str(e)}"}

    @serialize_response
    def provision_deployment(
        self, args: Tuple[str]
    ) -> Union[DeploymentOperationResponse, ErrorResponse]:
        """Provision (start) a deployment.

        Args:
            args: Tuple containing (deployment_id,)

        Returns:
            DeploymentOperationResponse or ErrorResponse
        """
        (deployment_id,) = args

        try:
            self.client.provision_deployment(deployment_id)
            return {
                "success": True,
                "message": "Deployment provisioning started",
                "deploymentId": deployment_id,
            }

        except self.ZenMLBaseException as e:
            return {"error": str(e)}
        except Exception as e:
            return {"error": f"Failed to provision deployment: {str(e)}"}

    @serialize_response
    def deprovision_deployment(
        self, args: Tuple[str]
    ) -> Union[DeploymentOperationResponse, ErrorResponse]:
        """Deprovision (stop) a deployment.

        Args:
            args: Tuple containing (deployment_id,)

        Returns:
            DeploymentOperationResponse or ErrorResponse
        """
        (deployment_id,) = args

        try:
            self.client.deprovision_deployment(deployment_id)
            return {
                "success": True,
                "message": "Deployment deprovisioned successfully",
                "deploymentId": deployment_id,
            }

        except self.ZenMLBaseException as e:
            return {"error": str(e)}
        except Exception as e:
            return {"error": f"Failed to deprovision deployment: {str(e)}"}

    @serialize_response
    def delete_deployment(
        self, args: Tuple[str]
    ) -> Union[DeploymentOperationResponse, ErrorResponse]:
        """Delete a deployment permanently.

        Args:
            args: Tuple containing (deployment_id,)

        Returns:
            DeploymentOperationResponse or ErrorResponse
        """
        (deployment_id,) = args

        try:
            self.client.delete_deployment(deployment_id)
            return {
                "success": True,
                "message": "Deployment deleted successfully",
                "deploymentId": deployment_id,
            }

        except self.ZenMLBaseException as e:
            return {"error": str(e)}
        except Exception as e:
            return {"error": f"Failed to delete deployment: {str(e)}"}

    @serialize_response
    def refresh_deployment_status(
        self, args: Tuple[str]
    ) -> Union[DeploymentOperationResponse, ErrorResponse]:
        """Refresh the status of a deployment.

        Args:
            args: Tuple containing (deployment_id,)

        Returns:
            DeploymentOperationResponse or ErrorResponse
        """
        (deployment_id,) = args

        try:
            # Get fresh deployment data to trigger status refresh
            deployment = self.client.get_deployment(deployment_id, hydrate=True)
            status = _get_deployment_status(deployment)
            return {
                "success": True,
                "message": f"Deployment status: {status}",
                "deploymentId": deployment_id,
            }

        except self.ZenMLBaseException as e:
            return {"error": str(e)}
        except Exception as e:
            return {"error": f"Failed to refresh deployment status: {str(e)}"}

    @serialize_response
    def get_deployment_logs(
        self, args: Tuple[str, Optional[int]]
    ) -> Union[DeploymentLogsResponse, ErrorResponse]:
        """Get logs from a deployment.

        Args:
            args: Tuple containing (deployment_id, tail_lines)
                  tail_lines: Number of lines from end (None for all)

        Returns:
            DeploymentLogsResponse or ErrorResponse
        """
        deployment_id = args[0]
        tail_lines = args[1] if len(args) > 1 else 500  # Default to last 500 lines

        try:
            # Get deployment first for name
            deployment = self.client.get_deployment(deployment_id, hydrate=True)
            deployment_name = getattr(deployment, "name", "Unknown")

            # Get logs - returns a Generator, so we need to consume it
            logs = []
            if hasattr(self.client, "get_deployment_logs"):
                import re

                # Regex to strip ANSI escape codes (colors, formatting)
                ansi_escape = re.compile(r"\x1B(?:[@-Z\\-_]|\[[0-?]*[ -/]*[@-~])")

                # get_deployment_logs returns Generator[str, bool, None]
                # We consume it into a list, with optional tail limit
                log_generator = self.client.get_deployment_logs(
                    name_id_or_prefix=deployment_id,
                    follow=False,
                    tail=tail_lines,
                )
                # Consume the generator and strip ANSI codes
                logs = [ansi_escape.sub("", line) for line in log_generator]

            return {
                "logs": logs,
                "deploymentId": deployment_id,
                "deploymentName": deployment_name,
            }

        except self.ZenMLBaseException as e:
            return {"error": str(e)}
        except Exception as e:
            return {"error": f"Failed to get deployment logs: {str(e)}"}

    @serialize_response
    def invoke_deployment(
        self, args: Tuple[str, Dict[str, Any]]
    ) -> Union[DeploymentInvokeResponse, ErrorResponse]:
        """Invoke a deployment with parameters.

        Args:
            args: Tuple containing (deployment_id, payload)

        Returns:
            DeploymentInvokeResponse or ErrorResponse
        """
        deployment_id, payload = args

        try:
            import time

            # Import the invoke utility function from ZenML
            try:
                from zenml.deployers.utils import invoke_deployment as zenml_invoke
            except ImportError:
                return {"error": "Deployment invocation is not supported in this ZenML version"}

            start_time = time.time()

            # Invoke the deployment - payload keys become kwargs
            # The invoke_deployment function expects **kwargs for parameters
            response = zenml_invoke(
                deployment_name_or_id=deployment_id,
                timeout=300,  # 5 minute timeout
                **payload,
            )

            execution_time = time.time() - start_time

            # Serialize response
            serialized_response = _serialize_for_json(response)
            if not isinstance(serialized_response, dict):
                serialized_response = {"result": serialized_response}

            return {
                "success": True,
                "response": serialized_response,
                "executionTime": round(execution_time, 3),
            }

        except self.ZenMLBaseException as e:
            return {"error": str(e)}
        except Exception as e:
            return {"error": f"Failed to invoke deployment: {str(e)}"}
