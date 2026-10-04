#!/usr/bin/env python3
"""Local Kale reply proxy. Reads the class .env and never exposes the key to the browser."""
from __future__ import annotations

import json
import os
import urllib.error
import urllib.request
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer

HERE = os.path.dirname(os.path.abspath(__file__))
PORT = int(os.environ.get("PORT") or os.environ.get("ELAK_KALE_PORT") or "8767")
HOST = os.environ.get("ELAK_KALE_HOST") or ("0.0.0.0" if os.environ.get("PORT") else "127.0.0.1")
STORE_PATH = os.environ.get("ELAK_STORE_PATH") or os.path.join(HERE, "elak-store.json")


def load_dotenv() -> None:
    for path in (os.path.join(HERE, ".env"), os.path.join(os.path.dirname(HERE), ".env")):
        if not os.path.isfile(path):
            continue
        with open(path, encoding="utf-8") as fh:
            for raw in fh:
                line = raw.strip()
                if not line or line.startswith("#") or "=" not in line:
                    continue
                key, val = line.split("=", 1)
                key = key.strip()
                val = val.strip().strip("'").strip('"')
                if key and key not in os.environ:
                    os.environ[key] = val


load_dotenv()


def chat_url() -> str:
    base = (os.environ.get("OPENAI_BASE_URL") or os.environ.get("OPENAI_API_BASE") or "https://api.openai.com").rstrip("/")
    if base.endswith("/v1"):
        return base + "/chat/completions"
    return base + "/v1/chat/completions"


def system_prompt() -> str:
    return (
        "You are Kale, a friendly ankle-rehab chatbot for ELAK. Answer like a normal chat assistant. "
        "For medical or symptom questions, answer only from the retrieved medical_notes. "
        "Do not give a generic lecture about NPRS or VAS unless a medical note on the pain scale was retrieved. "
        "Put the matching note into everyday words and apply it to what they asked. "
        "Use live patient facts only for names, times, exercises, and logged scores. "
        "If no medical note matches, say you do not have that note and they should ask their clinician. "
        "Do not diagnose a new condition or prescribe a new treatment. Two to six short sentences. "
        "If they only want a medical explanation, needsApproval is false. "
        "If they want to reschedule, postpone, skip, or reduce home exercises, set needsApproval to true and do not "
        "claim the plan already changed. Propose one concrete change that matches the amount they named. "
        "'one day' or '1 day' => shiftDays 1 and summary 'Move home practice later by 1 day'. "
        "'two days' => shiftDays 2. 'one week' or 'next week' => shiftDays 7. "
        "Never default to a week if they named a different delay. "
        "Return JSON only with keys: say (string), needsApproval (boolean), request (object or null). "
        "request keys: kind (shift_week|shift_days|reduce_days|reduce_set), shiftDays (number), daysPerWeek (number or null), "
        "reason (string), summary (string). If no plan change is needed, request is null and needsApproval is false."
    )


