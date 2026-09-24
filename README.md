# DataPilot

AI-powered data intelligence platform for natural language data collection workflows.

## Project Structure

/ Root project directory layout for Node.js fullstack service components.

- `frontend/` - React + Vite + TypeScript web interface
- `backend/` - Node.js + Express + TypeScript REST API with BullMQ background worker
- `ai/` - LangGraph AI orchestration, web scrapers, and LLM integrations
- `db/` - Drizzle ORM database schemas and migration management

## Tech Stack

- Frontend: React, Vite, TypeScript, Tailwind CSS, shadcn/ui, TanStack Query, Zustand, Recharts
- Backend: Node.js, Express, TypeScript, Zod, BullMQ, Redis, RapidFuzz
- AI: LangGraph, Gemini, OpenAI, Tavily, Firecrawl, Playwright, BeautifulSoup
- Database: PostgreSQL, Drizzle ORM
- Authentication: Clerk

## Getting Started

/ Clone repository and configure environment variables.

1. Copy `.env.example` to `.env` and fill in required API keys.
2. Run infrastructure containers using Docker:
   `docker-compose up -d`

## Service Setup

- Frontend setup: see `frontend/README.md`
- Backend setup: see `backend/README.md`
- AI service setup: see `ai/README.md`
- Database setup: see `db/README.md`
