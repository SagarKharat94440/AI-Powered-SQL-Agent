# SQL Agent — AI-Powered Database Query Assistant

An intelligent SQL agent that converts **natural language questions into SQL queries** using Google Gemini AI. Query sample databases or upload your own CSV/Excel files. Built with the MERN stack + MySQL.

## ✨ Features

- 🗣️ **Natural language to SQL** — Ask questions in plain English, get SQL queries + results
- 📦 **3 sample databases** — E-Commerce, HR, Students (seeded with 200-500 rows of realistic data)
- 📁 **File upload** — Upload CSV/XLSX files and query them with AI
- 📊 **Chart toggle** — Switch between table view and bar chart for numeric results (Recharts)
- 🔐 **User authentication** — JWT-based login/signup with refresh tokens
- 📜 **Query history** — Last 5 queries shown in sidebar for quick re-use
- 💬 **Conversation memory** — Context-aware follow-up questions
- 🛡️ **SQL validation** — Only SELECT queries allowed (blocks DROP, DELETE, UPDATE, etc.)
- 🔄 **Smart retry** — If SQL fails, automatically retries with error context
- 📱 **Responsive design** — Works on desktop and mobile

## 🛠️ Tech Stack

| Layer | Technology |
|-------|-----------|
| Frontend | React 19, React Router v7, Recharts, CSS3 |
| Backend | Node.js, Express 5 |
| AI | Google Gemini (via LangChain) |
| Auth DB | MongoDB (Mongoose) |
| Query DB | MySQL |
| Security | JWT, Helmet, CORS, Rate Limiting |

## 🚀 Getting Started

### Prerequisites
- Node.js 18+
- MongoDB (local or Atlas)
- MySQL 8+
- Google Gemini API key → [Get one here](https://makersuite.google.com/app/apikey)

### Installation

```bash
# Clone the repo
git clone <your-repo-url>
cd SQL-Agent

# Install backend
cd backend
npm install

# Install frontend
cd ../frontend
npm install
```

### Configuration

```bash
cd backend
cp .env.example .env
# Edit .env with your values
```

Key environment variables:
- `TIDB_MYSQL_HOST`, `TIDB_MYSQL_USER`, `TIDB_MYSQL_PASSWORD`, `TIDB_MYSQL_PORT`, `TIDB_MYSQL_SSL` — TiDB connection
- `B2_ENDPOINT`, `B2_KEY_ID`, `B2_APPLICATION_KEY`, `B2_BUCKET`, `B2_REGION` — Backblaze B2 object storage
- `MONGODB_URI` — MongoDB connection string
- `GOOGLE_API_KEY` — Gemini API key
- `JWT_SECRET` — Secret for JWT tokens

### Seed the Database

```bash
cd backend
node scripts/seedDatabases.js
```

This creates 3 MySQL databases with realistic faker data:
- **sql_agent_ecommerce** — customers, products, orders, order_items, categories, reviews
- **sql_agent_hr** — departments, employees, salary, leaves
- **sql_agent_students** — students, courses, enrollment, grades

### Run the App

```bash
# Terminal 1 — Backend
cd backend
npm start

# Terminal 2 — Frontend
cd frontend
npm start
```

Open [http://localhost:3000](http://localhost:3000) in your browser.

## 📖 Usage

1. **Sign Up / Login** — Create an account to get started
2. **Select a database** — Choose from E-Commerce, HR, or Students
3. **Ask questions** — Type natural language queries like:
   - *"Show me top 10 customers by total order amount"*
   - *"What is the average salary per department?"*
   - *"Which students have a GPA above 3.5?"*
4. **Upload your data** — Switch to Upload tab, drag-drop a CSV/Excel file
5. **View charts** — Click 📈 Chart button on numeric results
6. **See the SQL** — Click the SQL Query toggle to see what was generated

## 🔌 API Endpoints

### Authentication
| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/auth/register` | Register |
| POST | `/auth/login` | Login |
| POST | `/auth/logout` | Logout |
| POST | `/auth/refresh` | Refresh token |

### AI Chat
| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/api/ai/chat` | Send question |
| POST | `/api/ai/upload` | Upload CSV/XLSX |
| GET | `/api/ai/datasets` | List databases |
| GET | `/api/ai/schema/:dataset` | Get schema |
| GET | `/api/ai/conversations` | List conversations |
| GET | `/api/ai/conversations/:id` | Get conversation |
| DELETE | `/api/ai/conversations/:id` | Delete conversation |

## 📁 Project Structure

```
SQL-Agent/
├── backend/
│   ├── agents/           # SQL Agent + prompt templates
│   ├── config/           # DB + LangChain config
│   ├── controllers/      # Route controllers
│   ├── middlewares/       # Auth, rate limiter, error handler
│   ├── models/           # Mongoose models
│   ├── routes/           # API routes
│   ├── scripts/          # Database seed script
│   ├── services/         # DB, SQL executor, upload service
│   └── index.js
├── frontend/
│   └── src/
│       ├── component/    # React components
│       ├── context/      # Auth context
│       └── utils/        # API utilities
└── README.md
```

## 🌐 Deployment

1. Create a TiDB Cloud database or your preferred MySQL-compatible database
2. Create a MongoDB database (Atlas or another managed provider)
3. Set the `TIDB_MYSQL_*` variables in `.env` to your TiDB credentials
4. Set the `B2_*` variables in `.env` to your Backblaze B2 bucket credentials
5. Run `node scripts/seedDatabases.js` to populate data
6. Deploy backend as a Node.js app
7. Deploy frontend as a static site (run `npm run build` first)

## License

MIT License
