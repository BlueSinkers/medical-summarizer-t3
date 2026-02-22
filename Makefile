.PHONY: setup api web

setup:
	python3 -m venv .venv
	. .venv/bin/activate && pip install -r apps/api/requirements.txt
	cd apps/web && npm install

api:
	cd apps/api && uvicorn server:app --reload --port 8000

web:
	cd apps/web && npm run dev
