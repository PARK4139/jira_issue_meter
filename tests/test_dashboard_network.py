"""Exercise prefixed dashboard routes and preserve host/origin validation."""
import json
import contextlib
import io
from pathlib import Path
import tempfile
import threading
import unittest
from unittest.mock import patch
from urllib.error import HTTPError
from urllib.request import Request, urlopen

import jira_inputs
from jira_credentials import Credentials
from jira_dashboard_server import DashboardServer, normalize_base_path, validate_bind_address
from jira_dashboard_cli import parse_args


class LauncherModeTests(unittest.TestCase):
    def test_default_mode_uses_the_shared_address(self):
        args = parse_args([])
        self.assertEqual((args.bind, args.port, args.base_path),
                         ('172.20.13.185', 9998, '/issue-meter/'))

    def test_local_mode_restores_loopback_and_automatic_port(self):
        args = parse_args(['--local'])
        self.assertEqual((args.bind, args.port, args.base_path), ('127.0.0.1', 0, '/'))

    def test_explicit_network_options_override_defaults_in_any_order(self):
        for argv in (['--local', '--port', '8765', '--base-path', 'custom'],
                     ['--port', '8765', '--base-path', 'custom', '--local']):
            args = parse_args(argv)
            self.assertEqual((args.bind, args.port, args.base_path), ('127.0.0.1', 8765, '/custom/'))
        args = parse_args(['--bind', '192.168.1.5', '--port', '0', '--base-path', '/'])
        self.assertEqual((args.bind, args.port, args.base_path), ('192.168.1.5', 0, '/'))

    def test_local_mode_rejects_a_non_loopback_bind(self):
        with contextlib.redirect_stderr(io.StringIO()), self.assertRaises(SystemExit) as error:
            parse_args(['--local', '--bind', '172.20.13.185'])
        self.assertEqual(error.exception.code, 2)


class NetworkDashboardTests(unittest.TestCase):
    def setUp(self):
        directory = tempfile.TemporaryDirectory()
        self.addCleanup(directory.cleanup)
        patcher = patch.object(jira_inputs, 'F_INPUTS', Path(directory.name) / 'inputs.json')
        patcher.start()
        self.addCleanup(patcher.stop)
        self.server = DashboardServer(Credentials('https://jira.invalid', 'test', 'synthetic-secret'),
                                      ['DEMO'], ['sample'], bind='127.0.0.1', base_path='/issue-meter/')
        self.thread = threading.Thread(target=self.server.serve_forever, kwargs={'poll_interval': .01}, daemon=True)
        self.thread.start()
        self.addCleanup(self.close)

    def close(self):
        self.server.shutdown()
        self.server.server_close()
        self.thread.join(timeout=2)

    def test_prefixed_page_redirects_and_uses_prefixed_api(self):
        for path in ('/', '/issue-meter', '/issue-meter/'):
            with urlopen(self.server.origin + path, timeout=3) as response:
                self.assertEqual(response.geturl(), self.server.origin + '/issue-meter/')
                html = response.read().decode('utf-8')
                self.assertIn('"basePath": "/issue-meter/"', html)
                self.assertIn('ISSUE METER', html)
                self.assertNotIn('ISSUE MEATER', html)
        with patch('jira_dashboard_server.fetch_projects', return_value=[{'key': 'DEMO', 'name': 'Demo'}]):
            request = Request(self.server.origin + '/issue-meter/api/projects', data=b'{}', headers={
                'Origin': self.server.origin, 'X-Session-Token': self.server.session,
                'Content-Type': 'application/json'})
            with urlopen(request, timeout=3) as response:
                self.assertEqual(json.load(response)['projects'][0]['key'], 'DEMO')

    def test_prefixed_api_rejects_foreign_host_origin_and_wrong_path(self):
        headers = {'Origin': self.server.origin, 'X-Session-Token': self.server.session,
                   'Content-Type': 'application/json'}
        for extra, path, expected in [({'Origin': 'http://foreign.invalid'}, '/issue-meter/api/projects', 403),
                                       ({'Host': 'foreign.invalid'}, '/issue-meter/api/projects', 403),
                                       ({}, '/api/projects', 404)]:
            request = Request(self.server.origin + path, data=b'{}', headers={**headers, **extra})
            with self.assertRaises(HTTPError) as error:
                urlopen(request, timeout=3)
            self.assertEqual(error.exception.code, expected)
            error.exception.close()

    def test_network_options_validate_concrete_address_and_base_path(self):
        self.assertEqual(validate_bind_address('172.20.13.185'), '172.20.13.185')
        self.assertEqual(normalize_base_path('issue-meter'), '/issue-meter/')
        for address in ('0.0.0.0', '::', 'not-an-address'):
            with self.assertRaises(ValueError):
                validate_bind_address(address)
        for path in ('../issue-meter', '/issue?bad', '/issue//meter/', '/%2e%2e/'):
            with self.assertRaises(ValueError):
                normalize_base_path(path)
