<img width="1543" height="817" alt="igmatest123" src="https://github.com/user-attachments/assets/66f3d26e-f44a-44b0-8971-40b4c3e4d280" />
# IGMA Chatbot (UE Assistant)

IGMA Chatbot is a React + Vite chatbot that answers University of the East questions using a Retrieval-Augmented Generation (RAG) pipeline backed by Supabase vector search and Gemini models.

## Features

- Responsive chat interface with splash screen and dark mode.
- RAG-based answers grounded on your UE documents.
- Supabase RPC retrieval via `match_chunks`.
- Gemini embeddings + Gemini chat generation.
- Document ingestion script for `.txt`, `.md`, and `.docx`.

## Tech Stack

- Frontend: React, Vite, Tailwind CSS
- AI: Google Gemini (`@google/genai`)
- Database: Supabase Postgres + pgvector
- Parsing/Ingestion: Node.js + Mammoth (`.docx`)

## Project Structure

```text
igma-chatbot
├─ docs/                       # Source files to ingest (.txt/.md/.docx)
├─ scripts/
│  ├─ process-docs.js          # Old/incomplete script (kept for reference)
│  └─ process-docs-v2.js       # Current ingestion script
├─ src/
│  ├─ App.jsx
│  ├─ Services/
│  │  └─ geminiAPI.js          # Main RAG + generation pipeline
│  └─ components/
│     ├─ ChatInput.jsx
│     ├─ ChatMessage.jsx
│     ├─ Header.jsx
│     ├─ LoaderChat.jsx
│     └─ SplashScreen.jsx
├─ utils/
│  └─ chatUtils.js
└─ package.json
```

## Prerequisites

- Node.js 18+
- A Supabase project with pgvector enabled
- A Gemini API key

## Environment Variables

Create a `.env` file in the project root:

```env
# Frontend
VITE_GEMINI_API_KEY=your_gemini_key
VITE_SUPABASE_URL=https://your-project.supabase.co
VITE_SUPABASE_ANON_KEY=your_supabase_anon_key

# Ingestion script (server-side)
GEMINI_API_KEY=your_gemini_key
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_SERVICE_ROLE_KEY=your_supabase_service_role_key

# Optional ingestion tuning
DOCS_DIR=./docs
CHUNK_SIZE=1200
CHUNK_OVERLAP=180
```

## Database Setup

### 1) Table

Use a table like this:

```sql
create table public.chatbot_chunks (
  id bigserial primary key,
  doc_name text not null,
  chunk_index integer not null,
  content text not null,
  embedding vector,
  created_at timestamptz default now(),
  updated_at timestamptz default now(),
  constraint chatbot_chunks_doc_name_chunk_index_unique unique (doc_name, chunk_index)
);
```

### 2) Retrieval Function

Use your `match_chunks` function:

```sql
create or replace function public.match_chunks(
  query_embedding vector,
  match_threshold float default 0.3,
  match_count int default 5
)
returns table (
  id bigint,
  doc_name text,
  chunk_index int,
  content text,
  similarity float
)
language plpgsql
security invoker
set search_path = public
as $$
declare
  safe_threshold float := greatest(0.0, least(match_threshold, 1.0));
  safe_count int := greatest(1, least(match_count, 20));
begin
  return query
  select
    c.id,
    c.doc_name,
    c.chunk_index,
    c.content,
    1 - (c.embedding <=> query_embedding) as similarity
  from public.chatbot_chunks c
  where c.embedding is not null
    and 1 - (c.embedding <=> query_embedding) >= safe_threshold
  order by c.embedding <=> query_embedding
  limit safe_count;
end;
$$;

grant execute on function public.match_chunks(vector, float, int) to anon, authenticated;
```

## Installation

```bash
npm install
```

## Run the App

```bash
npm run dev
```

## Ingest Documents into Vector DB

Put your files in `docs/`, then run:

```bash
npm run ingest:docs
```

This runs `scripts/process-docs-v2.js` and will:

- read supported files recursively
- normalize and chunk text
- embed each chunk
- upsert into `chatbot_chunks` by `doc_name, chunk_index`
- remove stale chunks for updated docs

## How the RAG Flow Works

1. User sends a question.
2. `geminiAPI.js` creates an embedding for the question.
3. App calls Supabase RPC `match_chunks`.
4. Top chunks are merged into context.
5. Confidence-aware prompt policy is applied.
6. Gemini generates a final response.

## Scripts

- `npm run dev` - start local Vite dev server
- `npm run build` - build production bundle
- `npm run preview` - preview production build
- `npm run lint` - run ESLint
- `npm run ingest:docs` - process docs and upsert vectors

## Troubleshooting

- `Failed to fetch` / `ERR_CONNECTION_CLOSED`
  - Check internet/firewall and retry.
  - Verify API keys and billing status.
- `No Gemini API key found`
  - Ensure `.env` has correct key names.
- No retrieval results
  - Confirm docs were ingested successfully.
  - Check `chatbot_chunks` has rows with non-null embeddings.
- Script auth issues
  - Use `SUPABASE_SERVICE_ROLE_KEY` for ingestion script only.
  - Do not expose service role key in frontend.

## Security Notes

- Frontend must use `VITE_SUPABASE_ANON_KEY`.
- Never use service role key in browser code.
- Keep service role key only in local/server-side scripts.

## License

Private project for IGMA chatbot development.
