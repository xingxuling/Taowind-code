#!/usr/bin/env python3
from __future__ import annotations

import argparse
import hashlib
import json
import os
import re
import shlex
import sys
from pathlib import Path
from typing import Any


FORBIDDEN_CHANGE_SEGMENTS = {
    ".git",
    "node_modules",
    ".next",
    "dist",
    "build",
    "runtime-data",
    ".venv",
}
CHANGESET_IR_READY_STATES = {"READY", "CANDIDATE", "TESTED", "PROMOTION_REQUESTED"}


def _read_payload() -> dict[str, Any]:
    raw = sys.stdin.read()
    if not raw.strip():
        return {}
    value = json.loads(raw)
    if not isinstance(value, dict):
        raise ValueError("payload must be an object")
    return value


def _extract_json(text: str) -> dict[str, Any] | None:
    raw = str(text or "").strip()
    raw = re.sub(r"^```(?:json)?\s*", "", raw, flags=re.I)
    raw = re.sub(r"\s*```$", "", raw)
    try:
        value = json.loads(raw)
        return value if isinstance(value, dict) else None
    except Exception:
        pass
    start, end = raw.find("{"), raw.rfind("}")
    if start >= 0 and end > start:
        try:
            value = json.loads(raw[start : end + 1])
            return value if isinstance(value, dict) else None
        except Exception:
            return None
    return None


def _register_optional_accelerator(runtime) -> dict[str, Any]:
    endpoint = os.getenv("DWAC_LANGUAGE_ENDPOINT") or os.getenv("TAO_AI_ENDPOINT")
    model = os.getenv("DWAC_LANGUAGE_MODEL") or os.getenv("TAO_AI_MODEL")
    api_key = os.getenv("DWAC_LANGUAGE_API_KEY") or os.getenv("TAO_AI_API_KEY")
    if not endpoint:
        return {"connected": False, "endpoint": None, "model": None}
    runtime.register_openai_compatible(
        "taowind.external-accelerator",
        endpoint,
        model=model,
        api_key=api_key,
        priority=8,
    )
    return {"connected": True, "endpoint": endpoint, "model": model}


def _safe_change_path(raw: Any) -> str:
    text = str(raw or "").replace("\\", "/").strip()
    if not text or text.startswith("/") or re.match(r"^[A-Za-z]:", text):
        raise ValueError("UNSAFE_CHANGE_PATH")
    parts = Path(text).parts
    if ".." in parts or any(part in FORBIDDEN_CHANGE_SEGMENTS for part in parts):
        raise ValueError("UNSAFE_CHANGE_PATH")
    normalized = "/".join(part for part in parts if part not in ("", "."))
    if not normalized:
        raise ValueError("UNSAFE_CHANGE_PATH")
    return normalized


def _workspace_preimage(workspace: Path, rel: str) -> tuple[bytes | None, str | None]:
    target = workspace / rel
    if not target.exists():
        return None, None
    if not target.is_file():
        raise ValueError(f"CHANGE_TARGET_NOT_FILE:{rel}")
    data = target.read_bytes()
    return data, hashlib.sha256(data).hexdigest()


def _dwac_ir_validation_commands(raw: dict[str, Any]) -> list[str]:
    commands: list[str] = []
    supplied = raw.get("validation_commands")
    if isinstance(supplied, list):
        commands.extend(str(item).strip() for item in supplied if str(item).strip())
    tests = raw.get("tests")
    if isinstance(tests, list):
        for test in tests:
            if not isinstance(test, dict):
                continue
            argv = test.get("argv")
            if (
                isinstance(argv, list)
                and argv
                and all(isinstance(item, str) and item for item in argv)
            ):
                commands.append(shlex.join(argv))
    return list(dict.fromkeys(commands))[:16]


