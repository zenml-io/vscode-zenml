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
"""
This script provides command-line functionality to interact with ZenML's active stack.

It allows users to either get information about the currently active stack or set a new active stack
using the ZenML client. The script outputs the results in JSON format, making it suitable for
integration with other tools or scripts.

Usage:
    python operations.py get_active_stack
    python operations.py set_active_stack <stack_name_or_id>

Arguments:
    get_active_stack: Retrieves the currently active ZenML stack, outputting its ID and name.
    set_active_stack <stack_name_or_id>: Sets a new active stack by its name or ID. Requires an additional argument specifying the stack's name or ID.

Output:
    JSON object containing either the active stack's details (`id` and `name`) upon success,
    or an `error` message detailing any issues encountered during operation.
"""

import sys
import json
from zenml.client import Client

operation = sys.argv[1]

client = Client()

if operation == "get_active_stack":
    try:
        active_stack_id = str(client.active_stack_model.id)
        active_stack_name = client.active_stack_model.name
        print(json.dumps({"id": active_stack_id, "name": active_stack_name}))
    except Exception as e:
        print(json.dumps({"error": str(e)}))

elif operation == "set_active_stack":
    stack_name_or_id = sys.argv[2]
    try:
        client.activate_stack(stack_name_id_or_prefix=stack_name_or_id)
        active_stack_id = str(client.active_stack_model.id)
        active_stack_name = client.active_stack_model.name
        print(
            json.dumps(
                {
                    "message": f"Active stack set to: {active_stack_name}",
                    "id": active_stack_id,
                    "name": active_stack_name,
                }
            )
        )
    except KeyError as err:
        print(json.dumps({"error": str(err)}))
