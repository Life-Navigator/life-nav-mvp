# LifeNavigator - Quick Start Guide

## Start Development (One Command!)

```bash
pnpm dev:all
```

This single command will:
- ✅ Start the Maverick AI backend (port 8080)
- ✅ Start the Next.js frontend (port 3000)
- ✅ Wait for backend to be ready
- ✅ Display output from both processes

**Press Ctrl+C to stop everything.**

---

## Alternative Commands

```bash
# Start frontend only (backend must be running separately)
pnpm dev

# Start backend only
pnpm dev:backend

# Start frontend with backend health check
pnpm dev:frontend-wait
```

---

## First Time Setup

### 1. Install Dependencies

```bash
pnpm install
```

### 2. Setup Database

```bash
# Start PostgreSQL (via Docker)
pnpm docker:pg:up

# Run migrations
pnpm prisma:migrate-dev

# Seed database (optional)
pnpm db:seed
```

### 3. Configure Environment

Copy `.env.local` and update if needed:
```bash
cp .env.example .env.local
```

The backend URL is already configured:
```
NEXT_PUBLIC_AGENT_API_URL=http://localhost:8080
```

### 4. Start Everything

```bash
pnpm dev:all
```

---

## Access Points

Once running, you can access:

| Service | URL | Description |
|---------|-----|-------------|
| **Frontend** | http://localhost:3000 | Main application |
| **Backend API** | http://localhost:8080 | Maverick AI backend |
| **API Docs** | http://localhost:8080/docs | FastAPI documentation |
| **Health Check** | http://localhost:8080/health | Backend health status |
| **Prisma Studio** | http://localhost:5555 | Database GUI (run `pnpm prisma:studio`) |
| **Admin Dashboard** | http://localhost:8501 | Agent admin panel |

---

## Key Features

### AI-Powered Chat

The floating blue chat button on every page connects to real AI:
1. Click the chat button (bottom-right corner)
2. Wait for "Test Research Agent" to load (green dot)
3. Type your message and press Enter
4. Get real AI responses powered by Maverick!

### Test Page

Visit http://localhost:3000/test-agent to:
- Check backend health status
- See available agents
- Test chat functionality
- View conversation history

### Domain Pages

Navigate to different life areas:
- `/dashboard` - Overview
- `/dashboard/finance` - Financial planning
- `/dashboard/health` - Health tracking
- `/dashboard/career` - Career management
- `/dashboard/education` - Learning goals

---

## Development Workflow

### Daily Development

```bash
# Start everything
pnpm dev:all

# Make changes to code
# Both frontend and backend auto-reload

# Stop everything (Ctrl+C)
```

### Database Changes

```bash
# Create new migration
pnpm prisma:migrate-dev

# View database
pnpm prisma:studio

# Reset database (careful!)
pnpm prisma:migrate-dev --name reset
```

### Code Quality

```bash
# Type checking
pnpm typecheck

# Linting
pnpm lint

# Formatting
pnpm format

# Tests
pnpm test
```

---

## Troubleshooting

### Backend Won't Start

Check if port 8080 is already in use:
```bash
lsof -i :8080
```

Kill existing process:
```bash
pkill -f start_mcp_server_single.py
```

### Frontend Won't Start

Check if port 3000 is already in use:
```bash
lsof -i :3000
```

Clear Next.js cache:
```bash
rm -rf .next
pnpm dev
```

### Database Connection Issues

Check PostgreSQL is running:
```bash
pnpm docker:pg:up
```

Test connection:
```bash
psql postgresql://lifenavigator:lifenavigator@localhost:5432/lifenavigator
```

### Chat Not Working

1. Check backend health: http://localhost:8080/health
2. Check browser console for errors (F12)
3. Verify CORS is enabled in backend
4. Check `.env.local` has correct backend URL

---

## Project Structure

```
lifenavigator/
├── src/
│   ├── app/                 # Next.js App Router pages
│   │   ├── dashboard/       # Main dashboard pages
│   │   └── test-agent/      # Agent test page
│   ├── components/          # React components
│   │   ├── chat/           # Chat sidebar component
│   │   └── domain/         # Domain-specific components
│   ├── lib/                # Libraries and utilities
│   │   └── api/            # API clients
│   └── hooks/              # Custom React hooks
├── scripts/                # Utility scripts
│   ├── start-backend.sh    # Backend startup script
│   └── wait-for-backend.js # Backend health check
├── prisma/                 # Database schema and migrations
└── public/                 # Static assets
```

---

## Integration Overview

```
User clicks chat → ChatSidebar.tsx → agentApi.chat()
                                          ↓
                                    localhost:8080/chat
                                          ↓
                                    MCP Backend Server
                                          ↓
                                    Maverick AI Model
                                          ↓
                                    AI Response → Displayed in Chat
```

---

## Documentation

- **Auto-Start Setup**: See [AUTO_START_SETUP.md](./AUTO_START_SETUP.md)
- **Agent Integration**: See [AGENT_INTEGRATION_COMPLETE.md](./AGENT_INTEGRATION_COMPLETE.md)
- **Side Chat Integration**: See [SIDE_CHAT_INTEGRATED.md](./SIDE_CHAT_INTEGRATED.md)

---

## Support

### Common Commands Reference

```bash
pnpm dev:all              # Start everything (recommended)
pnpm dev                  # Start frontend only
pnpm dev:backend          # Start backend only
pnpm build               # Build for production
pnpm start               # Start production server
pnpm prisma:studio       # Open database GUI
pnpm lint                # Run linter
pnpm typecheck           # Check TypeScript
pnpm test                # Run tests
```

### Environment Variables

Key variables in `.env.local`:
```bash
DATABASE_URL              # PostgreSQL connection
NEXTAUTH_SECRET           # Auth secret key
NEXT_PUBLIC_AGENT_API_URL # Backend API URL (localhost:8080)
```

---

## Success Checklist

- [ ] Dependencies installed (`pnpm install`)
- [ ] Database running (`pnpm docker:pg:up`)
- [ ] Migrations applied (`pnpm prisma:migrate-dev`)
- [ ] Environment configured (`.env.local`)
- [ ] Backend starts successfully (`pnpm dev:backend`)
- [ ] Frontend starts successfully (`pnpm dev`)
- [ ] Can access http://localhost:3000
- [ ] Chat button appears on pages
- [ ] Chat connects to AI (green dot)
- [ ] Can send and receive messages

---

## Ready to Go!

You're all set! Run `pnpm dev:all` and start building with AI-powered LifeNavigator.

For detailed documentation, see the docs linked above.

Happy coding! 🚀
