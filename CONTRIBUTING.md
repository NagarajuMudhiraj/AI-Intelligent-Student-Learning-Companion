# Contributing to AI Intelligent Student Learning Companion

Thank you for your interest in contributing to **AI Intelligent Student Learning Companion**! We welcome contributions from developers, researchers, students, and open-source enthusiasts.

Whether it's fixing a bug, adding new learning modalities, improving documentation, or optimizing the RAG pipeline, your help is appreciated.

---

## 🌟 How to Contribute

### 1. Find or Report an Issue
- Browse existing [Issues](https://github.com/NagarajuMudhiraj/AI-Intelligent-Student-Learning-Companion/issues) to find tasks labeled `good first issue` or `help wanted`.
- If you find a bug or have an idea for a new feature, please open an Issue using our templates before starting work.

### 2. Fork and Clone
```bash
# Fork the repository on GitHub, then clone your fork
git clone https://github.com/<your-username>/AI-Intelligent-Student-Learning-Companion.git
cd AI-Intelligent-Student-Learning-Companion
```

### 3. Create a Feature Branch
```bash
git checkout -b feature/your-feature-name
# or for bug fixes:
git checkout -b fix/issue-description
```

### 4. Development Workflow

#### Backend Setup
```bash
cd backend
python -m venv venv
# Windows:
venv\Scripts\activate
# Linux/macOS:
source venv/bin/activate

pip install -r requirements.txt
uvicorn app.main:app --reload --port 8000
```

#### Frontend Setup
```bash
cd frontend
npm install
npm run dev
```

#### Docker Setup
```bash
docker-compose up --build
```

---

## 📐 Code Style & Conventions

- **Python (Backend):**
  - Follow [PEP 8](https://peps.python.org/pep-0008/) style guidelines.
  - Use Pydantic models for request/response validation.
  - Document public endpoints and functions with clear docstrings.

- **TypeScript / React (Frontend):**
  - Use TypeScript with explicit types; avoid `any`.
  - Maintain reusable, single-responsibility components in `src/components/`.
  - Style with Tailwind CSS utility classes.

- **Git Commit Messages:**
  Follow Conventional Commits:
  - `feat:` A new feature (e.g., `feat: add voice dictation for study notes`)
  - `fix:` A bug fix (e.g., `fix: handle empty doc chunks in ChromaDB query`)
  - `docs:` Documentation only changes
  - `perf:` A code change that improves performance
  - `refactor:` A change that neither fixes a bug nor adds a feature

---

## 🚀 Submitting a Pull Request (PR)

1. Ensure your code passes all linters and builds:
   ```bash
   # In frontend/
   npm run build
   ```
2. Push your branch to GitHub:
   ```bash
   git push origin feature/your-feature-name
   ```
3. Open a Pull Request against the `main` branch of `NagarajuMudhiraj/AI-Intelligent-Student-Learning-Companion`.
4. Fill out the PR template describing the changes made and any relevant issue references.

---

## 📜 Community Code of Conduct
Please review our [Code of Conduct](CODE_OF_CONDUCT.md) before interacting with the project community.
