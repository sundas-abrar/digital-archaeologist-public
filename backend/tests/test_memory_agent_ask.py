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

import threading

from app.services import agent_runner, ai_interpreter, ask_service, memory_store
from app.services.memory import clean_history


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


class MemoryStoreTests(unittest.TestCase):
    def setUp(self):
        self.tmp = tempfile.TemporaryDirectory()
        memory_store.DB_PATH = Path(self.tmp.name) / "memory.db"

    def tearDown(self):
        memory_store.DB_PATH = None
        self.tmp.cleanup()

    def test_add_and_recall_by_mode(self):
        for i in range(12):
            memory_store.remember("s1", "full", "goal", f"goal {i}")
        self.assertEqual(memory_store.recall("s1", "off"), [])
        self.assertEqual(memory_store.recall("s1", "half"), ["goal 9", "goal 10", "goal 11"])
        full = memory_store.recall("s1", "full")
        self.assertEqual(len(full), 4)  # 1 summary + 3 most recent
        self.assertTrue(full[0].startswith("Summary of 9 earlier"))
        self.assertEqual(full[-1], "goal 11")  # oldest first, newest last

    def test_off_saves_nothing(self):
        memory_store.remember("s1", "off", "goal", "secret")
        self.assertEqual(memory_store.count("s1"), 0)

    def test_survives_a_new_connection_like_a_restart(self):
        memory_store.remember("s1", "half", "question", "who wrote auth?")
        # Nothing is held in process memory; a fresh read sees it.
        self.assertEqual(memory_store.recent("s1", 5)[0]["text"], "who wrote auth?")
        self.assertEqual(memory_store.recent("s1", 5)[0]["kind"], "question")

    def test_sessions_are_separate(self):
        memory_store.remember("a", "half", "goal", "for a")
        memory_store.remember("b", "half", "goal", "for b")
        self.assertEqual(memory_store.recall("a", "half"), ["for a"])
        self.assertEqual(memory_store.recall("b", "half"), ["for b"])

    def test_exact_repeat_is_skipped_but_other_kind_is_not(self):
        self.assertTrue(memory_store.add("s1", "goal", "same"))
        self.assertFalse(memory_store.add("s1", "goal", "same"))
        self.assertTrue(memory_store.add("s1", "question", "same"))
        self.assertTrue(memory_store.add("s1", "goal", "other"))
        self.assertTrue(memory_store.add("s1", "goal", "same"))  # not the latest any more
        self.assertEqual(memory_store.count("s1"), 4)

    def test_text_is_cleaned_and_capped(self):
        memory_store.add("s1", "goal", "  lots   of \n space  ")
        memory_store.add("s1", "goal", "x" * 1000)
        memory_store.add("s1", "goal", "   ")
        texts = [e["text"] for e in memory_store.recent("s1", 10)]
        self.assertEqual(texts[0], "lots of space")
        self.assertEqual(len(texts[1]), 300)
        self.assertEqual(len(texts), 2)

    def test_unknown_kind_is_a_bug_not_silently_ignored(self):
        with self.assertRaises(ValueError):
            memory_store.add("s1", "note", "x")

    def test_old_entries_are_pruned(self):
        for i in range(memory_store.MAX_STORED_PER_SESSION + 8):
            memory_store.add("s1", "goal", f"g{i}")
        self.assertEqual(memory_store.count("s1"), memory_store.MAX_STORED_PER_SESSION)
        self.assertEqual(memory_store.recent("s1", 1)[0]["text"], f"g{memory_store.MAX_STORED_PER_SESSION + 7}")
        self.assertEqual(memory_store.recent("s1", 999)[0]["text"], "g8")

    def test_clear_only_affects_one_session(self):
        memory_store.add("a", "goal", "x")
        memory_store.add("a", "question", "y")
        memory_store.add("b", "goal", "z")
        self.assertEqual(memory_store.clear("a"), 2)
        self.assertEqual(memory_store.count("a"), 0)
        self.assertEqual(memory_store.count("b"), 1)

    def test_a_broken_store_never_breaks_a_request(self):
        # A directory where the database file should be: sqlite can't open it.
        memory_store.DB_PATH = Path(self.tmp.name)
        with self.assertLogs(memory_store.log, level="ERROR") as logs:
            self.assertEqual(memory_store.recall("s1", "full"), [])
            memory_store.remember("s1", "full", "goal", "x")  # must not raise
        self.assertEqual(len(logs.records), 2)  # both failures were logged, not hidden

    def test_concurrent_writers_and_a_reader(self):
        errors: list[Exception] = []
        stop = threading.Event()

        def write(n: int):
            try:
                for i in range(10):
                    memory_store.add("s1", "goal", f"t{n}-{i}")
            except Exception as e:  # noqa: BLE001
                errors.append(e)

        def read():
            while not stop.is_set():
                try:
                    memory_store.recent("s1", 10)
                    memory_store.count("s1")
                except Exception as e:  # noqa: BLE001
                    errors.append(e)

        writers = [threading.Thread(target=write, args=(n,), daemon=True) for n in range(8)]
        reader = threading.Thread(target=read, daemon=True)
        reader.start()
        for t in writers:
            t.start()
        # Bounded waits: if something ever deadlocks, the test FAILS instead
        # of hanging the whole run.
        for t in writers:
            t.join(timeout=60)
        stop.set()
        reader.join(timeout=10)

        self.assertFalse(any(t.is_alive() for t in writers), "writers did not finish (deadlock?)")
        self.assertEqual(errors, [])
        self.assertEqual(memory_store.count("s1"), memory_store.MAX_STORED_PER_SESSION)

    def test_database_is_recreated_if_the_file_is_deleted(self):
        memory_store.add("s1", "goal", "before")
        memory_store.DB_PATH.unlink()  # someone cleared storage while the server runs
        self.assertEqual(memory_store.count("s1"), 0)
        self.assertTrue(memory_store.add("s1", "goal", "after"))
        self.assertEqual(memory_store.recall("s1", "half"), ["after"])


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

        p = mock.patch.object(agent_runner, "critic", return_value={"unsupported": 0, "usage": {}})
        p.start()
        self.addCleanup(p.stop)

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


