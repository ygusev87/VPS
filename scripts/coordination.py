#!/usr/bin/env python3
"""Переписка Claude и Codex по проекту: сообщения, задачи, пауза проекта.

Состояние лежит локально в coordination/ (не в git): state.json — главный
файл, SIGNAL.json — короткая сводка, CHAT.md — переписка для чтения человеком.
Руками эти файлы не править: писать только через этот скрипт (он берёт
блокировку и заменяет файлы атомарно). Справка: coordination/README.md.
"""

from __future__ import annotations

import argparse
import contextlib
import fcntl
import json
import os
import sys
import tempfile
import time
from datetime import datetime, timezone
from pathlib import Path


AGENTS = ("claude", "codex")
TASK_STATUSES = ("queued", "working", "review", "done", "blocked")
PROJECT_STATUSES = ("active", "paused")
MESSAGE_KINDS = ("note", "question", "proposal", "review", "decision", "blocker", "done")
DEFAULT_ROOT = Path(__file__).resolve().parents[1] / "coordination"


def now() -> str:
    return datetime.now(timezone.utc).isoformat(timespec="seconds").replace("+00:00", "Z")


def local_time(stamp: str) -> str:
    moment = datetime.fromisoformat(stamp.replace("Z", "+00:00"))
    return moment.astimezone().strftime("%d.%m %H:%M")


def fail(message: str) -> None:
    raise ValueError(message)


def atomic_write(path: Path, data: bytes) -> None:
    fd, name = tempfile.mkstemp(prefix=f".{path.name}.", dir=path.parent)
    try:
        with os.fdopen(fd, "wb") as stream:
            stream.write(data)
            stream.flush()
            os.fsync(stream.fileno())
        os.replace(name, path)
    finally:
        if os.path.exists(name):
            os.unlink(name)


def atomic_json(path: Path, value: dict) -> None:
    atomic_write(path, (json.dumps(value, ensure_ascii=False, indent=1) + "\n").encode())


@contextlib.contextmanager
def locked(root: Path, create: bool = False):
    if create:
        root.mkdir(parents=True, exist_ok=True)
    elif not (root / "state.json").exists():
        fail(f"Переписка не создана: {root}; сначала init")
    with (root / ".lock").open("a+b") as lock_file:
        fcntl.flock(lock_file.fileno(), fcntl.LOCK_EX)
        try:
            yield
        finally:
            fcntl.flock(lock_file.fileno(), fcntl.LOCK_UN)


def load(root: Path) -> dict:
    state = json.loads((root / "state.json").read_text(encoding="utf-8"))
    if state.get("schema_version") != 1:
        fail("Неизвестная версия state.json")
    return state


def initial_state() -> dict:
    return {
        "schema_version": 1,
        "revision": 0,
        "project_status": "paused",
        "project_reason": "Канал создан; работа начнётся, когда владелец скажет «продолжайте».",
        "tasks": {},
        "agents": {agent: {"seen_revision": 0} for agent in AGENTS},
        "messages": [],
    }


def unread(state: dict, agent: str, after: int | None = None) -> list[dict]:
    cursor = state["agents"][agent]["seen_revision"] if after is None else after
    return [m for m in state["messages"]
            if m["revision"] > cursor and m["author"] != agent and m["to"] in (agent, "both")]


def open_tasks(state: dict, agent: str | None = None) -> list[dict]:
    return [{"id": task_id, **{k: task[k] for k in ("owner", "reviewer", "status", "title", "next_action")}}
            for task_id, task in sorted(state["tasks"].items())
            if task["status"] != "done" and (agent is None or task["owner"] == agent)]


def signal(state: dict) -> dict:
    return {
        "revision": state["revision"],
        "project_status": state["project_status"],
        "project_reason": state["project_reason"],
        "unread": {agent: len(unread(state, agent)) for agent in AGENTS},
        "open_tasks": open_tasks(state),
    }


