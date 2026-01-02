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

"""Constants for ZenML Tool"""

TOOL_MODULE_NAME = "zenml-python"
TOOL_DISPLAY_NAME = "ZenML"
MIN_ZENML_VERSION = "0.63.0"

"""Constants for ZenML Notifications and Events"""

IS_ZENML_INSTALLED = "zenml/isInstalled"
ZENML_CLIENT_INITIALIZED = "zenml/clientInitialized"
ZENML_SERVER_CHANGED = "zenml/serverChanged"
ZENML_STACK_CHANGED = "zenml/stackChanged"
ZENML_REQUIREMENTS_NOT_MET = "zenml/requirementsNotMet"
