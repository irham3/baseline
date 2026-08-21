"""Force the in-process TestClient suite onto in-memory storage.

Motor's AsyncIOMotorClient is bound to the event loop it was created on; pytest's
TestClient gives many small tests their own event loop each, so sharing one real
MongoDB connection across them intermittently breaks with "Event loop is closed".
Real MongoDB connectivity is still exercised end-to-end by backend_test.py, which
talks HTTP to one long-lived uvicorn process (a single event loop for the whole run).

This must run before any test module imports `core`/`server`, so it lives in
conftest.py (collected first) rather than in individual test files.
"""
import os

os.environ["MONGO_URL"] = ""
