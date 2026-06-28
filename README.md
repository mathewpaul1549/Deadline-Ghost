# 👻 Deadline Ghost

**Your AI Accountability Partner that haunts you until you finish.**

Built for Vibe2Ship Hackathon 2026 — PS1: The Last-Minute Life Saver

---

## What it does

Deadline Ghost is an AI-powered productivity companion with a shifting personality. It doesn't just remind you — it **haunts** you.

- **Unpredictable personality** that shifts based on urgency (Chill → Watchful → Haunting → Possession → Aftermath)
- **Autonomous task breakdown** — AI breaks any task into 5 micro-steps
- **Proactive check-ins** — Ghost appears randomly, you don't have to open the app
- **Recovery plans** — falling behind? Ghost builds you a sprint plan
- **Mood aura** — visual ghost glow changes color with urgency level

---

## Tech Stack

- **Backend:** Node.js + Express
- **AI:** Google Gemini 2.5 Flash via Google AI Studio API
- **Frontend:** Vanilla HTML/CSS/JS
- **Deployment:** Google Cloud Run

---

## Local Setup

### 1. Clone the repo
```bash
git clone https://github.com/mathewpaul1549/Deadline-Ghost.git
cd Deadline-Ghost
```

### 2. Install dependencies
```bash
npm install
```

### 3. Set up environment variables
```bash
cp .env.example .env
```
Edit `.env` and add your Gemini API key from [Google AI Studio](https://aistudio.google.com):
```
GEMINI_API_KEY=your_key_here
```

### 4. Run locally
```bash
npm start
```
Open [http://localhost:3000](http://localhost:3000)

---

## Deploy to Google Cloud Run

### Prerequisites
- [Google Cloud CLI](https://cloud.google.com/sdk/docs/install) installed
- A GCP project with billing enabled

### Steps

```bash
# Login to GCP
gcloud auth login

# Set your project
gcloud config set project YOUR_PROJECT_ID

# Build and deploy
gcloud run deploy deadline-ghost \
  --source . \
  --region asia-south1 \
  --allow-unauthenticated \
  --set-env-vars GEMINI_API_KEY=your_key_here
```

---

## Google Technologies Used

- **Google AI Studio** — Prompt engineering and API key management
- **Gemini 2.0 Flash API** — Powers all AI features (chat, breakdown, check-ins, recovery plans)
- **Google Cloud Run** — Serverless deployment

---

## Features in Detail

| Feature | Description |
|---|---|
| Task Management | Add tasks with deadlines and descriptions |
| Urgency Engine | Auto-calculates urgency: Low / Medium / High / Critical / Overdue |
| AI Breakdown | Gemini breaks any task into 5 actionable micro-steps |
| Ghost Chat | Conversational AI with persona that shifts based on urgency |
| Proactive Check-ins | Random unprompted haunts via toast notifications |
| Recovery Plan | AI-generated sprint plan when you're falling behind |
| Mood Aura | Animated glow around Ghost avatar that reflects urgency |

---

## Evaluation Alignment

| Criteria | How we address it |
|---|---|
| Problem Solving & Impact | Directly solves deadline anxiety and task avoidance |
| Agentic Depth | Autonomous check-ins, auto-breakdown, proactive recovery plans |
| Innovation & Creativity | Shifting personality model is a novel accountability mechanic |
| Google Technologies | Gemini 2.0 Flash + Google AI Studio + Cloud Run |
| Product Experience | Dark haunted UI with animated ghost aura |
| Technical Implementation | Clean Express backend + Gemini API integration |
| Completeness | Fully functional end-to-end app |
