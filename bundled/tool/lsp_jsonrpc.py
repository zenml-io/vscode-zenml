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

"""Light-weight JSON-RPC over standard IO."""


import atexit
import io
import json
import pathlib
import subprocess
import threading
import uuid
from concurrent.futures import ThreadPoolExecutor
from typing import cast, BinaryIO, Dict, Optional, Sequence, Union

CONTENT_LENGTH = "Content-Length: "
RUNNER_SCRIPT = str(pathlib.Path(__file__).parent / "lsp_runner.py")


def to_str(text) -> str:
    """Convert bytes to string as needed."""
    return text.decode("utf-8") if isinstance(text, bytes) else text


class StreamClosedException(Exception):
    """JSON RPC stream is closed."""

    pass  # pylint: disable=unnecessary-pass


class JsonWriter:
    """Manages writing JSON-RPC messages to the writer stream."""

    def __init__(self, writer: io.TextIOWrapper):
        self._writer = writer
        self._lock = threading.Lock()

    def close(self):
        """Closes the underlying writer stream."""
        with self._lock:
            if not self._writer.closed:
                self._writer.close()

    def write(self, data):
        """Writes given data to stream in JSON-RPC format."""
        if self._writer.closed:
            raise StreamClosedException()

        with self._lock:
            content = json.dumps(data)
            length = len(content.encode("utf-8"))
            self._writer.write(f"{CONTENT_LENGTH}{length}\r\n\r\n{content}")
            # self._writer.write(
            #     f"{CONTENT_LENGTH}{length}\r\n\r\n{content}".encode("utf-8")
            # )
            self._writer.flush()


class JsonReader:
    """Manages reading JSON-RPC messages from stream."""

    def __init__(self, reader: io.TextIOWrapper):
        self._reader = reader

    def close(self):
        """Closes the underlying reader stream."""
        if not self._reader.closed:
            self._reader.close()

    def read(self):
        """Reads data from the stream in JSON-RPC format."""
        if self._reader.closed:
            raise StreamClosedException
        length = None
        while not length:
            line = to_str(self._readline())
            if line.startswith(CONTENT_LENGTH):
                length = int(line[len(CONTENT_LENGTH) :])

        line = to_str(self._readline()).strip()
        while line:
            line = to_str(self._readline()).strip()

        content = to_str(self._reader.read(length))
        return json.loads(content)

    def _readline(self):
        line = self._reader.readline()
        if not line:
            raise EOFError
        return line


class JsonRpc:
    """Manages sending and receiving data over JSON-RPC."""

    def __init__(self, reader: io.TextIOWrapper, writer: io.TextIOWrapper):
        self._reader = JsonReader(reader)
        self._writer = JsonWriter(writer)

    def close(self):
        """Closes the underlying streams."""
        try:
            self._reader.close()
        except:  # noqa: E722 # pylint: disable=bare-except
            pass
        try:
            self._writer.close()
        except:  # noqa: E722 # pylint: disable=bare-except
            pass

    def send_data(self, data):
        """Send given data in JSON-RPC format."""
        self._writer.write(data)

    def receive_data(self):
        """Receive data in JSON-RPC format."""
        return self._reader.read()


def create_json_rpc(readable: BinaryIO, writable: BinaryIO) -> JsonRpc:
    """Creates JSON-RPC wrapper for the readable and writable streams."""
    text_readable = io.TextIOWrapper(readable, encoding="utf-8")
    text_writable = io.TextIOWrapper(writable, encoding="utf-8")
    return JsonRpc(text_readable, text_writable)


