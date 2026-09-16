#!/usr/bin/env python3
from __future__ import annotations

import argparse
import json
import os
import re
import sys
from pathlib import Path
from typing import Any


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
        + "输出结构必须为："
        + '{"summary":string,"changes":[{"op":"write"|"delete","path":string,"content"?:string,"expectedSha256"?:string}],'
        + '"validation_commands":[string],"browser_checks"?:[],"risks":[string],"needs_more_context"?:[string]}。\n'
        + "只能改工作区内文件；禁止 .git、node_modules、build/dist 产物、密钥和工作区外路径。\n"
        + "如果现有原生认知不足以可靠生成变更，changes 必须为空，并在 needs_more_context 或 risks 解释真实缺口，禁止伪造。\n"
        + "上下文：\n"
        + json.dumps(contract, ensure_ascii=False, separators=(",", ":"))
    )


def _native_changeset(dwac_root: Path, workspace: Path, payload: dict[str, Any], role: str) -> dict[str, Any]:
    sys.path.insert(0, str(dwac_root))
    from natural_conversation_runtime import NaturalConversationRuntime

    state_dir = workspace / ".taowind"
    state_dir.mkdir(parents=True, exist_ok=True)
    runtime = NaturalConversationRuntime(state_dir / "dwac-cognition.sqlite", workspace)
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
            "risks": ["DWAC_NATIVE_CHANGESET_UNRESOLVED"],
            "needs_more_context": [],
        }
    parsed.setdefault("summary", "")
    parsed.setdefault("changes", [])
    parsed.setdefault("validation_commands", [])
    parsed.setdefault("risks", [])
    parsed.setdefault("needs_more_context", [])
    return {
        "status": "READY" if parsed.get("changes") and parsed.get("validation_commands") else "UNRESOLVED",
        "role": role,
        "proposal": parsed,
        "route": out.get("plan", {}).get("route") if isinstance(out.get("plan"), dict) else None,
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
    if not all((row.get("evaluation") or {}).get("passed") is True for row in rows if isinstance(row, dict)):
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
            "gaps": [{"id": "validation", "problem": "VALIDATION_EVIDENCE_REQUIRED", "severity": 1.0}],
            "next_goal": "先修复真实验收失败，再重新执行闭合审计。",
            "recommended_mode": "DEEP_DEVELOPMENT",
            "votes": [{"provider": "dwac-native", "role": "hard-evidence", "closed": False, "confidence": 1.0}],
        }
    browser_ok, browser_reason = _browser_gate(validation)
    if not browser_ok:
        return {
            "protocol": "taowind-code.dwac-native-closure.v0.1",
            "closed": False,
            "confidence": 1.0,
            "reason": f"浏览器硬证据门未通过：{browser_reason}",
            "gaps": [{"id": "browser", "problem": browser_reason, "severity": 1.0}],
            "next_goal": "补齐真实浏览器 DOM / console / network 观察并重新验收。",
            "recommended_mode": "DEEP_DEVELOPMENT",
            "votes": [{"provider": "dwac-native", "role": "browser-evidence", "closed": False, "confidence": 1.0}],
        }
    status = str(run.get("status") or "")
    delivery = run.get("delivery") or {}
    delivery_ready = status in {"READY_FOR_DELIVERY", "DELIVERED_LOCAL"} and bool(delivery)
    if not delivery_ready:
        return {
            "protocol": "taowind-code.dwac-native-closure.v0.1",
            "closed": False,
            "confidence": 0.96,
            "reason": "验收通过，但尚缺少交付证据投影",
            "gaps": [{"id": "delivery", "problem": "DELIVERY_EVIDENCE_REQUIRED", "severity": 0.86}],
            "next_goal": "生成 revision-bound 交付证据后重新闭合。",
            "recommended_mode": "WHOLE_ARTIFACT",
            "votes": [{"provider": "dwac-native", "role": "delivery-evidence", "closed": False, "confidence": 0.96}],
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
        "votes": [{"provider": "dwac-native", "role": "hard-evidence", "closed": True, "confidence": confidence}],
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
        print(json.dumps({"status": "UNBOUND", "error": "DWAC_NATURAL_RUNTIME_MISSING"}, ensure_ascii=False))
        return 3
    payload = _read_payload()
    try:
        result = _closure(payload) if args.mode == "closure" else _native_changeset(dwac_root, workspace, payload, args.role)
        print(json.dumps(result, ensure_ascii=False))
        return 0
    except Exception as exc:
        print(json.dumps({"status": "ERROR", "error": f"{type(exc).__name__}: {exc}"}, ensure_ascii=False))
        return 2


if __name__ == "__main__":
    raise SystemExit(main())
