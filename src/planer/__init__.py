"""Вовремя — planner that keeps a plan on time.

Import is side-effect free: the server starts only via ``planer.app.main``.
"""

from importlib.metadata import PackageNotFoundError, version

try:
    __version__ = version("planer")
except PackageNotFoundError:  # running from a source tree without install
    __version__ = "0.0.0"
