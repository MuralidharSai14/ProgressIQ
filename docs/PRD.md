# Product Requirements Document (PRD): PROGRESSIQ

## 1. Introduction
**PROGRESSIQ** is an AI-powered planning-to-execution bridge designed for infrastructure and construction projects. It acts as an intelligent system that connects planned schedules (activities, timelines) with actual field updates extracted from daily reports, using semantic AI matching.

## 2. Problem Statement
In large infrastructure projects, there is a disconnect between the master schedule (often managed in tools like Primavera P6 or MS Project) and actual progress reported by engineers in the field. Field reports are typically unstructured documents (PDFs, text files). Manually parsing these reports, identifying which schedule activity they refer to, and updating the progress is tedious, error-prone, and causes significant delays in project visibility.

## 3. Product Vision
To provide a seamless, automated workflow that digests unstructured field reports, uses AI to extract meaningful updates, matches them to the official project schedule, and provides an actionable dashboard with progress tracking and risk alerts.

## 4. Target Audience
- **Project Managers:** Need high-level visibility into project health, overall progress, and critical risks.
- **Schedulers / Planners:** Need accurate field data to update master schedules and calculate variance.
- **Field Engineers:** Submit field reports and need a system that easily processes their unstructured text without requiring manual data entry into complex scheduling software.

## 5. Key Features & Requirements

### 5.1. Project & Schedule Management
- **Project Setup:** Ability to create projects with details such as name, location, organization, and planned timelines.
- **Schedule Activities:** Support for hierarchical schedule activities (Level 1 to Level 6). Activities must track planned vs. actual start/finish dates, planned vs. actual progress, variance, dependencies, and milestone status.

### 5.2. Field Report Ingestion
- **Document Uploads:** Support for uploading field reports in formats like PDF, TXT, and CSV.
- **Raw Text Storage:** Store the raw parsed text and metadata (upload date, source label) for auditing.

### 5.3. AI Extraction Engine
- **Automated Parsing:** The system must automatically analyze the raw text of field reports.
- **Information Extraction:** AI must extract key details:
  - Activity description mentioned in the report
  - Progress percentages
  - Actual start/finish dates
  - Delay reasons and categories (e.g., Material, Labour, Weather)
  - Risk levels
  - Mentioned dependencies

### 5.4. Semantic Activity Matching
- **AI Matching:** Extracted updates must be semantically matched against the existing schedule activities.
- **Confidence Scoring:** Matches must include a confidence score (0-100%).
- **Review Workflow:** 
  - Matches require a human-in-the-loop review.
  - Reviewers can Approve, Reject, or Reassign matches to a different activity.
  - The system should suggest alternative matches if confidence is low.

### 5.5. Risk Management
- **Automated Risk Detection:** Flag risks automatically based on field report extractions (e.g., "Critical", "High", "Medium", "Low").
- **Risk Tracking:** Track risk descriptions, affected dependencies, and recommended actions until resolution.

### 5.6. Executive Dashboard
- **Health Indicators:** Display overall project health (On Track, At Risk, Delayed, Critical).
- **Progress Metrics:** Show planned vs. actual progress and progress variance.
- **Activity Status:** Breakdown of activities by status (On Track, Delayed, Critical).
- **Insights:** Highlight top delay reasons, upcoming milestones, and pending AI match reviews.

## 6. Non-Functional Requirements
- **Performance:** AI extraction and matching should return results promptly to avoid blocking the user experience.
- **Scalability:** The backend must handle large volumes of schedule activities and concurrent field report uploads.
- **Editability:** This document and other project documentation should reside in the `/docs` directory in a Markdown format, enabling easy updates using standard version control.

## 7. Future Enhancements
- Integration with external scheduling software APIs (e.g., Oracle Primavera P6, MS Project).
- Advanced historical trend analysis using predictive AI.
- Mobile application for field engineers to directly input structured updates.
