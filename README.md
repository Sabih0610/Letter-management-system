# Correspondence Series Management System

Thread-based official correspondence platform with:
- incoming/outgoing exchanges in a single series timeline
- daily-reset outgoing numbering (`CC/YYYYMMDD/01`)
- automatic diary numbering (`DIA/YYYYMMDD/0001`)
- approvals, dispatch tracking, attachments, search, reports, dashboard
- AI drafting flow scaffold (context builder + draft generation endpoint)

## Stack

- Frontend: React + Vite + Tailwind CSS
- Backend: FastAPI (Python) + Supabase Postgres (via SQLAlchemy async)
- Auth: JWT + role-based checks
- Storage: local uploads (default) or Supabase storage bucket

## Project Structure

```text
.
|-- client/                    # React app
|-- server/                    # FastAPI app
|   |-- app/
|   |   |-- api/v1/endpoints/  # module routes
|   |   |-- core/              # config/security/deps
|   |   |-- db/                # base/session
|   |   |-- models/            # DB models
|   |   |-- schemas/           # Pydantic DTOs
|   |   `-- services/          # numbering/audit/ai/storage logic
|   `-- scripts/seed_defaults.py
`-- README.md
```

## Backend Setup

1. Create env file:
   - copy `server/.env.example` to `server/.env`
   - set `DATABASE_URL` to your Supabase Postgres URL
2. Create virtual env and install:
   ```bash
   cd server
   python -m venv .venv
   .venv\Scripts\activate
   pip install -r requirements.txt
   ```
3. Seed defaults:
   ```bash
   python scripts/seed_defaults.py
   ```
4. Run API:
   ```bash
   uvicorn app.main:app --reload --host 0.0.0.0 --port 8000
   ```

## Frontend Setup

1. Create env file:
   - copy `client/.env.example` to `client/.env`
2. Install and run:
   ```bash
   cd client
   npm install
   npm run dev
   ```

## Default Login

- Email: `admin@example.com`
- Password: `ChangeMe123!`

## Implemented MVP Coverage

- Auth/login/me, RBAC checks
- Category/department/settings management
- Series creation and closing
- Incoming and outgoing item entry in existing series
- Automatic series/diary/letter numbering
- Timeline view per series
- AI drafting tab flow (context options + generated draft)
- Editable draft editor with version label workflow
- Attachment uploads
- Approval submission and history
- Dispatch detail storage (by hand/courier/email)
- Dashboard summaries and category containers
- Global search and summary reports
- Audit log endpoint

## Notes

- AI drafting now uses Gemini and stored extraction context.
- OCR steps are optional runtime enhancements; if OCR engine is absent, draft generation still works from available extracted/thread text.

## AI + Document Intelligence (Implemented)

- Gemini API integration (`GEMINI_API_KEY`, `GEMINI_MODEL`, `GEMINI_API_BASE`)
- Upload-time extraction pipeline:
  - PDF text extraction
  - DOC/DOCX extraction
  - EML/email body extraction
  - image OCR (`pytesseract`) when supported
  - scanned PDF OCR fallback when OCR runtime is available
- Stored extraction records in `document_texts`
- Context-aware draft generation:
  - selected letter full text
  - previous thread context with scope controls
  - last 2-3 full exchanges
  - summary of older exchanges
  - prompt + tone + purpose + legal angle
- AI context preview in outgoing drafting UI

## OCR Note

For OCR to work locally, install Tesseract OCR binary and ensure it is in PATH.  
Without it, non-image extraction still works and OCR steps fall back gracefully.