class Handler(BaseHTTPRequestHandler):
    def log_message(self, fmt: str, *args) -> None:
        return

    def _cors(self) -> None:
        self.send_header("Access-Control-Allow-Origin", "*")
        self.send_header("Access-Control-Allow-Methods", "GET, POST, OPTIONS")
        self.send_header("Access-Control-Allow-Headers", "Content-Type")

    def do_OPTIONS(self) -> None:
        self.send_response(204)
        self._cors()
        self.end_headers()

    def do_GET(self) -> None:
        if self.path in ("/store", "/store/"):
            self._json(200, {"ok": True, "store": read_store()})
            return
        if self.path in ("/", "/kale", "/health"):
            self.send_response(200)
            self.send_header("Content-Type", "application/json")
            self._cors()
            self.end_headers()
            self.wfile.write(b'{"ok":true,"name":"kale"}')
            return
        self.send_response(404)
        self._cors()
        self.end_headers()

    def do_POST(self) -> None:
        if self.path in ("/store", "/store/"):
            length = int(self.headers.get("Content-Length") or 0)
            try:
                payload = json.loads(self.rfile.read(length) or b"{}")
            except json.JSONDecodeError:
                payload = {}
            saved = write_store(merge_store(read_store(), payload))
            self._json(200, {"ok": True, "store": saved})
            return
        if self.path not in ("/kale", "/", "/report"):
            self.send_response(404)
            self._cors()
            self.end_headers()
            return
        length = int(self.headers.get("Content-Length") or 0)
        try:
            payload = json.loads(self.rfile.read(length) or b"{}")
        except json.JSONDecodeError:
            payload = {}
        key = os.environ.get("OPENAI_API_KEY") or ""
        if not key:
            self._json(503, {"ok": False, "reason": "no-key"})
            return
        if self.path == "/report" and payload.get("messages"):
            body = {
                "model": os.environ.get("OPENAI_MODEL") or "deepseek-chat",
                "temperature": payload.get("temperature", 0.3),
                "messages": payload.get("messages") or [],
            }
        else:
            body = {
                "model": os.environ.get("OPENAI_MODEL") or "deepseek-chat",
                "temperature": 0.5,
                "response_format": {"type": "json_object"},
                "messages": kale_messages(payload),
            }
        timeout = 90 if self.path == "/report" else 28
        try:
            raw = post_chat(chat_url(), body, key, timeout)
        except urllib.error.HTTPError as err:
            if err.code == 400 and body.get("response_format"):
                body = dict(body)
                body.pop("response_format", None)
                try:
                    raw = post_chat(chat_url(), body, key, timeout)
                except (urllib.error.URLError, TimeoutError, json.JSONDecodeError):
                    self._json(502, {"ok": False, "reason": "llm"})
                    return
            else:
                self._json(502, {"ok": False, "reason": "llm"})
                return
        except (urllib.error.URLError, TimeoutError, json.JSONDecodeError):
            self._json(502, {"ok": False, "reason": "llm"})
            return
        text = ""
        try:
            text = raw["choices"][0]["message"]["content"]
        except (KeyError, IndexError, TypeError):
            text = ""
        if self.path == "/report":
            self._json(200, {"ok": True, "text": (text or "").strip()})
            return
        parsed = extract_json(text)
        if not parsed:
            parsed = {"say": (text or "").strip(), "needsApproval": False, "request": None}
        self._json(200, {"ok": True, "result": parsed})

    def _json(self, code: int, payload: dict) -> None:
        blob = json.dumps(payload).encode("utf-8")
        self.send_response(code)
        self.send_header("Content-Type", "application/json")
        self._cors()
        self.end_headers()
        self.wfile.write(blob)


def empty_store() -> dict:
    return {
        "updated": "",
        "plans": {},
        "clinicians": {"accounts": []},
        "inbox": {"clinic": [], "patients": {}},
        "buddy": {"threads": {}},
        "reports": {},
    }


def read_store() -> dict:
    if not os.path.isfile(STORE_PATH):
        return empty_store()
    try:
        with open(STORE_PATH, encoding="utf-8") as fh:
            data = json.load(fh)
    except (OSError, json.JSONDecodeError):
        return empty_store()
    base = empty_store()
    if isinstance(data, dict):
        base.update({key: data[key] for key in base if key in data})
        if not isinstance(base.get("plans"), dict):
            base["plans"] = {}
        if not isinstance(base.get("clinicians"), dict):
            base["clinicians"] = {"accounts": []}
    return base


def write_store(data: dict) -> dict:
    payload = empty_store()
    payload.update(data or {})
    payload["updated"] = __import__("datetime").datetime.utcnow().strftime("%Y-%m-%dT%H:%M:%SZ")
    folder = os.path.dirname(STORE_PATH)
    if folder:
        os.makedirs(folder, exist_ok=True)
    tmp = STORE_PATH + ".tmp"
    with open(tmp, "w", encoding="utf-8") as fh:
        json.dump(payload, fh, ensure_ascii=False)
    os.replace(tmp, STORE_PATH)
    return payload


