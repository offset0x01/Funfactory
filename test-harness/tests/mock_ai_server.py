#!/usr/bin/env python3
"""Offline stand-in for LiteLLM (chat/completions) and Jev (systemone), for testing the harness plumbing
without spending anything. It "decides" with a tiny rule: jump if something is in the way, else walk right.

  python3 test-harness/tests/mock_ai_server.py 8765 &
  LITELLM_BASE_URL=http://127.0.0.1:8765/v1 ENUM_MODEL=mock JEV_URL=http://127.0.0.1:8765/api/v1/systemone JEV_API_KEY=x \\
    python3 test-harness/harness/run_tests.py bots path/to/index.html --bots jev,enum,llm
"""
import json
import sys
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer


def pick(screen: str) -> str:
    rows = [r for r in screen.splitlines() if r and set(r) <= set(".#=<>^vGRJ*BDC@")]
    for y, row in enumerate(rows):
        x = row.find("@")
        if x < 0:
            continue
        ahead = row[x + 1:x + 3]
        below = rows[y + 1][x + 1:x + 4] if y + 1 < len(rows) else ""
        if any(c in ahead for c in "#RJ^v") or ("." in below and "#" not in below[:1]) or "^" in below:
            return "right_jump"
        return "right"
    return "right"


class H(BaseHTTPRequestHandler):
    def log_message(self, *a):
        pass

    def _send(self, obj):
        b = json.dumps(obj).encode()
        self.send_response(200)
        self.send_header("Content-Type", "application/json")
        self.send_header("Content-Length", str(len(b)))
        self.end_headers()
        self.wfile.write(b)

    def do_POST(self):
        body = json.loads(self.rfile.read(int(self.headers.get("Content-Length", 0))) or b"{}")
        if self.path.endswith("/systemone"):
            screen = (body.get("state") or {}).get("screen", "")
            labels = list(body["questions"]["action"]["criteria"])
            c = pick(screen)
            probs = {l: (0.9 if l == c else 0.1 / (len(labels) - 1)) for l in labels}
            return self._send({"answers": {"action": {"type": "choice", "choice": c, "confidence": 0.9, "probabilities": probs}},
                               "model": "mock-jev", "usage": {"input_tokens": len(json.dumps(body)) // 4, "output_tokens": 5, "cost": 0.0000001}})
        if self.path.endswith("/chat/completions"):
            msgs = body.get("messages", [])
            text = msgs[-1]["content"] if msgs else ""
            if body.get("response_format"):
                content = json.dumps({"action": pick(text.split("Screen:")[-1])})
            else:
                content = "Keep walking right. Jump when a wall, enemy, gap or spikes are one or two tiles ahead. Grab the green can before tall walls."
            return self._send({"choices": [{"message": {"role": "assistant", "content": content}}],
                               "usage": {"prompt_tokens": len(text) // 4, "completion_tokens": 8}})
        self.send_response(404)
        self.end_headers()


if __name__ == "__main__":
    port = int(sys.argv[1]) if len(sys.argv) > 1 else 8765
    ThreadingHTTPServer(("127.0.0.1", port), H).serve_forever()
