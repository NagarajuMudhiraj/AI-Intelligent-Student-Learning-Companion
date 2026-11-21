# 🎓 AI – Intelligent Student Learning Companion

## 📌 Overview

An AI-powered Student Learning Companion designed to help students learn smarter, organize study materials, and interact with academic content through natural language. The platform combines **Generative AI, Retrieval-Augmented Generation (RAG), Vector Search, and Document Intelligence** to provide personalized, interactive learning assistance.

Students can upload study materials, chat with an AI assistant that cites their documents, generate interactive multiple-choice quizzes, create smart flashcards, receive AI-powered study schedules, explore career pathways, and track study analytics.

---

## 🚀 Features

### 📚 Smart Document Hub & RAG
* **Multi-Format Support:** Upload and parse `PDF`, `DOCX`, `PPTX`, and `TXT` files.
* **Automatic Chunking & Embeddings:** Documents are automatically split and vectorized using `gemini-embedding-2`.
* **ChromaDB Vector Store:** Fast semantic search across your personal academic library.
* **Context-Aware Answers:** AI responses grounded directly in your uploaded notes and textbooks.

### 🤖 AI Study Assistant
* Natural language conversation powered by Google Gemini.
* Subject-specific explanations, step-by-step problem solving, and concept clarification.
* Conversation session history management with semantic caching for fast responses.

### 📝 AI Quiz Generator
* Instantly generate custom multiple-choice quizzes directly from your uploaded materials or custom topics.
* Configurable difficulty levels (Easy, Medium, Hard).
* Instant answer evaluation, scoring, and detailed explanations for every question.

### 🗂️ Interactive Flashcards
* Automatically extract key concepts, definitions, and formulas into study flashcards.
* Interactive 3D flip card UI for spaced repetition and self-testing.
* Progress tracking and mastery status.

### 📅 AI Study Planner & Task Management
* Generate personalized, week-by-week study timetables based on your syllabus or exam dates.
* Task tracking with completion status, due dates, and priority levels.

### 💼 Career Pathway & Skill Advisor
* Analyzes your studied subjects and documents to recommend matching career options.
* Outlines recommended skills to acquire, industry outlooks, and actionable learning milestones.

### 📊 Learning Analytics & Dashboard
* Real-time metrics on documents uploaded, quizzes completed, questions answered, and accuracy rates.
* Visual study trends and weekly progress tracking.

### 📱 Progressive Web App (PWA)
* Installable directly on desktop and mobile devices (Android & iOS).
* Built-in service workers and offline asset caching.

---

## 🏗️ System Architecture

```text
[ React + Vite + Tailwind Frontend ]
                 │
                 │ HTTP / REST / JWT
                 ▼
[ FastAPI Backend (Python) ]
     │                 │
     │ LangChain       ├─► [ MongoDB / MongoMock Fallback ] (Users, Chats, Quizzes, Planner)
     │                 │
     ├─► [ ChromaDB ] (Vector Store for Document Chunks)
     │
     ▼
[ Google Gemini API ] (Gemini 3.5 Flash Lite & Gemini Embeddings)
```

---

## 🛠️ Technology Stack

### Frontend
* **Framework:** React 19, TypeScript, Vite
* **Styling:** Tailwind CSS, Lucide React icons
* **Routing & State:** React Router v7
* **Markdown & Syntax:** `react-markdown`, `react-syntax-highlighter`
* **PDF Export & Offline:** `jspdf`, `html2canvas`, Vite PWA (`vite-plugin-pwa`)
* **Auth Integration:** `@react-oauth/google`

### Backend
* **Server Framework:** FastAPI, Uvicorn
* **Database & ODM:** Motor (Async MongoDB Driver), PyMongo
* **In-Memory Fallback:** `mongomock-motor` (runs without external MongoDB installed)
* **Data Validation:** Pydantic v2, `pydantic-settings`, `email-validator`
* **Security & Auth:** Python-Jose (JWT), Passlib, Bcrypt

### AI & Vector Database
* **LLM Engine:** Google Gemini (`gemini-3.5-flash-lite` / `gemini-3.8-flash`) via `langchain-google-genai`
* **Embedding Model:** `models/gemini-embedding-2` (3072 dimensions)
* **Vector Store:** ChromaDB (Local persistent vector database)
* **Document Loaders:** PyMuPDF (`fitz`), `python-docx` / `docx2txt`, `python-pptx`

---

## 📂 Project Structure