def _translate_dwac_changeset_ir(
    workspace: Path, raw: dict[str, Any]
) -> dict[str, Any]:
    files = raw.get("files")
    if not isinstance(files, list):
        raise ValueError("CHANGESET_IR_FILES_REQUIRED")
    state = str(raw.get("status") or "READY").upper()
    if state not in CHANGESET_IR_READY_STATES:
        raise ValueError(f"CHANGESET_IR_NOT_READY:{state}")
    changes: list[dict[str, Any]] = []
    for item in files:
        if not isinstance(item, dict):
            raise ValueError("CHANGESET_IR_FILE_OBJECT_REQUIRED")
        op = str(item.get("operation") or "")
        rel = _safe_change_path(item.get("path"))
        before, before_sha = _workspace_preimage(workspace, rel)
        if op == "write":
            content = item.get("content")
            if not isinstance(content, str):
                raise ValueError(f"WRITE_CONTENT_REQUIRED:{rel}")
            change: dict[str, Any] = {"op": "write", "path": rel, "content": content}
            if before is not None:
                change["expectedSha256"] = before_sha
        elif op == "replace":
            old = item.get("old")
            new = item.get("new")
            if not isinstance(old, str) or not old or not isinstance(new, str):
                raise ValueError(f"REPLACE_TEXT_REQUIRED:{rel}")
            if before is None:
                raise ValueError(f"REPLACE_TARGET_MISSING:{rel}")
            try:
                current = before.decode("utf-8")
            except UnicodeDecodeError as exc:
                raise ValueError(f"REPLACE_TARGET_NOT_UTF8:{rel}") from exc
            occurrences = current.count(old)
            if occurrences != 1:
                raise ValueError(f"REPLACE_PREIMAGE_NOT_UNIQUE:{rel}:{occurrences}")
            change = {
                "op": "write",
                "path": rel,
                "content": current.replace(old, new, 1),
                "expectedSha256": before_sha,
            }
        elif op == "delete":
            if before is None:
                raise ValueError(f"DELETE_TARGET_MISSING:{rel}")
            change = {"op": "delete", "path": rel, "expectedSha256": before_sha}
        else:
            raise ValueError(f"CHANGESET_IR_OPERATION_REJECTED:{op}")
        changes.append(change)

    return {
        "summary": str(raw.get("summary") or "DWAC ChangeSetIR candidate"),
        "changes": changes,
        "validation_commands": _dwac_ir_validation_commands(raw),
        "browser_checks": raw.get("browser_checks") if isinstance(raw.get("browser_checks"), list) else [],
        "risks": [str(item) for item in raw.get("risks", [])]
        if isinstance(raw.get("risks"), list)
        else [],
        "needs_more_context": [str(item) for item in raw.get("needs_more_context", [])]
        if isinstance(raw.get("needs_more_context"), list)
        else [],
        "dwac_changeset_ir": {
            "changeset_id": str(raw.get("changeset_id") or ""),
            "hypothesis_id": str(raw.get("hypothesis_id") or ""),
            "base_ref": str(raw.get("base_ref") or ""),
            "status": state,
        },
    }


def _normalize_native_proposal(
    workspace: Path, parsed: dict[str, Any]
) -> dict[str, Any]:
    # Existing Taowind Code proposal format stays compatible. When DWAC emits its
    # checked-in ChangeSetIR v0.1 shape, lower it deterministically to the local
    # transactional changeset protocol instead of asking another model to rewrite it.
    if isinstance(parsed.get("files"), list):
        try:
            return _translate_dwac_changeset_ir(workspace, parsed)
        except Exception as exc:
            return {
                "summary": "DWAC ChangeSetIR candidate failed deterministic lowering",
                "changes": [],
                "validation_commands": [],
                "browser_checks": [],
                "risks": [f"DWAC_CHANGESET_IR_REJECTED:{type(exc).__name__}:{exc}"],
                "needs_more_context": [],
            }
    parsed.setdefault("summary", "")
    parsed.setdefault("changes", [])
    parsed.setdefault("validation_commands", [])
    parsed.setdefault("browser_checks", [])
    parsed.setdefault("risks", [])
    parsed.setdefault("needs_more_context", [])
    return parsed


