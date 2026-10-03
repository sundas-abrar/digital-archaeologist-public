"""
Run from the backend/ folder:   python -m unittest discover -s tests -v

Uses only the standard library. The scanners run for real against a tiny
throwaway project; only the Groq client is stubbed, so no key or network
is needed.
"""

from __future__ import annotations

import json
import tempfile
import unittest
from pathlib import Path
from types import SimpleNamespace
from unittest import mock

from app.services import agent_runner, ai_interpreter, ask_service
from app.services.memory import clean_history, parse_history


def make_project(root: Path) -> None:
    (root / "src").mkdir()
    (root / "src" / "ledger.py").write_text(
        "# TODO: fix rounding\n# FIXME: drift\n# TODO: handle cents\n# TODO: tests\n"
        "def total(items):\n    return sum(items)\n\n"
        "class Ledger:\n    def add(self, x):\n        pass\n"
    )
    (root / "src" / "auth.py").write_text("def login(user):\n    return True\n")
    (root / "README.md").write_text("# Legacy ledger\n")


class FakeGroq:
    """Mimics client.chat.completions.create(...) and records the call."""

    def __init__(self, content: str):
        self.content = content
        self.calls: list[dict] = []
        self.chat = SimpleNamespace(completions=SimpleNamespace(create=self._create))

    def _create(self, **kwargs):
        self.calls.append(kwargs)
        msg = SimpleNamespace(content=self.content)
        return SimpleNamespace(choices=[SimpleNamespace(message=msg)])


class MemoryTests(unittest.TestCase):
    def test_limits_per_mode(self):
        items = [f"goal {i}" for i in range(20)]
        self.assertEqual(clean_history(items, "off"), [])
        self.assertEqual(clean_history(items, "half"), ["goal 17", "goal 18", "goal 19"])
        self.assertEqual(len(clean_history(items, "full")), 10)
        self.assertEqual(clean_history(items, "full")[-1], "goal 19")

    def test_unknown_mode_is_treated_as_off(self):
        self.assertEqual(clean_history(["a"], "everything"), [])

    def test_cleaning(self):
        out = clean_history(["  spaced \n\n out  ", 42, None, "", "x" * 1000], "full")
        self.assertEqual(out[0], "spaced out")
        self.assertEqual(len(out), 2)
        self.assertEqual(len(out[1]), 300)

    def test_not_a_list(self):
        self.assertEqual(clean_history("nope", "full"), [])

    def test_parse_history(self):
        self.assertEqual(parse_history(json.dumps(["a", "b"]), "half"), ["a", "b"])
        self.assertEqual(parse_history("{not json", "full"), [])
        self.assertEqual(parse_history(json.dumps(["a"]), "off"), [])
        self.assertEqual(parse_history(None, "full"), [])


class InterpreterPayloadTests(unittest.TestCase):
    def test_no_context_is_unchanged(self):
        ev = {"a": 1}
        self.assertEqual(ai_interpreter._user_payload(ev, None, None), json.dumps(ev))

    def test_context_is_added_separately_from_evidence(self):
        payload = json.loads(ai_interpreter._user_payload({"a": 1}, "find drift", ["earlier"]))
        self.assertEqual(payload["a"], 1)
        self.assertEqual(payload["investigator_context"]["goal"], "find drift")
        self.assertEqual(payload["investigator_context"]["earlier_requests"], ["earlier"])


class AgentRunnerTests(unittest.TestCase):
    def setUp(self):
        self.tmp = tempfile.TemporaryDirectory()
        self.root = Path(self.tmp.name)
        make_project(self.root)

    def tearDown(self):
        self.tmp.cleanup()

    def test_half_run_skips_test_and_interpret(self):
        with mock.patch.object(agent_runner, "interpret_project", side_effect=AssertionError("AI called")), \
             mock.patch.object(agent_runner, "detect_test_commands", side_effect=AssertionError("tests detected")), \
             mock.patch.object(agent_runner, "run_command", side_effect=AssertionError("code executed")):
            events = list(agent_runner.run_agent(self.root, "why drift", depth="half", history=["x"]))

        status = {e["step"]: e["status"] for e in events if e["status"] != "running"}
        self.assertEqual(status["test"], "skipped")
        self.assertEqual(status["interpret"], "skipped")
        self.assertEqual(status["scan"], "done")
        self.assertEqual(status["relationships"], "done")
        self.assertEqual(events[-1]["step"], "report")
        self.assertEqual(events[-1]["data"]["depth"], "half")
        self.assertFalse(events[-1]["data"]["interpretation"]["available"])
        self.assertIn("Half run", events[0]["detail"])
        self.assertIn("1 remembered", events[0]["detail"])

    def test_full_run_passes_goal_and_history_to_interpreter(self):
        fake = mock.Mock(return_value={"available": True, "narrative": "story"})
        with mock.patch.object(agent_runner, "interpret_project", fake):
            events = list(agent_runner.run_agent(self.root, "why drift", depth="full", history=["a", "b"]))

        fake.assert_called_once()
        self.assertEqual(fake.call_args.kwargs["goal"], "why drift")
        self.assertEqual(fake.call_args.kwargs["history"], ["a", "b"])
        done = {e["step"]: e["status"] for e in events if e["status"] != "running"}
        self.assertEqual(done["interpret"], "done")
        self.assertEqual(events[-1]["data"]["depth"], "full")
        self.assertEqual(events[-1]["data"]["memory_items_used"], 2)

    def test_defaults_match_old_behaviour(self):
        with mock.patch.object(agent_runner, "interpret_project", return_value={"available": False, "error": "no key"}) as m:
            events = list(agent_runner.run_agent(self.root, "goal"))
        self.assertEqual(m.call_args.kwargs["history"], [])
        self.assertEqual(events[-1]["data"]["depth"], "full")


