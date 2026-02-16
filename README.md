# Monaco PRO - Local Development

## 🚀 Quick Start (Development)

To run the project locally, you need **3 terminals**:

### 1. Database Connection (Production Tunnel)
Connects your local machine to the production database on the VPS.
```bash
npm run db:connect
# Keep this terminal open!
```

### 2. Backend Server
Runs the API on port 3001.
```bash
cd server
npm run dev
```

### 3. Frontend Application
Runs the UI on port 5173.
```bash
# In the project root
npm run dev
```

After starting all three, open **[http://localhost:5173](http://localhost:5173)** in your browser.

### 🛑 Stopping the Project
To stop everything when you're done:
1. Go to each terminal window.
2. Press **Ctrl + C** to stop the process.
3. Or simply close the terminal windows.

---

## 📦 Deployment

To deploy frontend changes to production (`themonaco.com.co`):
1. Make sure you are in the **project root folder** (where `package.json` is).
2. Run:
```bash
npm run deploy
```
This builds the project and uploads it to the VPS.

---

## 🛠 Tech Stack
- **Frontend**: Vite + React
- **Backend**: Express (Port 3001)
- **Database**: PostgreSQL (Port 5434 via SSH Tunnel)
- **Realtime**: Socket.io

