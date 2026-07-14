"""Shared logging utilities for the Boss Nodes ComfyUI custom node pack.

This module contains a factory function for creating prefixed loggers
that were previously defined as inline `_log()` functions in each node module.

Functions:
    make_logger(prefix) -- Create a prefixed print-based logger
"""


def make_logger(prefix: str):
    """Create a prefixed print-based logger.

    Args:
        prefix: The prefix to use in log messages (e.g. "SceneMakerPro")

    Returns:
        A callable that prints messages with the given prefix.

    Example:
        >>> _log = make_logger("SceneMakerPro")
        >>> _log("Loading library")
        [SceneMakerPro] Loading library
    """
    def _log(msg: str) -> None:
        print(f"[{prefix}] {msg}")
    return _log