class ProcessManager:
    """Manages sub-processes launched for running tools."""

    def __init__(self):
        self._args: Dict[str, Sequence[str]] = {}
        self._processes: Dict[str, subprocess.Popen] = {}
        self._rpc: Dict[str, JsonRpc] = {}
        self._lock = threading.Lock()
        self._thread_pool = ThreadPoolExecutor(10)

    def stop_all_processes(self):
        """Send exit command to all processes and shutdown transport."""
        for i in self._rpc.values():
            try:
                i.send_data({"id": str(uuid.uuid4()), "method": "exit"})
            except:  # noqa: E722 # pylint: disable=bare-except
                pass
        self._thread_pool.shutdown(wait=False)

    def start_process(self, workspace: str, args: Sequence[str], cwd: str) -> None:
        """Starts a process and establishes JSON-RPC communication over stdio."""
        # pylint: disable=consider-using-with
        proc = subprocess.Popen(
            args,
            cwd=cwd,
            stdout=subprocess.PIPE,
            stdin=subprocess.PIPE,
        )

        # Use cast to assure mypy that stdout and stdin are not None
        stdout = cast(BinaryIO, proc.stdout)
        stdin = cast(BinaryIO, proc.stdin)

        self._processes[workspace] = proc
        self._rpc[workspace] = create_json_rpc(stdout, stdin)

        def _monitor_process():
            proc.wait()
            with self._lock:
                try:
                    del self._processes[workspace]
                    rpc = self._rpc.pop(workspace)
                    rpc.close()
                except:  # noqa: E722 # pylint: disable=bare-except
                    pass

        self._thread_pool.submit(_monitor_process)

    def get_json_rpc(self, workspace: str) -> JsonRpc:
        """Gets the JSON-RPC wrapper for the a given id."""
        with self._lock:
            if workspace in self._rpc:
                return self._rpc[workspace]
        raise StreamClosedException()


_process_manager = ProcessManager()
atexit.register(_process_manager.stop_all_processes)


def _get_json_rpc(workspace: str) -> Union[JsonRpc, None]:
    try:
        return _process_manager.get_json_rpc(workspace)
    except StreamClosedException:
        return None
    except KeyError:
        return None


def get_or_start_json_rpc(
    workspace: str, interpreter: Sequence[str], cwd: str
) -> Union[JsonRpc, None]:
    """Gets an existing JSON-RPC connection or starts one and return it."""
    res = _get_json_rpc(workspace)
    if not res:
        args = [*interpreter, RUNNER_SCRIPT]
        _process_manager.start_process(workspace, args, cwd)
        res = _get_json_rpc(workspace)
    return res


class RpcRunResult:
    """Object to hold result from running tool over RPC."""

    def __init__(self, stdout: str, stderr: str, exception: Optional[str] = None):
        self.stdout: str = stdout
        self.stderr: str = stderr
        self.exception: Optional[str] = exception


# pylint: disable=too-many-arguments
def run_over_json_rpc(
    workspace: str,
    interpreter: Sequence[str],
    module: str,
    argv: Sequence[str],
    use_stdin: bool,
    cwd: str,
    source: Optional[str] = None,
) -> RpcRunResult:
    """Uses JSON-RPC to execute a command."""
    rpc: Union[JsonRpc, None] = get_or_start_json_rpc(workspace, interpreter, cwd)
    if not rpc:
        # pylint: disable=broad-exception-raised
        raise Exception("Failed to run over JSON-RPC.")

    msg_id = str(uuid.uuid4())
    msg = {
        "id": msg_id,
        "method": "run",
        "module": module,
        "argv": argv,
        "useStdin": use_stdin,
        "cwd": cwd,
    }
    if source:
        msg["source"] = source

    rpc.send_data(msg)

    data = rpc.receive_data()

    if data["id"] != msg_id:
        return RpcRunResult(
            "", f"Invalid result for request: {json.dumps(msg, indent=4)}"
        )

    result = data["result"] if "result" in data else ""
    if "error" in data:
        error = data["error"]

        if data.get("exception", False):
            return RpcRunResult(result, "", error)
        return RpcRunResult(result, error)

    return RpcRunResult(result, "")


def shutdown_json_rpc():
    """Shutdown all JSON-RPC processes."""
    _process_manager.stop_all_processes()