```text
AI-Intelligent-Student-Learning-Companion/
│
├── frontend/
│   ├── public/                 # Favicons, PWA icons, manifest
│   ├── src/
│   │   ├── components/         # Reusable UI components & AuthGuard
│   │   ├── pages/              # Dashboard, Chat, Documents, Quizzes, Flashcards, Planner, etc.
│   │   ├── lib/                # API client & utilities
│   │   ├── App.tsx             # Application routing
│   │   └── main.tsx            # Entry point & Google OAuth Provider
│   ├── package.json
│   ├── vite.config.ts
│   └── .env                    # Frontend environment configuration
│
├── backend/
│   ├── app/
│   │   ├── api/                # API route controllers (auth, chat, documents, quiz, etc.)
│   │   ├── core/               # App configuration, security, LLM wrapper
│   │   ├── db/                 # MongoDB connection & in-memory fallback
│   │   ├── models/             # Pydantic schemas and database models
│   │   ├── services/           # RAG pipeline, ChromaDB store, semantic caching
│   │   └── main.py             # FastAPI entry point & CORS configuration
│   ├── requirements.txt
│   └── .env                    # Backend environment configuration
│
└── README.md
```

---

## ⚙️ Installation & Setup

### 1. Prerequisites
* **Python:** 3.10 or higher
* **Node.js:** v18 or higher (v20+ recommended)
* **npm:** v9 or higher
* **Google Gemini API Key:** Get a free key from [Google AI Studio](https://aistudio.google.com/)

---

### 2. Backend Setup

1. Open a terminal and navigate to `backend`:
   ```bash
   cd backend
   ```

2. Create and activate a Python virtual environment:
   * **Windows:**
     ```bash
     python -m venv venv
     venv\Scripts\activate
     ```
   * **macOS / Linux:**
     ```bash
     python3 -m venv venv
     source venv/bin/activate
     ```

3. Install the dependencies:
   ```bash
   pip install -r requirements.txt
   ```

4. Configure environment variables in `backend/.env`:
   ```env
   PROJECT_NAME="AI Student Companion"
   VERSION="1.0.0"
   API_V1_STR="/api/v1"

   # MongoDB (Leave as localhost or provide a MongoDB Atlas URI)
   # If no MongoDB is reachable, the backend automatically uses an in-memory database
   MONGODB_URL="mongodb://localhost:27017"
   DATABASE_NAME="aistudentdb"

   # Security
   SECRET_KEY="generate_a_random_32_byte_hex_string"
   ALGORITHM="HS256"
   ACCESS_TOKEN_EXPIRE_MINUTES=1440

   # Google AI
   GEMINI_API_KEY="your_actual_gemini_api_key_here"
   GOOGLE_CLIENT_ID="your_google_oauth_client_id.apps.googleusercontent.com"

   # CORS
   CORS_ORIGINS="http://localhost:5173,http://localhost,http://127.0.0.1:5173"
   ```

5. Run the backend server:
   ```bash
   uvicorn app.main:app --reload --host 127.0.0.1 --port 8000
   ```

   * **API Base:** [http://localhost:8000](http://localhost:8000)
   * **Swagger Interactive Docs:** [http://localhost:8000/docs](http://localhost:8000/docs)
   * **ReDoc API Specs:** [http://localhost:8000/redoc](http://localhost:8000/redoc)

---

### 3. Frontend Setup

1. Open a second terminal and navigate to `frontend`:
   ```bash
   cd frontend
   ```

2. Install dependencies:
   ```bash
   npm install
   ```

3. Configure environment variables in `frontend/.env`:
   ```env
   VITE_API_URL=http://localhost:8000/api/v1
   VITE_GOOGLE_CLIENT_ID=your_google_oauth_client_id.apps.googleusercontent.com
   ```

4. Start the Vite development server:
   ```bash
   npm run dev
   ```

   * **Frontend Application:** [http://localhost:5173](http://localhost:5173)

---

## 🎯 Use Cases

* **Interactive Document Study:** Upload long course materials or lecture slides and query them in plain English.
* **Instant Exam Prep:** Generate chapter-wise revision quizzes and practice key questions with instant feedback.
* **Quick Memorization:** Test yourself with auto-generated flip cards for formulas, vocabulary, and concepts.
* **Organized Revision Schedules:** Build structured weekly study timetables tailored to upcoming test dates.
* **Career Direction:** Align coursework with recommended future industries, job roles, and required technical skills.

---

## 👨‍💻 Developed By

**B. Nagaraju**  
B.Tech Computer Science and Engineering  
KLH University, Hyderabad  

---

## 📜 License

This project is licensed under the **MIT License**.
