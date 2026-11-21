"""Shared Playwright launcher. Uses $CHROME_PATH if set, else Playwright's bundled Chromium
(install once with: pip install playwright && playwright install chromium)."""
import os

def launch_opts(extra_args=None):
    opts = {"args": ["--no-sandbox"] + (extra_args or [])}
    cp = os.environ.get("CHROME_PATH")
    if cp: opts["executable_path"] = cp
    return opts

def base_url(argv, default="http://127.0.0.1:8080"):
    for a in argv[1:]:
        if not a.startswith("--"): return a.rstrip("/")
    return os.environ.get("BASE_URL", default).rstrip("/")
