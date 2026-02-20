# Medical RAG Project

This project consists of a FastAPI backend and a React frontend.

## Prerequisites

- Python 3.10+
- Node.js 18+
- npm or yarn

## Backend Setup

1.  Navigate to the backend directory:
    ```bash
    cd rag_med_backend
    ```

2.  Create a virtual environment:
    ```bash
    python3 -m venv .venv
    source .venv/bin/activate
    ```

3.  Install dependencies:
    ```bash
    pip install -r requirements.txt
    ```

4.  Set up environment variables:
    - Copy `.env.example` to `.env` in the root directory (parent of `rag_med_backend`) or inside `rag_med_backend` depending on where you run it from. Ideally, keep it in the root or symlink it.
    - The backend looks for `.env` in the current working directory.

5.  Run the server:
    ```bash
    uvicorn server:app --reload --port 8000
    ```
    The API will be available at `http://localhost:8000`.

## Frontend Setup

1.  Navigate to the frontend directory:
    ```bash
    cd rag_med_frontend
    ```

2.  Install dependencies:
    ```bash
    npm install
    ```

3.  Run the development server:
    ```bash
    npm run dev
    ```
    The application will be available at `http://localhost:5173`.
