# Development & Deployment Guide

## Setup

### Backend (FastAPI)
1. Navigate to the `backend` directory.
2. Install dependencies: `pip install -r requirements.txt` (or use a virtual environment).
3. Start the server:
   ```bash
   uvicorn server:app --reload --port 8000
   ```
4. *Optional*: Set `MONGO_URL` to a valid MongoDB connection string. If omitted, the backend will run using an in-memory database suitable for local testing.

### Frontend (React)
1. Navigate to the `frontend` directory.
2. Install dependencies: `npm install`
3. Start the development server:
   ```bash
   npm start
   ```
4. The frontend will run on `http://localhost:3000`. Set `REACT_APP_BACKEND_URL` in `.env` if your backend is running on a different host/port.

## Running Tests
Tests are located in `backend/tests/`.
1. Ensure you have `pytest` and `requests` installed in your environment.
2. The tests include integration tests that require the backend server to be running.
3. Start the backend server on port `8001` (or your chosen port):
   ```bash
   uvicorn server:app --port 8001
   ```
4. Run tests:
   ```bash
   pytest
   ```

## Production Deployment

### Backend
1. **Environment Variables**:
   - `ENVIRONMENT=production` (Crucial: prevents silent fallback to in-memory DB)
   - `MONGO_URL` (Required in production)
   - `DB_NAME` (Optional, defaults to baseline_dev)
   - `FRONTEND_URL` (For CORS, e.g., https://baselinework.app)
2. **Server**: Run with a production ASGI server like `gunicorn` with `uvicorn` workers.
   ```bash
   gunicorn server:app -k uvicorn.workers.UvicornWorker -c gunicorn_conf.py
   ```

### Frontend
1. Build the static assets:
   ```bash
   npm run build
   ```
2. Deploy the `build/` folder to any static hosting provider (Vercel, Netlify, S3, etc.). Ensure rewrite rules are configured to serve `index.html` for all unknown paths to support React Router.
