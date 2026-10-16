"""Offline protocol/error regressions for the live browser helper."""
import importlib.machinery
import importlib.util
from pathlib import Path
import struct
import os
import subprocess
import sys
import unittest
from unittest.mock import Mock, patch

loader = importlib.machinery.SourceFileLoader("page_browser", str(Path(__file__).with_name("rakazo-page-browser")))
spec = importlib.util.spec_from_loader(loader.name, loader)
helper = importlib.util.module_from_spec(spec)
loader.exec_module(helper)


class PageBrowserTest(unittest.TestCase):
    def test_closed_stdin_cancels_helper_without_a_browser(self):
        with subprocess.Popen([sys.executable, str(Path(__file__).with_name("rakazo-page-browser")), "snapshot", "{}"],
                              env={**os.environ, "RAKAZO_BROWSER_WATCH_STDIN": "1", "RAKAZO_CDP_PORT": "0"},
                              stdin=subprocess.PIPE, stdout=subprocess.PIPE, stderr=subprocess.PIPE) as process:
            process.stdin.close()
            self.assertEqual(process.wait(timeout=3), 130)

    def test_closed_extended_frame_does_not_spin(self):
        for partial in (b"\x81\x7e", b"\x81\x7f", b"\x81\x80"):
            with self.subTest(partial=partial):
                client = helper.CdpClient("ws://127.0.0.1:9222/test")
                client._sock = Mock()
                client._sock.recv.return_value = b""
                client._buf.extend(partial)
                with self.assertRaisesRegex(RuntimeError, "closed"):
                    client._read_frame()

    def test_bounds_frame_before_reading_payload(self):
        client = helper.CdpClient("ws://127.0.0.1:9222/test")
        client._sock = Mock()
        client._buf.extend(b"\x81\x7f" + struct.pack("!Q", 10_000_000))
        with self.assertRaisesRegex(RuntimeError, "too large"):
            client._read_frame()
        client._sock.recv.assert_not_called()

    def test_rejects_url_credentials_before_navigation(self):
        client = Mock()
        for url in ("http://example:fake-password@example.test", "https://example:fake-password@example.test"):
            with self.assertRaisesRegex(RuntimeError, "credentials"):
                helper.navigate(client, "session", url)
        client.call.assert_not_called()

    def test_rejects_navigation_error(self):
        client = Mock()
        client.call.return_value = {"errorText": "net::ERR_NAME_NOT_RESOLVED"}
        with self.assertRaisesRegex(RuntimeError, "ERR_NAME_NOT_RESOLVED"):
            helper.navigate(client, "session", "https://example.test")

    def test_preserves_completed_actions_when_next_response_is_lost(self):
        with patch.object(helper, "ensure_helpers"), patch.object(helper, "eval_json") as evaluate:
            evaluate.side_effect = [True, {}, True, TimeoutError("lost response")]
            result = helper.act(Mock(), "session", [
                {"kind": "click", "ref": "first"}, {"kind": "click", "ref": "second"},
            ])
        self.assertEqual(result["completed"], 1)
        self.assertTrue(result["uncertain"])
        self.assertFalse(result["ok"])

    def test_rejects_missing_text_before_any_action(self):
        with patch.object(helper, "ensure_helpers") as ensure:
            with self.assertRaisesRegex(RuntimeError, "Text"):
                helper.act(Mock(), "session", [{"kind": "fill", "ref": "first"}])
            ensure.assert_not_called()

    def test_binds_saved_login_fill_to_its_origin_in_the_same_evaluation(self):
        with patch.object(helper, "ensure_helpers"), patch.object(helper, "snapshot", return_value={"ok": True}), \
                patch.object(helper, "eval_json") as evaluate:
            evaluate.side_effect = [True, {}]
            helper.act(Mock(), "session", [
                {"kind": "fill", "ref": "e1", "text": "fake-password", "origin": "https://login.example.test"},
            ])
        self.assertEqual(
            evaluate.call_args_list[1].args[2],
            'window.__rakazoPageBrowser.fill("e1", "fake-password", "https://login.example.test")',
        )

    def test_rejects_origin_outside_fill_before_any_action(self):
        with patch.object(helper, "ensure_helpers") as ensure:
            with self.assertRaisesRegex(RuntimeError, "origin"):
                helper.act(Mock(), "session", [
                    {"kind": "type", "ref": "e1", "text": "x", "origin": "https://login.example.test"},
                ])
            ensure.assert_not_called()

    def test_reads_arguments_from_one_stdin_line_only(self):
        payload = b'{"actions": []}\nrest'
        with patch.object(helper.os, "read", side_effect=[payload[i:i + 1] for i in range(len(payload))]) as read:
            self.assertEqual(helper.read_stdin_line(), '{"actions": []}')
        self.assertEqual(read.call_count, len(b'{"actions": []}\n'))

    def test_discovery_cannot_leave_loopback_endpoint(self):
        with patch.object(helper, "http_get_json", return_value={"webSocketDebuggerUrl": "ws://example.test:9222/session"}):
            with self.assertRaisesRegex(RuntimeError, "Unexpected CDP"):
                helper.discover_ws_url(9222)

    def test_ensure_world_reuses_named_isolated_context(self):
        client = helper.CdpClient("ws://127.0.0.1:9222/test")
        calls = []

        def fake_call(method, params=None, *, session_id=None, timeout_s=30.0):
            calls.append(method)
            if method == "Page.getFrameTree":
                return {"frameTree": {"frame": {"id": "frame-1"}}}
            if method == "Runtime.enable":
                client._handle_event({
                    "method": "Runtime.executionContextCreated",
                    "sessionId": session_id,
                    "params": {
                        "context": {
                            "id": 42,
                            "name": helper.WORLD_NAME,
                            "auxData": {"frameId": "frame-1", "isDefault": False},
                        }
                    },
                })
                return {}
            raise AssertionError(f"unexpected CDP call: {method}")

        client.call = fake_call  # type: ignore[method-assign]
        helper.ensure_world(client, "session-a")
        self.assertEqual(client.context_id, 42)
        self.assertNotIn("Page.createIsolatedWorld", calls)

    def test_context_lookup_rejects_default_foreign_and_unbound_contexts(self):
        client = helper.CdpClient("ws://127.0.0.1:9222/test")
        for aux, session in (({"frameId": "frame-1", "isDefault": True}, "session-a"),
                             ({"frameId": "other-frame", "isDefault": False}, "session-a"),
                             ({"frameId": "frame-1", "isDefault": False}, "session-b"),
                             ({}, "session-a")):
            client._handle_event({"method": "Runtime.executionContextCreated", "sessionId": session,
                                  "params": {"context": {"id": 42, "name": helper.WORLD_NAME, "auxData": aux}}})
            self.assertIsNone(client.find_world_context(helper.WORLD_NAME, "frame-1", "session-a"))

    def test_ensure_world_creates_when_missing(self):
        client = helper.CdpClient("ws://127.0.0.1:9222/test")

        def fake_call(method, params=None, *, session_id=None, timeout_s=30.0):
            if method == "Page.getFrameTree":
                return {"frameTree": {"frame": {"id": "frame-1"}}}
            if method == "Runtime.enable":
                return {}
            if method == "Page.createIsolatedWorld":
                self.assertEqual(params["worldName"], helper.WORLD_NAME)
                return {"executionContextId": 7}
            raise AssertionError(f"unexpected CDP call: {method}")

    def test_navigate_detects_http_400_bad_request(self):
        client = Mock()
        client.call.side_effect = [
            {"loaderId": "loader-1", "frameId": "frame-1"},  # Page.navigate
            {"frameTree": {"frame": {"id": "frame-1", "loaderId": "loader-1"}}},  # Page.getFrameTree
        ]
        with patch.object(helper, "ensure_world"), patch.object(helper, "eval_json") as evaluate:
            evaluate.side_effect = [
                "complete",  # readyState
                {"url": "https://accounts.example.test/signin", "title": "Error 400 (Bad Request)!!1", "httpStatus": 400},
            ]
            res = helper.navigate(client, "session", "https://accounts.example.test/signin")
            self.assertFalse(res["ok"])
            self.assertEqual(res["httpStatus"], 400)
            self.assertEqual(res["title"], "Error 400 (Bad Request)!!1")
            self.assertEqual(res["fallback"], "computer_act")

    def test_navigate_returns_success_for_http_200(self):
        client = Mock()
        client.call.side_effect = [
            {"loaderId": "loader-1", "frameId": "frame-1"},  # Page.navigate
            {"frameTree": {"frame": {"id": "frame-1", "loaderId": "loader-1"}}},  # Page.getFrameTree
        ]
        with patch.object(helper, "ensure_world"), patch.object(helper, "eval_json") as evaluate:
            evaluate.side_effect = [
                "complete",  # readyState
                {"url": "https://accounts.example.test/signin", "title": "Sign in - Google Accounts", "httpStatus": 200},
            ]
            res = helper.navigate(client, "session", "https://accounts.example.test/signin")
            self.assertTrue(res["ok"])
            self.assertEqual(res["httpStatus"], 200)
            self.assertEqual(res["httpStatusStatus"], "known")
            self.assertEqual(res["title"], "Sign in - Google Accounts")

    def test_navigate_never_fabricates_200_when_status_is_missing(self):
        client = Mock()
        client.call.side_effect = [
            {"loaderId": "loader-1", "frameId": "frame-1"},
            {"frameTree": {"frame": {"id": "frame-1", "loaderId": "loader-1"}}},
        ]
        with patch.object(helper, "ensure_world"), patch.object(helper, "eval_json") as evaluate:
            evaluate.side_effect = [
                "complete",
                {"url": "https://example.test/app", "title": "App", "httpStatus": None},
            ]
            res = helper.navigate(client, "session", "https://example.test/app")
            self.assertTrue(res["ok"])
            self.assertEqual(res["httpStatusStatus"], "unknown")
            self.assertNotIn("httpStatus", res)

    def test_navigate_detects_200_challenge_page_and_ignores_subresource_403(self):
        client = helper.CdpClient("ws://127.0.0.1:9222/test")
        client._handle_event(
            {
                "sessionId": "session-1",
                "method": "Network.responseReceived",
                "params": {
                    "requestId": "req-sub-1",
                    "loaderId": "loader-1",
                    "frameId": "frame-1",
                    "type": "XHR",
                    "response": {"url": "https://example.test/api/sub", "status": 403, "headers": {}},
                },
            }
        )
        client._handle_event(
            {
                "sessionId": "session-1",
                "method": "Network.responseReceived",
                "params": {
                    "requestId": "req-doc-1",
                    "loaderId": "loader-1",
                    "frameId": "frame-1",
                    "type": "Document",
                    "response": {"url": "https://example.test/home", "status": 200, "headers": {}},
                },
            }
        )
        with patch.object(
            client,
            "call",
            side_effect=[
                {"loaderId": "loader-1", "frameId": "frame-1"},
                {"frameTree": {"frame": {"id": "frame-1", "loaderId": "loader-1"}}},
            ],
        ), patch.object(helper, "ensure_world"), patch.object(helper, "eval_json") as evaluate:
            evaluate.side_effect = [
                "complete",
                {"url": "https://example.test/home", "title": "Home", "httpStatus": None},
            ]
            ok_res = helper.navigate(client, "session-1", "https://example.test/home")
            self.assertTrue(ok_res["ok"])
            self.assertEqual(ok_res["httpStatus"], 200)

        with patch.object(
            client,
            "call",
            side_effect=[
                {"loaderId": "loader-1", "frameId": "frame-1"},
                {"frameTree": {"frame": {"id": "frame-1", "loaderId": "loader-1"}}},
            ],
        ), patch.object(helper, "ensure_world"), patch.object(helper, "eval_json") as evaluate:
            evaluate.side_effect = [
                "complete",
                {
                    "url": "https://example.test/home",
                    "title": "Just a moment...",
                    "bodySnippet": "Verify you are human",
                    "hasChallengeDom": True,
                    "httpStatus": 200,
                },
            ]
            chal_res = helper.navigate(client, "session-1", "https://example.test/home")
            self.assertFalse(chal_res["ok"])
            self.assertEqual(chal_res["httpStatus"], 200)
            self.assertTrue(chal_res["challengeDetected"])

    def test_navigate_captures_429_retry_after_and_redirect_chain(self):
        client = helper.CdpClient("ws://127.0.0.1:9222/test")
        client._handle_event(
            {
                "sessionId": "session-1",
                "method": "Network.requestWillBeSent",
                "params": {
                    "requestId": "req-1",
                    "loaderId": "loader-2",
                    "frameId": "frame-1",
                    "type": "Document",
                    "request": {"url": "https://example.test/start"},
                },
            }
        )
        client._handle_event(
            {
                "sessionId": "session-1",
                "method": "Network.requestWillBeSent",
                "params": {
                    "requestId": "req-1",
                    "loaderId": "loader-2",
                    "frameId": "frame-1",
                    "type": "Document",
                    "request": {"url": "https://example.test/rate-limited"},
                    "redirectResponse": {"url": "https://example.test/start", "status": 302},
                },
            }
        )
        client._handle_event(
            {
                "sessionId": "session-1",
                "method": "Network.responseReceived",
                "params": {
                    "requestId": "req-1",
                    "loaderId": "loader-2",
                    "frameId": "frame-1",
                    "type": "Document",
                    "response": {
                        "url": "https://example.test/rate-limited",
                        "status": 429,
                        "headers": {"Retry-After": "7"},
                    },
                },
            }
        )
        with patch.object(
            client,
            "call",
            side_effect=[
                {"loaderId": "loader-2", "frameId": "frame-1"},
                {"frameTree": {"frame": {"id": "frame-1", "loaderId": "loader-2"}}},
            ],
        ), patch.object(helper, "ensure_world"), patch.object(helper, "eval_json") as evaluate:
            evaluate.side_effect = [
                "complete",
                {"url": "https://example.test/rate-limited", "title": "Too Many Requests"},
            ]
            res = helper.navigate(client, "session-1", "https://example.test/start")
            self.assertFalse(res["ok"])
            self.assertEqual(res["httpStatus"], 429)
            self.assertEqual(res["retryAfterMs"], 7000)
            self.assertTrue(res["redirected"])
            self.assertEqual(
                res["redirectChain"], [{"url": "https://example.test/start", "status": 302}]
            )

    def test_clear_origin_storage_scopes_cookies_and_storage_to_target_origin(self):
        calls = []

        def fake_call(method, params=None, *, session_id=None, timeout_s=30.0):
            calls.append((method, params, session_id))
            if method == "Network.getCookies":
                return {
                    "cookies": [
                        {"name": "host_sid", "domain": "app.example.test", "path": "/"},
                        {"name": "parent_sso", "domain": ".example.test", "path": "/"},
                        {"name": "other_sid", "domain": "other.test", "path": "/"},
                    ]
                }
            if method == "Page.getFrameTree":
                return {
                    "frameTree": {
                        "frame": {
                            "id": "frame-1",
                            "securityOrigin": "https://app.example.test",
                            "url": "https://app.example.test/login",
                        }
                    }
                }
            return {}

        client = Mock()
        client.call.side_effect = fake_call

        res = helper.clear_origin_storage(
            client,
            "session-1",
            {
                "origin": "https://app.example.test",
                "includeSessionStorage": False,
                "includeSubdomainSharedCookies": False,
            },
        )
        self.assertTrue(res["ok"])
        self.assertEqual(res["origin"], "https://app.example.test")
        self.assertEqual(res["deletedCookies"], 1)
        self.assertFalse(res["clearedSessionStorage"])
        methods = [m for m, _, _ in calls]
        self.assertIn("Storage.clearDataForOrigin", methods)
        self.assertNotIn("Network.clearBrowserCookies", methods)
        self.assertNotIn("DOMStorage.clear", methods)
        deleted = [p for m, p, _ in calls if m == "Network.deleteCookies"]
        self.assertEqual(len(deleted), 1)
        self.assertEqual(deleted[0]["name"], "host_sid")

        calls.clear()
        res_with_session_and_shared = helper.clear_origin_storage(
            client,
            "session-1",
            {
                "origin": "https://app.example.test",
                "storageKey": "https://app.example.test/",
                "includeSessionStorage": True,
                "includeSubdomainSharedCookies": True,
            },
        )
        self.assertEqual(res_with_session_and_shared["deletedCookies"], 2)
        self.assertTrue(res_with_session_and_shared["clearedSessionStorage"])
        methods_2 = [m for m, _, _ in calls]
        self.assertIn("Storage.clearDataForStorageKey", methods_2)
        self.assertIn("DOMStorage.clear", methods_2)

        with self.assertRaisesRegex(ValueError, "storageType"):
            helper.clear_origin_storage(
                client,
                "session-1",
                {"origin": "https://app.example.test", "storageTypes": ["session_storage"]},
            )
        with self.assertRaisesRegex(ValueError, "storageKey"):
            helper.clear_origin_storage(
                client,
                "session-1",
                {
                    "origin": "https://app.example.test",
                    "storageKey": "https://evil.example.test/",
                },
            )


if __name__ == "__main__":
    unittest.main()

