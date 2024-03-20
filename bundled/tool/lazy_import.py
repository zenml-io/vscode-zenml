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
This module provides utilities designed to facilitate lazy importing of Python modules and classes.
It includes features for suppressing standard output (stdout) and standard error (stderr) temporarily.
The suppression of stdout and stderr is implemented via context managers, ensuring that the original 
state is restored once the operation is complete.
"""
import importlib
import logging
import os
import sys
from contextlib import contextmanager


@contextmanager
def suppress_logging_temporarily(level=logging.ERROR):
    """
    Temporarily elevates logging level and suppresses stdout to minimize console output.

    Parameters:
        level (int): Temporary logging level (default: ERROR).

    Yields:
        None: While suppressing stdout.
    """
    original_level = logging.root.level
    original_stdout = sys.stdout
    logging.root.setLevel(level)
    with open(os.devnull, "w") as fnull:
        sys.stdout = fnull
        try:
            yield
        finally:
            sys.stdout = original_stdout
            logging.root.setLevel(original_level)


@contextmanager
def suppress_stdout_stderr():
    """
    This context manager suppresses stdout and stderr for LSP commands,
    silencing unnecessary or unwanted output during execution.

    Yields:
        None: While suppressing stdout and stderr.
    """
    with open(os.devnull, "w") as fnull:
        original_stdout = sys.stdout
        original_stderr = sys.stderr
        sys.stdout = fnull
        sys.stderr = fnull
        try:
            yield
        finally:
            sys.stdout = original_stdout
            sys.stderr = original_stderr


def lazy_import(module_name, class_name=None):
    """
    Lazily imports a module or class, suppressing ZenML log output
    to minimize initialization time and noise.

    Args:
        module_name (str): The name of the module to import.
        class_name (str, optional): The class name within the module. Defaults to None.

    Returns:
        The imported module or class.
    """
    with suppress_logging_temporarily():
        module = importlib.import_module(module_name)
        if class_name:
            return getattr(module, class_name)
        return module
