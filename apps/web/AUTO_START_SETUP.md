# Auto-Start Maverick Backend with Frontend

## Overview

The frontend now automatically starts the Maverick AI backend when you run the dev server! No need to manually start the backend separately.

---

## Quick Start

### Option 1: Start Everything Together (Recommended)

```bash
pnpm dev:all
```

This command will:
1. Start the Maverick AI backend (MCP server on port 8080)
2. Wait for backend to be ready
3. Start the Next.js frontend (on port 3000)
4. Display output from both processes side-by-side

**Press Ctrl+C once to stop both processes at the same time.**

---

### Option 2: Start Frontend Only (Backend Must Already Be Running)

```bash
pnpm dev
```

This is the original command - starts only the frontend.
Use this if you already have the backend running separately.

---

### Option 3: Start Backend Only

```bash
pnpm dev:backend
```

Starts only the Maverick AI backend on port 8080.

---

### Option 4: Start Frontend with Wait

```bash
pnpm dev:frontend-wait
```

Waits for backend health check, then starts frontend.
Useful if backend is slow to start.

---

## New NPM Scripts

| Command | Description |
|---------|-------------|
| `pnpm dev:all` | **Start both backend and frontend together** (MAIN COMMAND) |
| `pnpm dev:backend` | Start only the backend |
| `pnpm dev:frontend` | Start only the frontend (alias for `pnpm dev`) |
| `pnpm dev:frontend-wait` | Wait for backend health, then start frontend |
| `pnpm dev` | Original command - frontend only |

---

## How It Works

### Architecture

```
pnpm dev:all
    ↓
Concurrently runs:
    ├─ Backend (Blue)
    │    ↓
    │  ./scripts/start-backend.sh
    │    ↓
    │  Starts MCP server on port 8080
    │
    └─ Frontend (Magenta)
         ↓
       wait-on http://localhost:8080/health
         ↓
       next dev (port 3000)
```

### Components Created

1. **`scripts/start-backend.sh`** - Shell script to start Maverick backend
   - Checks if backend directory exists
   - Checks if port 8080 is already in use
   - Activates Python virtual environment
   - Starts MCP server

2. **`scripts/wait-for-backend.js`** - Node.js script to wait for backend
   - Polls backend health endpoint
   - Waits up to 60 seconds
   - Shows progress indicators

3. **`package.json`** - Updated with new scripts
   - Added `concurrently` dependency
   - Added `wait-on` dependency
   - Added 4 new npm scripts

---

## Example Output

When you run `pnpm dev:all`, you'll see:

```
[BACKEND] 🚀 Starting Maverick AI backend...
[BACKEND] INFO:     Started server process [344593]
[BACKEND] INFO:     Waiting for application startup.
[BACKEND] INFO:     Application startup complete.
[BACKEND] INFO:     Uvicorn running on http://0.0.0.0:8080

[FRONTEND] ⏳ Waiting for Maverick AI backend to be ready...
[FRONTEND]    Checking http://localhost:8080/health
[FRONTEND] ✅ Backend is ready!
[FRONTEND] 🚀 Starting Next.js frontend...
[FRONTEND]    ▲ Next.js 15.3.1
[FRONTEND]    - Local:        http://localhost:3000
[FRONTEND]    ✓ Ready in 2.3s
```

---

## Stopping the Servers

### Stop Both Processes

When running `pnpm dev:all`:
- **Press Ctrl+C once** - Stops both backend and frontend gracefully

### Stop Individual Processes

If you started them separately:
```bash
# Stop backend
pkill -f start_mcp_server_single.py

# Stop frontend
# Press Ctrl+C in the frontend terminal
```

---

## Troubleshooting

### Backend Already Running

If you see:
```
✅ Backend is already running on port 8080
```

The script detected the backend is already running and won't start a duplicate.
This is normal and safe!

### Backend Directory Not Found

If you see:
```
❌ Error: Backend directory not found at /home/riffe007/Documents/projects/life-navigator-agents
```

