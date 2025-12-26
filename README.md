# Data Products

A comprehensive data platform for SQL query execution, job scheduling, S3 storage management, and AI-assisted analytics.

## Features

- **SQL Query Studio** - Execute queries on SQL Server & Redshift with schema browser
- **Job Scheduler** - Create and schedule automated SQL workflows with cron expressions
- **S3 Storage Browser** - Browse, upload, download, and manage files in S3
- **AI Assistant** - Chat-based AI for data analysis (Ollama integration)
- **RAG System** - Retrieval-augmented generation for document Q&A

## Tech Stack

### Backend
- **Runtime**: Bun
- **Framework**: Hono
- **Language**: TypeScript
- **Databases**: SQL Server, Redshift
- **Storage**: AWS S3
- **Auth**: JWT with bcrypt

### Frontend
- **Framework**: React 18
- **Router**: TanStack Router
- **Styling**: Tailwind CSS
- **State**: TanStack Query
- **Build**: Vite

## Getting Started

### Prerequisites
- Bun >= 1.0
- Node.js >= 18 (for some dependencies)
- SQL Server access
- AWS credentials (for S3 and Redshift)

### Installation

```bash
# Clone the repository
git clone https://github.com/hszkf/data-products.git
cd data-products

# Install backend dependencies
cd backend
bun install

# Install frontend dependencies
cd ../frontend
bun install
```

### Configuration

Create `backend/.env` file:

```env
# SQL Server
SQLSERVER_HOST=your-server
SQLSERVER_PORT=1433
SQLSERVER_USER=your-user
SQLSERVER_PASSWORD=your-password
SQLSERVER_DATABASE=your-database

# Redshift
REDSHIFT_HOST=your-cluster.region.redshift.amazonaws.com
REDSHIFT_PORT=5439
REDSHIFT_USER=your-user
REDSHIFT_PASSWORD=your-password
REDSHIFT_DATABASE=your-database

# AWS
AWS_REGION=ap-southeast-1
AWS_ACCESS_KEY_ID=your-access-key
AWS_SECRET_ACCESS_KEY=your-secret-key
S3_BUCKET=your-bucket
S3_PREFIX=your-prefix/

# JWT
JWT_SECRET=your-super-secret-key-change-in-production

# Server
PORT=8080
```

### Running

```bash
# Start backend
cd backend
bun run dev

# Start frontend (in another terminal)
cd frontend
bun run dev
```

- Backend: http://localhost:8080
- Frontend: http://localhost:5173

## Default Users

| Username | Role | Team |
|----------|------|------|
| hasif | Admin | Data Science |
| nazierul | Admin | Data Science |
| izhar | Editor | Data Science |
| asyraff | Editor | Data Science |
| bob | Editor | Business Intelligence |
| yee-ming | Editor | Business Intelligence |
| ernie | Viewer | Business Intelligence |

Default password: `admin123`

## Role Permissions

| Feature | Admin | Editor | Viewer |
|---------|-------|--------|--------|
| Execute SELECT queries | Yes | Yes | Yes |
| Execute INSERT queries | Yes | Yes | No |
| Execute DELETE/UPDATE | Yes | No | No |
| Execute DROP/ALTER/TRUNCATE | Yes | No | No |
| Create/Edit Jobs | Yes | Yes | No |
| Run Jobs | Yes | Yes | No |
| Delete Jobs | Yes | No | No |
| Upload Files | Yes | Yes | No |
| Delete Files | Yes | No | No |
| Manage Users | Yes | No | No |
| View Query Logs | Yes | No | No |

## API Documentation

### Authentication
- `POST /auth/login` - Login with username/password
- `GET /auth/me` - Get current user info
- `POST /auth/change-password` - Change password

### SQL
- `POST /sqlserver/execute` - Execute SQL Server query
- `POST /redshift/execute` - Execute Redshift query
- `GET /sqlserver/schema` - Get SQL Server schema
- `GET /sqlserver/health` - Health check

### Jobs
- `GET /jobs` - List all jobs
- `POST /jobs` - Create job
- `GET /jobs/:id` - Get job details
- `PUT /jobs/:id` - Update job
- `DELETE /jobs/:id` - Delete job
- `POST /jobs/:id/run` - Run job now
- `POST /jobs/:id/pause` - Pause job
- `POST /jobs/:id/resume` - Resume job

