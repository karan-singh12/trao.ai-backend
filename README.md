# Trao.ai - Backend Service

Backend REST API and server-side services for Trao.ai built with **Node.js**, **TypeScript**, and **MongoDB**.

---

## 🚀 Getting Started

### Prerequisites
- [Node.js](https://nodejs.org/) (v18+ recommended)
- [MongoDB](https://www.mongodb.com/) (local instance running or MongoDB Atlas connection string)
- npm, yarn, or pnpm

---

## 📦 Installation & Setup

1. **Install dependencies**:
   ```bash
   npm install
   ```

2. **Configure Environment Variables**:
   Create a `.env` file (copied from `.env.example`):
   ```bash
   cp .env.example .env
   ```

   Default values:
   ```env
   PORT=5000
   NODE_ENV=development
   MONGODB_URI=mongodb://localhost:27017/trao_ai
   CORS_ORIGIN=http://localhost:3000
   ```

3. **Run the Development Server**:
   ```bash
   npm run dev
   ```
   *Uses `tsx` for fast TypeScript compilation and live reload.*

4. **Build & Run Production**:
   ```bash
   npm run build
   npm start
   ```

---

## 📁 Project Structure

```text
backend/
├── src/
│   ├── config/             # Configuration (e.g., MongoDB connection)
│   │   └── db.ts
│   ├── controllers/        # Request controllers
│   ├── middlewares/        # Express middlewares (error handling, 404, etc.)
│   ├── models/             # Mongoose schemas & TypeScript document types only
│   │   └── user/
│   ├── repositories/       # Database queries / operations (Repository pattern)
│   │   └── user/
│   ├── routes/             # Express API routes
│   │   ├── health.routes.ts
│   │   └── index.ts
│   ├── services/           # Business logic services
│   ├── utils/              # Utilities & response helpers
│   ├── app.ts              # Express application factory & middleware setup
│   └── index.ts            # Server entry point & graceful shutdown
├── .env.example            # Sample environment variables
├── .gitignore              # Git ignore rules
├── package.json            # Node dependencies and scripts
├── tsconfig.json           # TypeScript configuration
└── README.md               # Documentation
```

---

## 📡 API Endpoints

- `GET /` - Root status check
- `GET /api/health` - Service & MongoDB connection health check