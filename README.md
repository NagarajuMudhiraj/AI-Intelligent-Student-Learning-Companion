# 🎓AI – Intelligent Student Learning Companion

## 📌 Overview

An AI-powered Student Learning Companion designed to help students learn smarter, organize study materials, and interact with academic content through natural language. The platform combines **Generative AI, Retrieval-Augmented Generation (RAG), Vector Search, and Document Intelligence** to provide personalized learning assistance.

Students can upload study materials, ask questions, generate quizzes, summarize notes, and receive AI-powered explanations from their own documents.

---

## 🚀 Features

### 📚 Smart Document Hub & RAG

* Upload PDF, DOCX, PPTX, and TXT files
* Automatic document processing and chunking
* Vector embeddings generation
* ChromaDB-powered semantic search
* Context-aware question answering

### 🤖 AI Study Assistant

* Natural language conversations
* Context-aware responses
* Subject-specific explanations
* Concept clarification
* Academic doubt resolution

### 📝 AI Quiz Generator

* Generate quizzes from uploaded documents
* Multiple-choice questions
* Instant answer evaluation
* Learning assessment support

### 📄 Notes Summarization

* Automatic document summarization
* Key-point extraction
* Study notes generation
* Quick revision support

### 🔍 Intelligent Search

* Semantic search across uploaded materials
* Fast document retrieval
* Relevant context extraction

### 🎤 Voice Interaction

* Voice-based query support
* Speech-to-text integration
* Hands-free learning experience

### 📊 Learning Dashboard

* User-friendly interface
* Document management
* Study progress tracking
* Learning analytics

---

## 🏗️ System Architecture

Frontend → FastAPI Backend → Gemini AI API

```
                    ↓

             Document Processing

                    ↓

             Embeddings Generation

                    ↓

                 ChromaDB

                    ↓

             Context Retrieval

                    ↓

             AI Response Generation
```

---

## 🛠️ Technology Stack

### Frontend

* React.js
* TypeScript
* Vite
* Tailwind CSS
* HTML5
* CSS3
* JavaScript

### Backend

* Python
* FastAPI
* Uvicorn

### AI & Machine Learning

* Google Gemini API
* Gemini 2.5 Flash
* Gemini Embedding Models
* LangChain

### Vector Database

* ChromaDB

### Database

* MongoDB Atlas

### Authentication

* Google OAuth

### Additional Tools

* Git & GitHub
* REST APIs
* JWT Authentication
* Environment Variables

---

## 📂 Project Structure

```text
ai-student-com/
│
├── frontend/
│   ├── src/
│   ├── public/
│   └── package.json
│
├── backend/
│   ├── app/
│   ├── uploads/
│   ├── chroma_db/
│   ├── requirements.txt
│   └── main.py
│
└── README.md
```

---

## ⚙️ Installation

### Clone Repository

```bash
git clone https://github.com/your-username/medha-ai.git
cd medha-ai
```

### Backend Setup

```bash
cd backend

python -m venv venv

venv\Scripts\activate

pip install -r requirements.txt
```

### Frontend Setup

```bash
cd frontend

npm install

npm run dev
```

### Run Backend

```bash
uvicorn main:app --reload
```

Backend URL:

```text
http://localhost:8000
```

### Run Frontend

```bash
npm run dev
```

Frontend URL:

```text
http://localhost:5173
```

---

## 🔐 Environment Variables

Create a `.env` file:

```env
GEMINI_API_KEY=your_gemini_api_key
MONGODB_URI=your_mongodb_connection_string
GOOGLE_CLIENT_ID=your_google_client_id
JWT_SECRET_KEY=your_secret_key
```

---

## 🎯 Use Cases

* Student Learning Assistant
* Personalized Education
* Smart Notes Generation
* Academic Question Answering
* Exam Preparation
* Quiz Generation
* Study Material Management
* Knowledge Retrieval System

---

## 🌟 Future Enhancements

* Multi-language Support
* AI Flashcards Generation
* Personalized Learning Paths
* Mobile Application
* Advanced Analytics Dashboard
* Collaborative Learning Features
* Real-time Study Recommendations

---

## 👨‍💻 Developed By

**B. Nagaraju**

B.Tech Computer Science and Engineering

KLH University, Hyderabad

---

## 📜 License

This project is licensed under the MIT License.