def chat(state: dict) -> str:
    """CHAT.md: the whole conversation, newest at the bottom, for the owner to read."""
    status = "идёт работа" if state["project_status"] == "active" else "пауза"
    lines = [f"# Переписка Claude и Codex", "",
             f"Сейчас: **{status}** — {state['project_reason']}", ""]
    tasks = open_tasks(state)
    if tasks:
        lines += ["## Открытые задачи", ""]
        lines += [f"- `{t['id']}` — {t['title']} · {t['owner']} · {t['status']} · дальше: {t['next_action']}"
                  for t in tasks]
        lines.append("")
    lines += ["## Сообщения", ""]
    for m in state["messages"]:
        head = f"### {m['id']} · {local_time(m['timestamp'])} · {m['author']} → {m['to']} · {m['kind']}"
        lines += [head, f"**{m['subject']}**"]
        if m.get("reply_to"):
            lines.append(f"_ответ на {m['reply_to']}_")
        lines += ["", m["body"].rstrip(), ""]
    return "\n".join(lines) + "\n"


def save(root: Path, state: dict) -> None:
    state["revision"] += 1
    atomic_json(root / "state.json", state)
    atomic_json(root / "SIGNAL.json", signal(state))
    atomic_write(root / "CHAT.md", chat(state).encode())


def check_text(value: str, label: str) -> None:
    if not value or not value.strip():
        fail(f"{label}: пусто")


def message_body(args: argparse.Namespace) -> str:
    if (args.body is None) == (args.body_file is None):
        fail("Нужно ровно одно из --body и --body-file")
    body = args.body if args.body is not None else Path(args.body_file).read_text(encoding="utf-8")
    check_text(body, "Текст сообщения")
    return body


def execute(args: argparse.Namespace) -> dict:
    root = Path(args.root)
    with locked(root, create=args.command == "init"):
        if args.command == "init":
            if (root / "state.json").exists():
                return {"initialized": False, "revision": load(root)["revision"]}
            state = initial_state()
            state["revision"] = -1
            save(root, state)
            return {"initialized": True, "revision": state["revision"]}
        state = load(root)
        command = args.command
        if command == "peek":
            messages = unread(state, args.agent)
            return {"revision": state["revision"], "project_status": state["project_status"],
                    "project_reason": state["project_reason"],
                    "seen_revision": state["agents"][args.agent]["seen_revision"],
                    "unread": [{"id": m["id"], "from": m["author"], "kind": m["kind"],
                                "subject": m["subject"]} for m in messages],
                    "my_open_tasks": open_tasks(state, args.agent)}
        if command == "read":
            if args.after is not None and not 0 <= args.after <= state["revision"]:
                fail("--after: от нуля до текущей ревизии")
            return {"revision": state["revision"], "messages": unread(state, args.agent, args.after)}
        if command == "ack":
            cursor = state["agents"][args.agent]["seen_revision"]
            if not cursor <= args.through <= state["revision"]:
                fail("--through: от своего курсора до текущей ревизии")
            if args.through != cursor:
                state["agents"][args.agent]["seen_revision"] = args.through
                save(root, state)
            return {"revision": state["revision"], "seen_revision": args.through}
        if command == "post":
            check_text(args.subject, "Тема")
            if args.reply_to and not any(m["id"] == args.reply_to for m in state["messages"]):
                fail(f"Нет такого сообщения: {args.reply_to}")
            if args.task and args.task not in state["tasks"]:
                fail(f"Нет такой задачи: {args.task}")
            message = {"id": f"m{len(state['messages']) + 1:04d}", "revision": state["revision"] + 1,
                       "timestamp": now(), "author": args.author, "to": args.to, "kind": args.kind,
                       "subject": args.subject.strip(), "body": message_body(args),
                       "reply_to": args.reply_to, "task": args.task}
            state["messages"].append(message)
            save(root, state)
            return {"revision": state["revision"], "message_id": message["id"]}
        if command == "task-create":
            check_text(args.id, "ID задачи")
            check_text(args.title, "Название")
            check_text(args.next, "Следующий шаг")
            if args.id in state["tasks"]:
                fail(f"Задача уже есть: {args.id}")
            if args.reviewer == args.owner:
                fail("Проверяет другой агент")
            state["tasks"][args.id] = {"owner": args.owner, "reviewer": args.reviewer,
                                       "title": args.title, "status": "queued",
                                       "next_action": args.next, "created_at": now(), "updated_at": now()}
            save(root, state)
            return {"revision": state["revision"], "task_id": args.id}
        if command == "task-update":
            task = state["tasks"].get(args.id)
            if task is None:
                fail(f"Нет такой задачи: {args.id}")
            if task["owner"] != args.agent:
                fail("Задачу обновляет только её владелец")
            check_text(args.next, "Следующий шаг")
            if (task["status"], task["next_action"]) != (args.status, args.next):
                task.update(status=args.status, next_action=args.next, updated_at=now())
                save(root, state)
            return {"revision": state["revision"], "task_id": args.id, "status": task["status"]}
        if command == "project-status":
            check_text(args.reason, "Причина")
            if (state["project_status"], state["project_reason"]) != (args.status, args.reason):
                state["project_status"] = args.status
                state["project_reason"] = args.reason
                save(root, state)
            return {"revision": state["revision"], "project_status": args.status}
        fail(f"Неизвестная команда: {command}")


