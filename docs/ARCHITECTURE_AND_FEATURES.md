# Architecture & Features Overview: PROGRESSIQ

## 1. System Architecture

PROGRESSIQ follows a modern, decoupled client-server architecture.

### 1.1. Frontend (Client)
- **Framework:** React 19 with Vite.
- **Language:** TypeScript for type safety and better developer experience.
- **Styling:** TailwindCSS 4 for utility-first styling and responsive design.
- **Routing:** React Router DOM.
- **Data Visualization:** Recharts for rendering dashboard analytics, progress variance, and risk charts.
- **Linting:** Oxlint for fast, modern linting.

### 1.2. Backend (Server)
- **Framework:** FastAPI (Python), providing high performance and auto-generated OpenAPI documentation.
- **Database ORM:** SQLAlchemy for mapping Python models to relational database tables.
- **Database Schema:** Uses a robust relational model to track Projects, Schedule Activities, Field Reports, Extracted Updates, Activity Matches, Review Decisions, and Risks.
- **AI Integration:** An AI Provider Abstraction Layer supporting seamless switching between a built-in Mock provider (for testing/demo) and Google Gemini API, allowing extraction of structured progress data, material updates, and safety hazards.

## 2. Core Workflows

### 2.1. The AI Extraction Workflow
1. **Ingestion:** A user uploads a field report (e.g., a daily PDF log).
2. **Parsing:** The backend extracts the raw text from the file.
3. **Extraction:** The raw text is sent to the configured AI Provider (e.g., Mock, Gemini). It returns structured JSON containing multiple `ExtractedUpdate` objects, including detected progress, delays, risks, material updates, safety hazards, and actionable recommendations.
4. **Storage:** The raw updates are saved in the database, linked to the original field report.

### 2.2. The Semantic Matching Workflow
1. **Embedding/Search:** Once updates are extracted, the system compares the extracted activity description against the existing `ScheduleActivity` records for the project.
2. **Scoring:** The system generates a confidence score for potential matches.
3. **Queueing:** Matches are placed into an `ActivityMatch` queue with a status of `PENDING` or `NEEDS_REVIEW`.
4. **Human Review:** A project manager reviews the queue. They can approve the AI's top match, or select from alternative matches if the AI was incorrect.
5. **Update Execution:** Upon approval, the actual progress, dates, and status of the matched `ScheduleActivity` are updated to reflect the field report.

## 3. Data Models Reference

- **Project:** The root entity containing timeline and metadata.
- **ScheduleActivity:** The hierarchical tasks (L1-L6) that make up the project plan.
- **FieldReport:** The uploaded raw documents from the construction site.
- **ExtractedUpdate:** The granular pieces of information pulled from a Field Report by the AI.
- **ActivityMatch:** The junction between an Extracted Update and a Schedule Activity, containing the AI confidence score and human review decision.
- **Risk:** Flagged issues that threaten the schedule, complete with mitigation recommendations.