def merge_store(base: dict, incoming: dict) -> dict:
    out = empty_store()
    out.update(base or {})
    src = incoming or {}
    plans = dict(out.get("plans") or {})
    for code, plan in (src.get("plans") or {}).items():
        if not isinstance(plan, dict):
            continue
        old = plans.get(code)
        if not old or str(plan.get("updated") or "") >= str(old.get("updated") or ""):
            plans[code] = plan
    out["plans"] = plans
    accounts = {(row.get("id") or ""): row for row in ((out.get("clinicians") or {}).get("accounts") or []) if isinstance(row, dict)}
    for row in ((src.get("clinicians") or {}).get("accounts") or []):
        if isinstance(row, dict) and row.get("id"):
            accounts[row["id"]] = row
    out["clinicians"] = {"accounts": list(accounts.values())}
    inbox = out.get("inbox") if isinstance(out.get("inbox"), dict) else {"clinic": [], "patients": {}}
    other = src.get("inbox") if isinstance(src.get("inbox"), dict) else {}
    out["inbox"] = merge_inbox(inbox, other)
    buddy = out.get("buddy") if isinstance(out.get("buddy"), dict) else {"threads": {}}
    extra = src.get("buddy") if isinstance(src.get("buddy"), dict) else {}
    threads = dict((buddy.get("threads") or {}))
    for key, thread in (extra.get("threads") or {}).items():
        if key not in threads:
            threads[key] = thread
        elif isinstance(thread, dict) and isinstance(threads[key], dict):
            threads[key] = thread
    out["buddy"] = {"threads": threads}
    reports = dict(out.get("reports") or {})
    reports.update(src.get("reports") or {})
    out["reports"] = reports
    return out


def merge_inbox(left: dict, right: dict) -> dict:
    def merge_list(a, b):
        seen = set()
        rows = []
        for item in list(a or []) + list(b or []):
            if not isinstance(item, dict):
                continue
            key = item.get("id") or json.dumps(item, sort_keys=True)
            if key in seen:
                continue
            seen.add(key)
            rows.append(item)
        rows.sort(key=lambda item: str(item.get("at") or ""), reverse=True)
        return rows[:400]

    patients = dict((left.get("patients") or {}))
    for key, rows in ((right.get("patients") or {}).items()):
        patients[key] = merge_list(patients.get(key), rows)
    return {"clinic": merge_list(left.get("clinic"), right.get("clinic")), "patients": patients}


def post_chat(url: str, body: dict, key: str, timeout: int) -> dict:
    req = urllib.request.Request(
        url,
        data=json.dumps(body).encode("utf-8"),
        headers={"Content-Type": "application/json", "Authorization": "Bearer " + key},
        method="POST",
    )
    with urllib.request.urlopen(req, timeout=timeout) as res:
        return json.loads(res.read().decode("utf-8"))


def kale_messages(payload: dict) -> list:
    facts = payload.get("context") or {}
    side = payload.get("side") or "patient"
    who = "a clinician" if side == "clinic" else "the patient"
    messages = [
        {
            "role": "system",
            "content": system_prompt()
            + "\nYou are chatting with "
            + who
            + ".\nLive facts JSON:\n"
            + json.dumps(facts, ensure_ascii=False)
            + "\nmedical_notes JSON:\n"
            + json.dumps(payload.get("medical") or [], ensure_ascii=False),
        }
    ]
    for row in payload.get("history") or []:
        if not isinstance(row, dict):
            continue
        text = str(row.get("text") or row.get("content") or "").strip()
        if not text:
            continue
        role = str(row.get("role") or "").lower()
        messages.append(
            {
                "role": "assistant" if role in ("kale", "buddy", "assistant", "bot") else "user",
                "content": text,
            }
        )
    messages.append({"role": "user", "content": str(payload.get("message") or "").strip() or "Hi"})
    return messages


def extract_json(text: str) -> dict | None:
    blob = (text or "").strip()
    if blob.startswith("```"):
        blob = blob.strip("`")
        if blob.startswith("json"):
            blob = blob[4:]
        blob = blob.strip()
    start = blob.find("{")
    end = blob.rfind("}")
    if start < 0 or end <= start:
        return None
    try:
        data = json.loads(blob[start : end + 1])
    except json.JSONDecodeError:
        return None
    return data if isinstance(data, dict) else None


if __name__ == "__main__":
    server = ThreadingHTTPServer((HOST, PORT), Handler)
    try:
        server.serve_forever()
    except KeyboardInterrupt:
        pass
