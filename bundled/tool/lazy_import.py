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
Utilities for lazy importing of modules and classes, 
with an option to suppress stdout temporarily.
"""
import sys
import os
import importlib
from contextlib import contextmanager


@contextmanager
def suppress_stdout_temporarily():
    """Suppress stdout temporarily."""
    original_stdout = sys.stdout
    try:
        with open(os.devnull, "w", encoding="utf-8") as devnull:
            sys.stdout = devnull
            yield
    finally:
        sys.stdout = original_stdout


def lazy_import(module_name, class_name=None):
    """
    Lazily import a module or class, suppressing ZenML log output temporarily.

    Args:
        module_name (str): The name of the module to import.
        class_name (str, optional): The class name within the module. Defaults to None.

    Returns:
        The imported module or class.
    """
    with suppress_stdout_temporarily():
        module = importlib.import_module(module_name)
        if class_name:
            return getattr(module, class_name)
        return module
