"""Infra tests: production must not silently fall back to in-memory storage, and the
health endpoint must report readiness without leaking secrets (Phase 7)."""
import os
import sys
import subprocess

os.environ.setdefault("JWT_SECRET", "test-secret-do-not-use-in-prod")
os.environ.setdefault("ENVIRONMENT", "test")

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from fastapi.testclient import TestClient
import server

client = TestClient(server.app)


def test_health_reports_environment_db_and_llm_without_secrets():
    r = client.get("/api/health")
    assert r.status_code == 200
    body = r.json()
    assert body["status"] == "ok"
    assert body["environment"] == "test"
    assert body["database"]["mode"] in ("mongo", "memory")
    assert isinstance(body["database"]["configured"], bool)
    assert isinstance(body["llm"]["configured"], bool)
    dumped = str(body)
    assert "mongodb://" not in dumped
    assert "JWT_SECRET" not in dumped


def test_production_without_mongo_url_fails_fast_on_import():
    backend_dir = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
    env = {**os.environ, "ENVIRONMENT": "production", "JWT_SECRET": "prod-test-secret"}
    # Set (not remove) an empty value: a local backend/.env may legitimately define
    # MONGO_URL for dev, and load_dotenv() only fills in keys that are *absent* from
    # os.environ, so simply popping the key would let the real .env value leak back in.
    env["MONGO_URL"] = ""
    result = subprocess.run(
        [sys.executable, "-c", "import core"],
        cwd=backend_dir, env=env, capture_output=True, text=True, timeout=30,
    )
    assert result.returncode != 0
    assert "MONGO_URL" in result.stderr
