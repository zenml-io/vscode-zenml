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
import uuid


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
        result = {}
        direct_attrs = [
            "id",
            "name",
            "type",
            "integration",
            "source",
            "logo_url",
            "config_schema",
            "docs_url",
            "sdk_docs_url",
            "connector_type",
            "connector_resource_type",
            "connector_resource_id_attr",
            "is_custom",
            "created",
            "updated",
            "user",
        ]

        for attr in direct_attrs:
            if hasattr(flavor, attr):
                value = getattr(flavor, attr)
                if isinstance(value, uuid.UUID):
                    result[attr] = str(value)
                elif isinstance(value, datetime.datetime):
                    result[attr] = value.isoformat()
                else:
                    result[attr] = value

        return result
    except Exception:
        return str(flavor)


def serialize_object(obj):
    """
    Efficiently processes objects to serialize problematic types for JSON conversion.

    Optimized for performance - avoids expensive __dict__ conversion and JSON testing.

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

    # Handle basic collections - fast path
    if isinstance(obj, dict):
        return {k: serialize_object(v) for k, v in obj.items()}

    if isinstance(obj, list):
        return [serialize_object(i) for i in obj]

    if isinstance(obj, tuple):
        return tuple(serialize_object(i) for i in obj)

    # Handle basic JSON-serializable types directly
    if isinstance(obj, (str, int, float, bool)):
        return obj

    # For complex objects, only convert specific problematic types
    # Avoid expensive __dict__ conversion and JSON testing
    if hasattr(obj, "isoformat"):  # datetime-like objects
        return obj.isoformat()

    # Convert to string for other complex objects
    return str(obj)


def serialize_response(func):
    """Decorator to ensure all responses are properly serialized for JSON-RPC."""

    @functools.wraps(func)
    def wrapper(*args, **kwargs):
        result = func(*args, **kwargs)
        return serialize_object(result)

    return wrapper
