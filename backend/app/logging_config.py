from __future__ import annotations

import logging
from logging.handlers import RotatingFileHandler

from .runtime_paths import app_root

BASE_ROOT = app_root()
LOG_DIR = (BASE_ROOT / "backend" / "logs") if (BASE_ROOT / "backend").exists() else (BASE_ROOT / "logs")
LOG_FILE = LOG_DIR / "appstock.log"
LOGGER_NAME = "appstock"


def configure_logging() -> logging.Logger:
    LOG_DIR.mkdir(parents=True, exist_ok=True)
    logger = logging.getLogger(LOGGER_NAME)
    if logger.handlers:
        return logger

    logger.setLevel(logging.INFO)
    formatter = logging.Formatter("%(asctime)s | %(levelname)s | %(name)s | %(message)s")

    file_handler = RotatingFileHandler(LOG_FILE, maxBytes=1_048_576, backupCount=5, encoding="utf-8")
    file_handler.setFormatter(formatter)

    logger.addHandler(file_handler)
    logger.propagate = False
    logger.info("Logger inicializado. Archivo local: %s", LOG_FILE)
    return logger


def get_logger(name: str | None = None) -> logging.Logger:
    root_logger = configure_logging()
    return root_logger if not name else root_logger.getChild(name)