class AskServiceTests(unittest.TestCase):
    def setUp(self):
        self.tmp = tempfile.TemporaryDirectory()
        self.root = Path(self.tmp.name)
        make_project(self.root)
        ask_service._CACHE.clear()
        self.context, self.allowed = ask_service.get_context("s1", self.root)

    def tearDown(self):
        self.tmp.cleanup()

    def test_context_has_real_files_and_is_cached(self):
        paths = [f["path"] for f in self.context["top_files"]]
        self.assertIn("src/ledger.py", paths)
        self.assertEqual(self.context["top_files"][0]["path"], "src/ledger.py")  # most significant first
        self.assertIn("src/ledger.py", self.allowed)
        self.assertIs(ask_service.get_context("s1", self.root)[0], self.context)

    def test_hotspot_evidence_with_line_numbers_allows_bare_path(self):
        allowed = ask_service.allowed_sources(
            {"findings": [{"evidence": ["src/ledger.py:3"]}], "top_files": [], "commits": []}
        )
        self.assertIn("src/ledger.py:3", allowed)
        self.assertIn("src/ledger.py", allowed)

    def test_fabricated_sources_are_dropped(self):
        fake = FakeGroq(json.dumps({
            "answer": "Rounding is late.",
            "sources": ["src/ledger.py", "src/does_not_exist.py", "src/ledger.py", 7],
        }))
        with mock.patch.object(ask_service, "_client", return_value=fake):
            out = ask_service.answer_question(self.context, self.allowed, "why drift?", ["earlier q"])
        self.assertEqual(out["sources"], ["src/ledger.py"])
        self.assertEqual(out["answer"], "Rounding is late.")
        self.assertEqual(out["memory_items_used"], 1)

        sent = json.loads(fake.calls[0]["messages"][1]["content"])
        self.assertEqual(sent["question"], "why drift?")
        self.assertEqual(sent["earlier_requests"], ["earlier q"])
        self.assertIn("top_files", sent["evidence"])

    def test_no_key_and_no_package_are_unavailable(self):
        for sentinel in ("no_key", "no_package"):
            with mock.patch.object(ask_service, "_client", return_value=sentinel):
                with self.assertRaises(ask_service.AskUnavailable):
                    ask_service.answer_question(self.context, self.allowed, "q", [])

    def test_bad_model_output_is_a_failure(self):
        for content in ("not json", json.dumps({"answer": ""}), json.dumps({"nope": 1}), json.dumps([1])):
            with mock.patch.object(ask_service, "_client", return_value=FakeGroq(content)):
                with self.assertRaises(ask_service.AskFailed, msg=content):
                    ask_service.answer_question(self.context, self.allowed, "q", [])

    def test_api_error_is_a_failure(self):
        boom = FakeGroq("{}")
        boom.chat.completions.create = mock.Mock(side_effect=RuntimeError("rate limited"))
        with mock.patch.object(ask_service, "_client", return_value=boom):
            with self.assertRaises(ask_service.AskFailed) as cm:
                ask_service.answer_question(self.context, self.allowed, "q", [])
        self.assertIn("rate limited", str(cm.exception))

    def test_cache_is_bounded(self):
        for i in range(ask_service._CACHE_SIZE + 3):
            ask_service.get_context(f"sess{i}", self.root)
        self.assertEqual(len(ask_service._CACHE), ask_service._CACHE_SIZE)


if __name__ == "__main__":
    unittest.main()