def _changeset_prompt(payload: dict[str, Any], role: str) -> str:
    goal = str(payload.get("goal") or "").strip()
    repository = payload.get("repository") or {}
    files = payload.get("files") or []
    dwac = payload.get("dwac") or {}
    role_focus = {
        "architecture": "优先保证架构一致性、依赖边界、兼容性与最小完整改动。",
        "implementation": "优先给出可执行的多文件实现、测试与真实验收命令。",
        "verifier": "以对抗式验证为主，优先暴露回归、缺失测试和假完成风险。",
    }.get(role, "优先完成可执行实现。")
    contract = {
        "goal": goal,
        "dwac": dwac,
        "repository": repository,
        "files": files,
    }
    return (
        "你是 DWAC 内部的仓库变更合成器，不是独立于 DWAC 的第二个 AI。\n"
        + role_focus
        + "\n只输出 JSON，不要 Markdown，不要宣称执行成功。\n"
        + "优先输出 DWAC 已有 ChangeSetIR v0.1 形态："
        + '{"changeset_id":string,"hypothesis_id":string,"target_repo":".","base_ref":"HEAD",'
        + '"files":[{"operation":"write"|"replace"|"delete","path":string,"content"?:string,"old"?:string,"new"?:string}],'
        + '"tests":[{"name":string,"argv":[string],"timeout_seconds":integer}],"rollback":{},"status":"READY",'
        + '"summary"?:string,"browser_checks"?:[],"risks"?:[string],"needs_more_context"?:[string]}。\n'
        + "兼容旧输出结构："
        + '{"summary":string,"changes":[{"op":"write"|"delete","path":string,"content"?:string,"expectedSha256"?:string}],'
        + '"validation_commands":[string],"browser_checks"?:[],"risks":[string],"needs_more_context"?:[string]}。\n'
        + "replace 的 old 必须是上下文中目标文件内唯一的精确子串；tests 使用 argv 数组，不要声称已经运行。\n"
        + "只能改工作区内文件；禁止 .git、node_modules、build/dist 产物、密钥和工作区外路径。\n"
        + "如果现有原生认知不足以可靠生成变更，files/changes 必须为空，并在 needs_more_context 或 risks 解释真实缺口，禁止伪造。\n"
        + "上下文：\n"
        + json.dumps(contract, ensure_ascii=False, separators=(",", ":"))
    )


def _native_changeset(
    dwac_root: Path, workspace: Path, payload: dict[str, Any], role: str
) -> dict[str, Any]:
    sys.path.insert(0, str(dwac_root))
    from natural_conversation_runtime import NaturalConversationRuntime

    state_dir = workspace / ".taowind"
    state_dir.mkdir(parents=True, exist_ok=True)
    runtime = NaturalConversationRuntime(
        state_dir / "dwac-cognition.sqlite", workspace
    )
    accelerator = _register_optional_accelerator(runtime)
    session = runtime.create_session(
        native_first=True,
        voice_enabled=False,
        proactive_enabled=False,
        metadata={"client": "taowind-code", "operation": "changeset", "role": role},
    )
    out = runtime.send(session["session_id"], _changeset_prompt(payload, role))
    content = str((out.get("assistant_message") or {}).get("content") or "")
    parsed = _extract_json(content)
    if parsed is None:
        parsed = {
            "summary": "DWAC native cognition did not emit a machine changeset",
            "changes": [],
            "validation_commands": [],
            "browser_checks": [],
            "risks": ["DWAC_NATIVE_CHANGESET_UNRESOLVED"],
            "needs_more_context": [],
        }
    parsed = _normalize_native_proposal(workspace, parsed)
    return {
        "status": "READY"
        if parsed.get("changes") and parsed.get("validation_commands")
        else "UNRESOLVED",
        "role": role,
        "proposal": parsed,
        "route": out.get("plan", {}).get("route")
        if isinstance(out.get("plan"), dict)
        else None,
        "interaction_class": out.get("interaction_class"),
        "accelerator": accelerator,
        "native_answer_preview": content[:1200],
    }


def _browser_gate(validation: dict[str, Any]) -> tuple[bool, str | None]:
    required = bool(validation.get("browserRequired"))
    browser = validation.get("browser") or {}
    if not required:
        return True, None
    rows = browser.get("results") or []
    if not rows:
        return False, "BROWSER_EVIDENCE_REQUIRED"
    if not all(
        (row.get("evaluation") or {}).get("passed") is True
        for row in rows
        if isinstance(row, dict)
    ):
        return False, "BROWSER_EVIDENCE_FAILED"
    return True, None