def watch(args: argparse.Namespace) -> int:
    """Prints one line per new message to the agent and per pause/resume; never exits.

    Reads state.json without the lock: it is only ever replaced atomically.
    """
    path = Path(args.root) / "state.json"
    seen_ids: set[str] | None = None
    status = None
    while True:
        try:
            state = json.loads(path.read_text(encoding="utf-8"))
        except (OSError, ValueError):
            time.sleep(args.interval)
            continue
        messages = unread(state, args.agent)
        if seen_ids is None:
            seen_ids = set()
            if messages:
                print(f"непрочитанных: {len(messages)} (последнее {messages[-1]['id']})", flush=True)
                seen_ids.update(m["id"] for m in messages)
            status = state["project_status"]
        for m in messages:
            if m["id"] not in seen_ids:
                seen_ids.add(m["id"])
                print(f"{m['id']} от {m['author']} [{m['kind']}]: {m['subject']}", flush=True)
        if state["project_status"] != status:
            status = state["project_status"]
            print(f"проект: {status} — {state['project_reason']}", flush=True)
        time.sleep(args.interval)


def parser() -> argparse.ArgumentParser:
    p = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    p.add_argument("--root", default=str(DEFAULT_ROOT), help="папка переписки")
    sub = p.add_subparsers(dest="command", required=True)
    sub.add_parser("init")
    for command in ("peek", "read", "ack", "watch"):
        q = sub.add_parser(command)
        q.add_argument("--agent", required=True, choices=AGENTS)
        if command == "read":
            q.add_argument("--after", type=int, help="показать с этой ревизии (по умолчанию — непрочитанное)")
        if command == "ack":
            q.add_argument("--through", type=int, required=True, help="ревизия из ответа read")
        if command == "watch":
            q.add_argument("--interval", type=float, default=20, help="секунд между проверками")
    q = sub.add_parser("post")
    q.add_argument("--author", required=True, choices=AGENTS)
    q.add_argument("--to", required=True, choices=(*AGENTS, "both"))
    q.add_argument("--kind", required=True, choices=MESSAGE_KINDS)
    q.add_argument("--subject", required=True)
    q.add_argument("--body")
    q.add_argument("--body-file")
    q.add_argument("--reply-to")
    q.add_argument("--task")
    q = sub.add_parser("task-create")
    q.add_argument("--id", required=True)
    q.add_argument("--owner", required=True, choices=AGENTS)
    q.add_argument("--reviewer", choices=AGENTS)
    q.add_argument("--title", required=True)
    q.add_argument("--next", required=True)
    q = sub.add_parser("task-update")
    q.add_argument("--id", required=True)
    q.add_argument("--agent", required=True, choices=AGENTS)
    q.add_argument("--status", required=True, choices=TASK_STATUSES)
    q.add_argument("--next", required=True)
    q = sub.add_parser("project-status")
    q.add_argument("--status", required=True, choices=PROJECT_STATUSES)
    q.add_argument("--reason", required=True)
    return p


def main() -> int:
    args = parser().parse_args()
    try:
        if args.command == "watch":
            return watch(args)
        result = execute(args)
    except (ValueError, OSError, json.JSONDecodeError) as error:
        print(f"coordination: {error}", file=sys.stderr)
        return 1
    except KeyboardInterrupt:
        return 0
    print(json.dumps(result, ensure_ascii=False, separators=(",", ":")))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
