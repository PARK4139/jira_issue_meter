"""Local dashboard request and exception evidence; never records request bodies."""
from datetime import datetime, timezone
import json
import traceback

from jira_audit import RUN_ID
from jira_paths import D_LOGS

F_DASHBOARD_LOG = D_LOGS / "dashboard.jsonl"


def _append(entry):
    try:
        D_LOGS.mkdir(parents=True, exist_ok=True)
        with F_DASHBOARD_LOG.open("a", encoding="utf-8", newline="\n") as stream:
            stream.write(json.dumps(entry, ensure_ascii=False) + "\n")
    except OSError:
        pass  # Diagnostics must never interrupt the dashboard.


def record_response(method: str, path: str, status: int):
    _append({"timestamp": datetime.now(timezone.utc).isoformat(), "run_id": RUN_ID,
             "event": "http_response", "method": method, "path": path.split("?", 1)[0],
             "status": status})


def record_exception(error, credentials=None):
    details = "".join(traceback.format_exception(type(error), error, error.__traceback__))
    if credentials is not None:
        for secret in (credentials.token, credentials.email, credentials.url):
            if secret:
                details = details.replace(secret, "[REDACTED]")
    _append({"timestamp": datetime.now(timezone.utc).isoformat(), "run_id": RUN_ID,
             "event": "http_exception", "exception": type(error).__name__,
             "details": details})