class PinSummaryTests(unittest.TestCase):
    def setUp(self):
        self.tmp = tempfile.TemporaryDirectory()
        memory_store.DB_PATH = Path(self.tmp.name) / "m.db"
        memory_store._schema_ready_for = None

    def tearDown(self):
        memory_store.DB_PATH = None
        self.tmp.cleanup()

    def test_pinned_item_survives_pruning_and_is_recalled(self):
        memory_store.remember("s", "full", "goal", "keep me")
        first = memory_store.all_entries("s")[0]["id"]
        self.assertTrue(memory_store.pin("s", first))
        for i in range(memory_store.MAX_STORED_PER_SESSION + 5):
            memory_store.remember("s", "full", "goal", f"g{i}")
        texts = [e["text"] for e in memory_store.all_entries("s")]
        self.assertIn("keep me", texts)
        self.assertIn("keep me", memory_store.recall("s", "half"))
        self.assertIn("keep me", memory_store.recall("s", "full"))

    def test_pin_limit_and_unknown_id(self):
        self.assertFalse(memory_store.pin("s", 999))

    def test_old_database_gets_pinned_column(self):
        import sqlite3
        path = Path(self.tmp.name) / "old.db"
        c = sqlite3.connect(path)
        c.execute("CREATE TABLE memory (id INTEGER PRIMARY KEY AUTOINCREMENT, session_id TEXT NOT NULL, "
                  "kind TEXT NOT NULL, text TEXT NOT NULL, created_at REAL NOT NULL)")
        c.commit(); c.close()
        memory_store.DB_PATH = path
        memory_store._schema_ready_for = None
        memory_store.remember("s", "full", "goal", "x")
        self.assertEqual(memory_store.all_entries("s")[0]["pinned"], 0)


class CrewTests(unittest.TestCase):
    def test_replan_focuses_on_failing_file(self):
        from app.services.crew import replan
        deep = {"files": [{"path": "a.py", "functions": [{"name": "f", "line": 1}], "todos": [1]}]}
        r = replan({"file": "a.py", "line": 3, "message": "boom"}, deep)
        self.assertEqual(r["focus_evidence"]["functions_in_file"], ["f"])
        self.assertIn("a.py", r["new_steps"][0])

    def test_critic_degrades_without_key(self):
        from app.services import crew
        with mock.patch.object(crew.llm, "ask", return_value={"ok": False, "error": "no key", "usage": {}}):
            r = crew.critic({"findings": [{"title": "No README"}]}, {"narrative": "n", "key_insight": "No README here"})
        self.assertTrue(r["rule"]["insight_names_real_evidence"])
        self.assertFalse(r["llm"]["available"])

    def test_critic_counts_unsupported(self):
        from app.services import crew
        fake = {"ok": True, "usage": {"total_tokens": 5}, "data": {"verdicts": [
            {"i": 0, "supported": False, "reason": "invented"}]}}
        with mock.patch.object(crew.llm, "ask", return_value=fake):
            r = crew.critic({"findings": []}, {"narrative": "uses Django", "key_insight": ""})
        self.assertEqual(r["unsupported"], 1)

    def test_failed_test_triggers_replan_event(self):
        tmp = tempfile.TemporaryDirectory(); self.addCleanup(tmp.cleanup)
        root = Path(tmp.name); make_project(root)
        with mock.patch.object(agent_runner, "detect_test_commands", return_value={"suggestions": [{"command": "x"}]}), \
             mock.patch.object(agent_runner, "run_command", return_value={"passed": False}), \
             mock.patch.object(agent_runner, "analyze_failure", return_value={"file": "src/auth.py", "line": 2}), \
             mock.patch.object(agent_runner, "critic", return_value={"unsupported": 0, "usage": {}}), \
             mock.patch.object(agent_runner, "interpret_project", return_value={"available": False, "error": "x"}):
            events = list(agent_runner.run_agent(root, "g"))
        self.assertTrue(any(e["step"] == "plan" and e["detail"].startswith("Replanned") for e in events))
        self.assertEqual([e.get("role") for e in events if e["step"] == "scan"][0], "Surveyor")
        self.assertIn("seconds", [e for e in events if e["step"] == "scan" and e["status"] == "done"][0]["data"]["metrics"])


class GenerateTests(unittest.TestCase):
    def test_untested_functions_and_diagram(self):
        from app.services import deep_scanner, generate
        tmp = tempfile.TemporaryDirectory(); self.addCleanup(tmp.cleanup)
        root = Path(tmp.name); make_project(root)
        (root / "tests").mkdir(); (root / "tests" / "test_x.py").write_text("def test_a():\n    total([1])\n")
        deep = deep_scanner.deep_scan(root)
        names = {t["name"] for t in generate.untested_functions(root, deep)}
        self.assertIn("login", names)
        self.assertNotIn("total", names)
        self.assertTrue(generate.mermaid_diagram(deep).startswith("graph TD"))
        self.assertIn("def login", generate._source(root, "src/auth.py", 1))