**Solution**: Update the path in `scripts/start-backend.sh`:
```bash
BACKEND_DIR="/path/to/your/life-navigator-agents"
```

### Backend Fails to Start

If the backend fails to start, check:

1. **Python environment exists**:
   ```bash
   ls /home/riffe007/Documents/projects/life-navigator-agents/venv
   ```

2. **Backend dependencies installed**:
   ```bash
   cd /home/riffe007/Documents/projects/life-navigator-agents
   source venv/bin/activate
   pip list
   ```

3. **Maverick model loaded**:
   ```bash
   ps aux | grep llama-server
   ```

4. **Port 8080 available**:
   ```bash
   lsof -i :8080
   ```

### Frontend Timeout

If you see:
```
⚠️ Backend did not start in time
```

The frontend waited 60 seconds but backend didn't respond.

**Solution**:
1. Start backend manually:
   ```bash
   pnpm dev:backend
   ```
2. Check backend logs for errors
3. Once backend is running, start frontend:
   ```bash
   pnpm dev
   ```

---

## Advanced Configuration

### Change Backend Path

Edit `scripts/start-backend.sh`:
```bash
BACKEND_DIR="/your/custom/path/to/backend"
```

### Change Timeout

Edit `package.json`:
```json
"dev:frontend-wait": "wait-on http://localhost:8080/health --timeout 120000 && next dev"
```
(120000 = 120 seconds)

### Change Colors

Edit `package.json`:
```json
"dev:all": "concurrently --kill-others --names \"BACKEND,FRONTEND\" -c \"bgGreen.bold,bgYellow.bold\" \"pnpm dev:backend\" \"pnpm dev:frontend-wait\""
```

Available colors: bgBlue, bgGreen, bgYellow, bgRed, bgMagenta, bgCyan

---

## Testing

### Test Backend Startup

```bash
pnpm dev:backend
```

Should output:
```
🚀 Starting Maverick AI backend...
INFO:     Started server process [XXXXX]
INFO:     Application startup complete.
INFO:     Uvicorn running on http://0.0.0.0:8080
```

### Test Frontend Wait

```bash
# In one terminal
pnpm dev:backend

# In another terminal
pnpm dev:frontend-wait
```

Should wait for backend, then start frontend.

### Test Combined Startup

```bash
pnpm dev:all
```

Should start both processes and display output side-by-side.

---

## Benefits

- **Single Command**: Start everything with one command
- **No Manual Steps**: No need to remember to start backend separately
- **Synchronized**: Frontend waits for backend to be ready
- **Clean Output**: See logs from both processes clearly labeled
- **Easy Shutdown**: Stop both with one Ctrl+C

---

## For Production

**Important**: These scripts are for **local development only**.

In production:
- Backend and frontend are deployed separately
- Backend runs as a systemd service or container
- Frontend is a static build deployed to CDN/hosting
- No need for auto-start scripts

---

## Migration from Manual Start

### Before (Manual)

```bash
# Terminal 1
cd ~/Documents/projects/life-navigator-agents
source venv/bin/activate
python3 start_mcp_server_single.py

# Terminal 2
cd ~/Documents/projects/lifenavigator
pnpm dev
```

### After (Automatic)

```bash
cd ~/Documents/projects/lifenavigator
pnpm dev:all
```

One command, one terminal, everything starts automatically!

---

## Next Steps

1. **Try it now**: Run `pnpm dev:all` and see both processes start together
2. **Bookmark it**: Add to your daily workflow
3. **Customize**: Adjust paths/timeouts/colors as needed
4. **Share**: Show your team this easier development setup

---

## Summary

You can now start the entire LifeNavigator system with a single command:

```bash
pnpm dev:all
```

This automatically:
1. Starts Maverick AI backend (port 8080)
2. Waits for it to be healthy
3. Starts Next.js frontend (port 3000)
4. Shows output from both side-by-side
5. Stops both with one Ctrl+C

No more juggling multiple terminals or forgetting to start the backend!

Happy coding! 🚀
