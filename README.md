# SARVAM-AI 🌐

### One Platform. Six Domains. Intelligent Assistance for Everyone.

SARVAM-AI is an AI-powered, multi-domain assistance platform designed to make intelligent digital support accessible across six important domains: Agriculture, Education, Healthcare, Finance, Government Services, and Environment.

The platform combines a modern web interface with a Python-based AI backend to provide domain-specific assistance through a unified application.

## 🌟 Core Domains

### 🌾 1. Agriculture

* AI-powered agricultural assistance.
* Farmer profile and farm task management.
* Agricultural recommendations.
* Weather-related information and guidance.

### 📚 2. Education

* AI-powered learning assistance.
* Educational workspace.
* Quiz generation and learning support.
* YouTube lecture intelligence.

### 🏥 3. Healthcare

* AI-powered healthcare assistance.
* Healthcare information and guidance.
* Healthcare-related workspace.

### 💰 4. Finance

* AI-powered financial assistance.
* Finance workspace.
* Financial information and management tools.

### 🏛️ 5. Government Services

* AI-powered government service assistance.
* Government complaint tracking.
* Access to government-related information and guidance.

### 🌱 6. Environment

* AI-powered environmental assistance.
* Environmental incident reporting.
* Air quality guidance.
* Environmental action tracking.

*Feature availability and functionality depend on the implemented modules and configured services.*

## 🛠️ Technology Stack

### Frontend

* Next.js 16
* React 19
* TypeScript
* Tailwind CSS 4
* Lucide React
* React Markdown

### Backend

* Python
* FastAPI
* Pydantic
* Groq API
* HTTPX

## 📁 Project Structure

```text
SARVAM-AI/
│
├── backend/
│   ├── app/
│   │   ├── agents/
│   │   ├── api/
│   │   ├── core/
│   │   ├── services/
│   │   └── main.py
│   │
│   ├── .env.example
│   ├── requirements.txt
│   └── .gitignore
│
├── frontend/
│   ├── public/
│   ├── src/
│   │   ├── app/
│   │   ├── components/
│   │   ├── hooks/
│   │   └── lib/
│   │
│   ├── .env.example
│   ├── package.json
│   ├── package-lock.json
│   └── .gitignore
│
├── AUDIT-REPORT/
│
├── .gitignore
└── README.md
```

## ⚙️ Installation and Setup

### Prerequisites

Install the following:

* Python 3.12
* Node.js and npm
* Git
* A Groq API key

### 1. Clone the Repository

```bash
git clone https://github.com/akanksha651/SARVAM-AI.git
cd SARVAM-AI
```

### 2. Backend Setup

Navigate to the backend:

```bash
cd backend
```

Create a virtual environment:

```bash
python -m venv .venv
```

Activate it on Windows PowerShell:

```powershell
.\.venv\Scripts\Activate.ps1
```

Install dependencies:

```bash
pip install -r requirements.txt
```

Configure environment variables:

```powershell
Copy-Item .env.example .env
```

Open `backend/.env` and add your Groq API key:

```env
GROQ_API_KEY=your_actual_groq_api_key
```

Start the backend:

```bash
uvicorn app.main:app --reload --host 127.0.0.1 --port 8000
```

Backend:

`http://127.0.0.1:8000`

API documentation:

`http://127.0.0.1:8000/docs`

### 3. Frontend Setup

Open another terminal and navigate to the project root:

```bash
cd frontend
```

Install dependencies:

```bash
npm install
```

Configure environment variables:

```powershell
Copy-Item .env.example .env.local
```

The default local configuration is:

```env
NEXT_PUBLIC_API_URL=http://127.0.0.1:8000
```

Start the frontend:

```bash
npm run dev
```

Frontend:

`http://localhost:3000`

## 🔐 Environment Variables

| Variable              | Location | Description                 |
| --------------------- | -------- | --------------------------- |
| `GROQ_API_KEY`        | Backend  | Authentication for Groq API |
| `NEXT_PUBLIC_API_URL` | Frontend | Backend API base URL        |

**Security:** Never commit `.env`, `.env.local`, API keys, passwords, or other sensitive credentials to GitHub.

Use the provided `.env.example` files as configuration templates.

## 🚀 Running the Application

Run the backend and frontend in separate terminals.

| Component            | Local URL                    |
| -------------------- | ---------------------------- |
| Frontend             | http://localhost:3000        |
| Backend              | http://127.0.0.1:8000        |
| API Documentation    | http://127.0.0.1:8000/docs   |
| Backend Health Check | http://127.0.0.1:8000/health |

## 🧪 Development

Frontend build:

```bash
cd frontend
npm run build
```

Frontend lint:

```bash
npm run lint
```

Backend API documentation is available through FastAPI Swagger UI.

## 🎯 Project Vision

SARVAM-AI aims to bring multiple domain-specific AI assistance experiences together through one unified platform.

Our vision is to make intelligent digital assistance more accessible, practical, and useful across everyday needs.

## 👥 Contributors

Developed as a collaborative project.

## 📄 License

No open-source license has been selected yet.
