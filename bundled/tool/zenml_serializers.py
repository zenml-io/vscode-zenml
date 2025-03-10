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
"""Serializers for ZenML objects."""

import datetime
import functools
import json
import uuid
from typing import Any, Dict


def serialize_flavor(flavor):
    """
    Convert a flavor object to a plain dictionary while preserving the expected structure.

    - If flavor is None, return an empty dict.
    - Convert the id of the flavor to a string.
    - Convert the created and updated fields to ISO strings.
    - Convert the type of the flavor to a string.
    - Maintains the structure expected by the TypeScript client.
    """
    if flavor is None:
        return {}
    if isinstance(flavor, str):
        return flavor

    try:
        base_dict: Dict[str, Any] = {}
        if hasattr(flavor, "id"):
            base_dict["id"] = str(flavor.id)
        if hasattr(flavor, "name"):
            base_dict["name"] = flavor.name
        if hasattr(flavor, "type"):
            base_dict["type"] = str(flavor.type)

        for attr in [
            "logo_url",
            "config_schema",
            "docs_url",
            "sdk_docs_url",
            "connector_type",
            "connector_resource_type",
            "connector_resource_id_attr",
        ]:
            if hasattr(flavor, attr):
                base_dict[attr] = getattr(flavor, attr)

        if hasattr(flavor, "body") and flavor.body:
            body = {}
            body_obj = flavor.body

            for attr in ["type", "integration", "source", "logo_url", "user"]:
                if hasattr(body_obj, attr):
                    body[attr] = getattr(body_obj, attr)

            for key in ["created", "updated"]:
                if hasattr(body_obj, key):
                    val = getattr(body_obj, key)
                    if isinstance(val, datetime.datetime):
                        body[key] = val.isoformat()
                    else:
                        body[key] = val

            base_dict["body"] = body

            # Copy datetime properties to top level for backwards compatibility
            for key in ["created", "updated"]:
                if key in body:
                    base_dict[key] = body[key]

        return base_dict
    except Exception:
        return str(flavor)


def serialize_object(obj):
    """
    Recursively processes objects to serialize problematic types for JSON conversion.

    Handles:
    - datetime.datetime -> ISO string
    - uuid.UUID -> string
    - property objects -> string or property value
    - objects with __dict__ -> processed dictionary

    Args:
        obj: Any Python object to process

    Returns:
        The processed object with problematic types converted to JSON-compatible formats
    """
    if obj is None:
        return None

    # Handle datetime objects
    if isinstance(obj, datetime.datetime):
        return obj.isoformat()

    # Handle UUID objects
    if isinstance(obj, uuid.UUID):
        return str(obj)

    # Handle property objects
    if isinstance(obj, property):
        return str(obj)

    # Handle dictionaries
    if isinstance(obj, dict):
        return {k: serialize_object(v) for k, v in obj.items()}

    # Handle lists
    if isinstance(obj, list):
        return [serialize_object(i) for i in obj]

    # Handle tuples
    if isinstance(obj, tuple):
        return tuple(serialize_object(i) for i in obj)

    # If it has a __dict__ attribute, convert it to a dict and process
    if hasattr(obj, "__dict__"):
        # Convert to dict and then process that dict
        return serialize_object(obj.__dict__)

    # For any other non-serializable objects, convert to string
    try:
        json.dumps(obj)  # Test if object is JSON serializable
        return obj
    except (TypeError, OverflowError):
        return str(obj)


def serialize_response(func):
    """Decorator to ensure all responses are properly serialized for JSON-RPC."""

    @functools.wraps(func)
    def wrapper(*args, **kwargs):
        result = func(*args, **kwargs)
        return serialize_object(result)

    return wrapper
