"""trace.py — in-memory decision trace. No database in v1.

A plain dict capped at 500 entries, eviction oldest-first, keyed by
trace_id. Enough for a one-day demo; replace with real storage if this ever
needs to survive a restart.
"""

from __future__ import annotations

import itertools
import time
from collections import OrderedDict
from typing import Any

_MAX_ENTRIES = 500
_traces: OrderedDict[str, dict[str, Any]] = OrderedDict()
_counter = itertools.count()


def new_trace_id() -> str:
    return f"t_{next(_counter):x}"


def record(trace_id: str, **fields: Any) -> None:
    _traces[trace_id] = {"ts": time.time(), **fields}
    _traces.move_to_end(trace_id)
    while len(_traces) > _MAX_ENTRIES:
        _traces.popitem(last=False)


def get(trace_id: str) -> dict[str, Any] | None:
    return _traces.get(trace_id)
