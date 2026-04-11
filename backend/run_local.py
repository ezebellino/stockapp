from __future__ import annotations

import os
import threading
import time
import urllib.request
import webbrowser

import uvicorn
from app.logging_config import get_logger
from app.main import app


HOST = os.environ.get("APPSTOCK_HOST", "127.0.0.1")
PORT = int(os.environ.get("APPSTOCK_PORT", "8001"))
APP_URL = f"http://{HOST}:{PORT}"
LOGGER = get_logger("run_local")


def wait_and_open_browser() -> None:
    health_url = f"{APP_URL}/health"
    for _ in range(60):
        try:
            with urllib.request.urlopen(health_url, timeout=1):
                webbrowser.open(APP_URL)
                return
        except Exception:
            time.sleep(0.5)


if __name__ == "__main__":
    LOGGER.info("Iniciando AppStockLocal en %s", APP_URL)
    threading.Thread(target=wait_and_open_browser, daemon=True).start()
    uvicorn.run(app, host=HOST, port=PORT, reload=False, log_config=None, access_log=False)