def _closure(payload: dict[str, Any]) -> dict[str, Any]:
    run = payload.get("run") or {}
    validation = run.get("validation") or {}
    if validation.get("passed") is not True:
        return {
            "protocol": "taowind-code.dwac-native-closure.v0.1",
            "closed": False,
            "confidence": 1.0,
            "reason": "硬验收尚未通过",
            "gaps": [
                {
                    "id": "validation",
                    "problem": "VALIDATION_EVIDENCE_REQUIRED",
                    "severity": 1.0,
                }
            ],
            "next_goal": "先修复真实验收失败，再重新执行闭合审计。",
            "recommended_mode": "DEEP_DEVELOPMENT",
            "votes": [
                {
                    "provider": "dwac-native",
                    "role": "hard-evidence",
                    "closed": False,
                    "confidence": 1.0,
                }
            ],
        }
    browser_ok, browser_reason = _browser_gate(validation)
    if not browser_ok:
        return {
            "protocol": "taowind-code.dwac-native-closure.v0.1",
            "closed": False,
            "confidence": 1.0,
            "reason": f"浏览器硬证据门未通过：{browser_reason}",
            "gaps": [
                {"id": "browser", "problem": browser_reason, "severity": 1.0}
            ],
            "next_goal": "补齐真实浏览器 DOM / console / network 观察并重新验收。",
            "recommended_mode": "DEEP_DEVELOPMENT",
            "votes": [
                {
                    "provider": "dwac-native",
                    "role": "browser-evidence",
                    "closed": False,
                    "confidence": 1.0,
                }
            ],
        }
    status = str(run.get("status") or "")
    delivery = run.get("delivery") or {}
    delivery_ready = status in {
        "READY_FOR_DELIVERY",
        "DELIVERED_LOCAL",
    } and bool(delivery)
    if not delivery_ready:
        return {
            "protocol": "taowind-code.dwac-native-closure.v0.1",
            "closed": False,
            "confidence": 0.96,
            "reason": "验收通过，但尚缺少交付证据投影",
            "gaps": [
                {
                    "id": "delivery",
                    "problem": "DELIVERY_EVIDENCE_REQUIRED",
                    "severity": 0.86,
                }
            ],
            "next_goal": "生成 revision-bound 交付证据后重新闭合。",
            "recommended_mode": "WHOLE_ARTIFACT",
            "votes": [
                {
                    "provider": "dwac-native",
                    "role": "delivery-evidence",
                    "closed": False,
                    "confidence": 0.96,
                }
            ],
        }
    changed = delivery.get("changedPaths") or []
    confidence = 0.84 if changed else 0.78
    return {
        "protocol": "taowind-code.dwac-native-closure.v0.1",
        "closed": True,
        "confidence": confidence,
        "reason": "DWAC 原生非补偿性闭合：真实 validation、所需浏览器证据与 revision-bound delivery 均已通过。",
        "gaps": [],
        "next_goal": "",
        "recommended_mode": "WHOLE_ARTIFACT",
        "votes": [
            {
                "provider": "dwac-native",
                "role": "hard-evidence",
                "closed": True,
                "confidence": confidence,
            }
        ],
    }


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--dwac-root", required=True)
    parser.add_argument("--workspace", required=True)
    parser.add_argument("--mode", choices=("changeset", "closure"), required=True)
    parser.add_argument("--role", default="implementation")
    args = parser.parse_args()
    dwac_root = Path(args.dwac_root).expanduser().resolve()
    workspace = Path(args.workspace).expanduser().resolve()
    if not (dwac_root / "natural_conversation_runtime.py").is_file():
        print(
            json.dumps(
                {"status": "UNBOUND", "error": "DWAC_NATURAL_RUNTIME_MISSING"},
                ensure_ascii=False,
            )
        )
        return 3
    payload = _read_payload()
    try:
        result = (
            _closure(payload)
            if args.mode == "closure"
            else _native_changeset(dwac_root, workspace, payload, args.role)
        )
        print(json.dumps(result, ensure_ascii=False))
        return 0
    except Exception as exc:
        print(
            json.dumps(
                {"status": "ERROR", "error": f"{type(exc).__name__}: {exc}"},
                ensure_ascii=False,
            )
        )
        return 2


if __name__ == "__main__":
    raise SystemExit(main())
