"""Local-only synthetic dashboard for browser checks; no Jira requests."""
from unittest.mock import patch
import argparse
from jira_credentials import Credentials
from datetime import date, timedelta
import jira_dashboard_server
import jira_inputs
from jira_web import DashboardServer
from pathlib import Path
from jira_periods import period_ranges
import time


USERS = [{"name": "sample", "displayName": "Sample User"}, {"name": "fail", "displayName": "Fail User"},
         {"name": "parkjh", "displayName": "박정훈"}, {"name": "kimsh", "displayName": "김선희"}]


def find_project(credentials, key):
    if key == "LHUB":
        return {"key": "LHUB", "name": "L-HUB"}
    raise RuntimeError("Jira HTTP 404: Request rejected")


def search_users(credentials, query):
    needle = query.strip().casefold()
    return [user for user in USERS if needle in user["name"].casefold() or needle in user["displayName"].casefold()]


def collect(projects, year, reporters, credentials):
    if reporters == ["fail"]:
        raise RuntimeError("Synthetic query failure")
    start = date(year, 1, 1)
    records = [(project, start + timedelta(days=day), start + timedelta(days=day + 3) if day % 3 else None)
               for project in projects for day in range(0, 360, 2)]
    return records, 1


def unresolved_snapshots(projects, year, reporters, credentials, period):
    time.sleep(.5)  # Exercise the visible loading state before a history response arrives.
    return {project: [dict(row, unresolved=index+1, queries={'unresolved':'synthetic unresolved query'})
                      for index, row in enumerate(period_ranges(year, period))] for project in projects}, 1


if __name__ == "__main__":
    parser = argparse.ArgumentParser()
    parser.add_argument('--port', type=int, default=0)
    args = parser.parse_args()
    output_dir = Path('.local/ui-verification/fixture-outputs').resolve()
    inputs_file = Path('.local/ui-verification/fixture-inputs.json').resolve()
    with patch.object(jira_inputs, "F_INPUTS", inputs_file), patch("jira_dashboard_server.D_OUTPUTS", output_dir), patch("jira_dashboard_server.reveal_output"), patch(
            "jira_dashboard_service.fetch_year_issues", side_effect=collect), patch(
            "jira_dashboard_service.count_unresolved_at_period_ends", side_effect=unresolved_snapshots), patch(
            "jira_dashboard_server.fetch_projects", return_value=[
                {"key": "DEMO", "name": "Demo team"}, {"key": "HTG", "name": "Hotel group"},
                {"key": "OTHER", "name": "Platform team"}]), patch(
            "jira_dashboard_server.fetch_project", side_effect=find_project), patch(
            "jira_dashboard_server.search_reporters", side_effect=search_users), DashboardServer(
            Credentials("https://jira.invalid", "synthetic-user", "synthetic-secret"),
            ["DEMO"], ["sample"], port=args.port) as server:
        print(server.origin, flush=True)
        server.serve_forever()
