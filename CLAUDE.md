# Claude Code Project Instructions

## Python Environment
- Always use conda environment `gym-tracker` when running Python
- Command pattern: `conda run -n gym-tracker <command>` or `conda activate gym-tracker`
- Backend working directory: `backend/`

## Key Commands
- Run backend: `conda run -n gym-tracker uvicorn app.main:app --reload` (from backend/)
- Run tests: `conda run -n gym-tracker python -m pytest tests/ -v` (from backend/)
- Install deps: `conda run -n gym-tracker pip install -r requirements.txt`