### Storage
- `GET /storage/health` - S3 health check
- `GET /storage/files` - List files
- `POST /storage/upload` - Upload file
- `POST /storage/upload-multiple` - Upload multiple files
- `DELETE /storage/files` - Delete file
- `POST /storage/folders` - Create folder
- `POST /storage/move` - Move files
- `PUT /storage/files/rename` - Rename file

### Users (Admin only)
- `GET /users` - List users
- `POST /users` - Create user
- `PUT /users/:id` - Update user
- `DELETE /users/:id` - Delete user

### Logs (Admin only)
- `GET /logs/queries` - List query logs
- `GET /logs/queries/export` - Export logs as CSV

## Testing

```bash
# Run backend tests
cd backend
bun test

# Run with coverage
bun test --coverage

# Run E2E tests
npx playwright test
```

## Project Structure

```
data-products/
├── backend/
│   ├── src/
│   │   ├── __tests__/       # Test files
│   │   ├── middleware/      # Auth, error handling, query guard
│   │   ├── migrations/      # SQL migrations
│   │   ├── models/          # Data models
│   │   ├── routes/          # API routes
│   │   ├── services/        # Business logic
│   │   └── utils/           # Utilities
│   └── package.json
├── frontend/
│   ├── src/
│   │   ├── components/      # React components
│   │   ├── lib/             # Utilities & API clients
│   │   └── routes/          # Page components
│   └── package.json
├── e2e/                     # E2E tests
└── README.md
```

---

## Future Improvements

### High Priority

#### 1. Security (IMPLEMENTED)
- [x] JWT authentication
- [x] Role-based access control (RBAC)
- [x] SQL query protection (command blocking)
- [x] Query audit logging to S3
- [x] Password hashing with bcrypt

#### 2. Error Handling (IMPLEMENTED)
- [x] Centralized error handling middleware
- [x] Custom error classes
- [x] Structured JSON logging
- [x] React error boundaries
- [x] User-friendly error messages

#### 3. Testing (IMPLEMENTED)
- [x] Unit tests for services
- [x] Integration tests for API routes
- [x] E2E tests with Playwright
- [x] 80%+ code coverage target

### Medium Priority

#### 4. Performance
- [ ] Add Redis caching for frequently accessed data
- [ ] Implement connection pooling optimization
- [ ] Add request compression (gzip)
- [ ] Virtual scrolling for large file lists
- [ ] Lazy loading for heavy components

#### 5. Database
- [ ] Automated database migrations system
- [ ] Soft delete instead of hard delete
- [ ] Database connection health monitoring
- [ ] Query result caching

#### 6. S3 Storage Improvements
- [ ] Multipart upload progress indicator
- [ ] Drag & drop folder upload
- [ ] File preview for PDF, CSV, images
- [ ] Search within files
- [ ] File versioning support
- [ ] Bulk download as ZIP

#### 7. Job Scheduler
- [ ] Job dependencies (run job B after job A)
- [ ] Job templates
- [ ] Email/Slack notifications on failure
- [ ] Job execution timeout
- [ ] Retry with exponential backoff
- [ ] Real-time log streaming via WebSocket

### Nice to Have

#### 8. UI/UX
- [ ] Dark/light theme toggle
- [ ] Keyboard shortcuts
- [ ] Responsive design for mobile
- [ ] Loading skeletons
- [ ] Undo/redo for destructive actions
- [ ] Unsaved changes warning

#### 9. DevOps
- [ ] Dockerfile for containerization
- [ ] Docker Compose for local development
- [ ] CI/CD pipeline (GitHub Actions)
- [ ] Health check endpoints
- [ ] Prometheus metrics
- [ ] Structured logging to ELK/CloudWatch

#### 10. Documentation
- [ ] OpenAPI/Swagger documentation
- [ ] Architecture diagrams
- [ ] Contributing guidelines
- [ ] Deployment guide

---

## License

Private - Internal Use Only

## Authors

- Hasif (Admin)
- Nazierul (Admin)
