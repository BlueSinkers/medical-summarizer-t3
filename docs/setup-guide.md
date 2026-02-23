# Medical Summarizer - Local Setup Guide

This guide walks you through setting up and running the Medical Summarizer project locally from scratch. Follow every step in order.

---

## Prerequisites

Make sure you have the following installed before starting:

- [Anaconda](https://www.anaconda.com/download) — for managing the Python environment
- [Node.js](https://nodejs.org) (v18 or higher) — for running the frontend
- [Git](https://git-scm.com) — for cloning the repo
- [Ollama](https://ollama.com) — for running the LLM locally. You can install it via PowerShell:
  ```powershell
  irm https://ollama.com/install.ps1 | iex
  ```

---

## Step 1 — Clone the Repository

Open a PowerShell terminal and run:

```powershell
git clone https://github.com/BlueSinkers/medical-summarizer-t3.git
cd medical-summarizer-t3
git switch cursor/repository-explanation-937c
git reset --hard origin/cursor/repository-explanation-937c
```

---

## Step 2 — Set Up Environment Variables

```powershell
Copy-Item .env.example .env -Force
```

Open the `.env` file and fill in any required API keys or configuration values before proceeding.

---

## Step 3 — Set Up the Python (Conda) Environment

This project uses Conda for Python environment management. An `environment.yml` file is included in the root of the repository so you can recreate the exact environment with a single command — no manual pip installs needed.

### Option A — Recommended: Use the environment.yml file (fastest)

```powershell
conda env create -f environment.yml
conda activate medical-summarizer
```

This will install all dependencies at the exact versions the project was built and tested with.

### Option B — Manual setup (if environment.yml doesn't work for some reason)

```powershell
conda create -n medical-summarizer python=3.11
conda activate medical-summarizer
pip install --upgrade pip
pip install -r apps/api/requirements.txt
```

> **Important note on PyTorch:** This project intentionally uses the CPU-only version of PyTorch so it runs on machines without a GPU. If you have a GPU and want to use it for other projects, that's fine — this conda environment is isolated and will not affect other environments on your machine.

---

## Step 4 — Pull the LLM Model via Ollama

In any terminal (the folder you're in doesn't matter):

```powershell
ollama pull llama3.2
```

This downloads the llama3.2 model (~2GB) which the app uses for generating summaries and chat responses. Ollama runs automatically as a background service after installation, so you do **not** need to run `ollama serve` manually — it's already running.

Verify Ollama is up:
```powershell
curl http://localhost:11434/api/tags
```

You should get a JSON response back listing your downloaded models.

---

## Step 5 — Run Everything

You need **3 things running simultaneously.** Open separate terminal windows for each.

### Terminal 1 — Backend (FastAPI)

```powershell
conda activate medical-summarizer
cd path\to\medical-summarizer-t3\apps\api
python -m uvicorn server:app --reload --port 8000
```

Leave this running. To stop it press `Ctrl+C`. If that doesn't work, force kill it:
```powershell
netstat -ano | findstr :8000
taskkill /PID <PID number from above> /F
```

### Terminal 2 — Frontend (Next.js)

```powershell
cd path\to\medical-summarizer-t3\apps\web
npm install
npm run dev
```

Leave this running.

### Terminal 3 — Ollama

Ollama is already running as a background service. No action needed here. You can verify with:
```powershell
ollama list
```

---

## Step 6 — Open the App

Once all three are running, open your browser and go to:

```
http://localhost:5173
```

To verify the backend is healthy:
```
http://localhost:8000/health
```

You should get a JSON response back from the health check.

---

## Common Issues

### `WinError 1114` / DLL error with PyTorch
This usually means Anaconda base and a `.venv` virtual environment are conflicting with each other. Always use the conda environment for this project and avoid mixing it with a `.venv`.

### `ollama serve` error: address already in use
Ollama is already running in the background — this is completely fine, just ignore this error.

### `||` is not a valid statement separator
This is bash syntax and does not work in PowerShell. Use the PowerShell-native commands shown in this guide.

### 404 on `localhost:8000`
The backend has no root `/` route — this is normal. Hit `http://localhost:8000/health` instead to verify it's running correctly.

### Frontend not loading
Make sure both Terminal 1 (backend) and Terminal 2 (frontend) are running at the same time. The app needs both to function.

---

## For Contributors — Keeping the Environment File Up to Date

If you add new dependencies to the project, please regenerate and commit the `environment.yml` file so teammates stay in sync:

```powershell
conda activate medical-summarizer
cd path\to\medical-summarizer-t3
conda env export --no-builds > environment.yml
git add environment.yml
git commit -m "update conda environment file"
git push
```

The `--no-builds` flag makes the file cross-platform compatible so it works on Mac and Linux as well as Windows.
