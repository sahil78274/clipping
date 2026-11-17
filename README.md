# CLIPPING — Long Videos. Best Moments.

**CLIPPING** is an AI-powered full-stack video clipping platform. Users paste a YouTube video URL or upload creator-owned footage, and the AI analyzes the content to identify its most interesting moments and render ready-to-post short clips (9:16 Shorts/Reels, 16:9, 1:1) with burned-in subtitles.

---

## 1. Product Features

- **Simple 1-Click Workflow**: Paste Link &rarr; AI Analyzes Moments &rarr; FFmpeg Renders Clips &rarr; Preview &rarr; Download.
- **AI Moment Identification**: Google Gemini analyzes conversational hooks, surprises, emotional peaks, and storytelling sections.
- **FFmpeg MP4 Rendering**: Real video rendering for 9:16 (vertical center-crop), 16:9 widescreen, and 1:1 square with styled subtitle overlays.
- **Complete Credit Management**:
  - 20 free welcome credits upon signup.
  - Transparent 2 credits/clip pricing.
  - Automatic credit reservation before rendering.
  - Automatic refund if processing fails.
  - Instant credit package purchases (Free, Starter, Basic, Pro, Premium).
- **Creator-Owned Source Access**:
  - Full compliance with source access rules.
  - Supports direct video uploads (MP4, MOV, WebM, MKV).
  - Includes an authorized 60-second multi-scene creator sample video for instant 1-click test drives.
- **Results Dashboard**:
  - In-browser HTML5 video preview with score overlays.
  - Fine-tune start and end timestamps with instant FFmpeg re-rendering.
  - Download individual MP4s or Download All as a ZIP archive.
- **User Dashboard**:
  - My Projects: Track progress, status, and clip counts.
  - My Clips: Centralized gallery of all generated moments with format filters.
  - My Credits: Live balance, pricing packages, and full transaction history audit log.
  - Profile & Settings: Change name and password.
- **Protected Admin Panel**:
  - System metrics (Total Users, Projects, Clips, Credits Issued/Consumed, Failed Jobs).
  - User management (view details, toggle roles, add or deduct credits).
  - Global project monitoring and transaction audit trail.
  - Live AI and FFmpeg engine health checks.
- **SaaS Design**:
  - Dark emerald palette (`#090D0B` and `#22C55E`).
  - Clean Inter typography.
  - Zero emojis in the UI (pure Lucide icons).
  - Fully responsive across mobile, tablet, and desktop.
  - Automatic restoration of pasted URLs after authentication.

---

## 2. Tech Stack

- **Frontend**: React.js, Vite, React Router, Axios, Lucide Icons, Modern CSS.
- **Backend**: Node.js, Express.js, MongoDB Atlas / Mongoose, JWT, bcryptjs, Multer, Archiver.
- **AI**: Google Gemini API (`@google/generative-ai`).
- **Video Processing**: FFmpeg & FFprobe (fluent-ffmpeg with automated static binary fallbacks).

---

## 3. Project Structure

```
clipping/
  client/                   # Frontend React + Vite application
    src/
      components/           # Navbar, Footer, AuthModal, EditClipModal, LoadingSpinner
      context/              # AuthContext (state, tokens, pending URL restoration)
      pages/                # Home, ProjectResults, Projects, MyClips, Credits, Profile, Admin, Login, Signup
      services/             # Axios API client with JWT interceptors
      styles/               # Emerald & black SaaS design system (index.css)
      App.jsx               # Client router and protected routes
      main.jsx              # React entry point
    index.html
    vite.config.js          # Dev server with proxy to backend /api and /outputs
    package.json

  server/                   # Backend Node.js + Express API
    config/                 # Database connector (Atlas + local twin fallback) & credit packages
    controllers/            # Auth, Project, Clip, Credit, and Admin controllers
    middleware/             # JWT auth, Admin guard, Multer upload, Rate limiter
    models/                 # User, Project, Clip, Transaction, CreditPackage schemas
    routes/                 # /api/auth, /api/projects, /api/clips, /api/credits, /api/admin
    services/               # Gemini AI service, FFmpeg videoProcessor, Credit service
    uploads/                # Authorized creator uploads & sample creator video
    outputs/                # Rendered clip MP4s and poster thumbnails
    server.js               # Express application entry point
    .env.example            # Environment variables template

  .gitignore
  README.md
```

---

## 4. Prerequisites

### Step A: Install Node.js
Ensure you have Node.js version 18 or higher installed:
- **Windows / macOS**: Download the LTS installer from [https://nodejs.org/](https://nodejs.org/).
- **Linux (Ubuntu / Debian)**:
  ```bash
  curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
  sudo apt-get install -y nodejs
  ```
Verify installation:
```bash
node -v
npm -v
```

---

### Step B: FFmpeg Installation

The project includes `@ffmpeg-installer/ffmpeg` and `@ffprobe-installer/ffprobe` as automated npm fallbacks so it works out of the box. If you prefer using system FFmpeg:

#### Windows:
1. Download the FFmpeg build from [https://www.gyan.dev/ffmpeg/builds/](https://www.gyan.dev/ffmpeg/builds/) (choose `ffmpeg-release-essentials.zip`).
2. Extract the archive to `C:\ffmpeg`.
3. Open Windows Start menu, search for **Edit the system environment variables**, click **Environment Variables**.
4. Under **System variables**, select `Path` and click **Edit**.
5. Click **New** and add `C:\ffmpeg\bin`.
6. Open a new Command Prompt or PowerShell and verify:
   ```cmd
   ffmpeg -version
   ```

#### macOS (Homebrew):
```bash
brew install ffmpeg
```

#### Linux (Debian / Ubuntu):
```bash
sudo apt update && sudo apt install -y ffmpeg
```

---

### Step C: MongoDB Setup (Atlas or Local)

#### Option 1: Zero-Config Local (Out of the Box)
If you leave `MONGODB_URI=` blank in `server/.env`, the server will **automatically launch its built-in local MongoDB engine** on `127.0.0.1:27017`. You don't need to install anything!

#### Option 2: MongoDB Atlas (Cloud)
1. Sign up for free at [https://www.mongodb.com/cloud/atlas](https://www.mongodb.com/cloud/atlas).
2. Create a new free **M0 Sandbox Cluster**.
3. Under **Database Access**, create a user (e.g. `clipping_admin`) and a password.
4. Under **Network Access**, click **Add IP Address** and choose **Allow Access from Anywhere (`0.0.0.0/0`)**.
5. Click **Clusters &rarr; Connect &rarr; Drivers (Node.js)** and copy your connection string:
   ```
   mongodb+srv://<username>:<password>@cluster0.abcde.mongodb.net/clipping?retryWrites=true&w=majority
   ```
6. Paste this URI into `server/.env` as `MONGODB_URI`.

---

### Step D: Google Gemini API Key

1. Go to Google AI Studio at [https://aistudio.google.com/](https://aistudio.google.com/).
2. Sign in with your Google account.
3. Click **Get API key** &rarr; **Create API key in new project**.
4. Copy the generated key.
5. In `server/.env`, set:
   ```env
   GEMINI_API_KEY=AIzaSy...your_key_here
   GEMINI_MODEL=gemini-1.5-flash
   ```
*(Note: If no Gemini API key is configured, CLIPPING seamlessly activates its built-in algorithmic scene pacing engine so you can test the full FFmpeg render pipeline without hitting an error).*

---

## 5. Local Installation & Running

### Terminal 1: Backend Server

```bash
# 1. Navigate to the server folder
cd server

# 2. Copy the environment example
cp .env.example .env

# 3. Install backend dependencies
npm install

# 4. Start the server in development mode
npm run dev
```

The server will start at:
```
http://localhost:5000
```
It will automatically seed:
- Default credit packages (Free, Starter, Basic, Pro, Premium)
- Default Administrator account:
  - **Email**: `admin@clipping.ai`
  - **Password**: `Admin@12345`

---

### Terminal 2: Frontend Client

Open a second terminal window:

```bash
# 1. Navigate to the client folder
cd client

# 2. Install frontend dependencies
npm install

# 3. Start the Vite development server
npm run dev
```

The website will be running at:
```
http://localhost:5173
```

Open `http://localhost:5173` in your browser.

---

## 6. Default Admin Account

An administrator account is automatically created on first database launch:
- **Email**: `admin@clipping.ai`
- **Password**: `Admin@12345`
- **Role**: `admin`
- **Initial Balance**: 1,000 Credits

To access the Admin panel:
1. Log in with the credentials above.
2. Click **Admin** in the top navigation bar or navigate to `http://localhost:5173/admin`.
3. You can view KPIs, monitor projects, inspect user accounts, and add or deduct user credits.

---

## 7. Credit System & Pricing Rules

| Package | Credits | Price | Best For |
|---|---|---|---|
| **FREE** | 20 Credits | ₹0 | Included on signup for every user |
| **STARTER** | 100 Credits | ₹49 | Casual creators |
| **BASIC** | 250 Credits | ₹99 | Weekly podcasters |
| **PRO** | 600 Credits | ₹199 | Growing creators (Best Value) |
| **PREMIUM** | 1,400 Credits | ₹399 | Media teams & agencies |

### Credit Cost Formula:
- **Cost**: 2 credits per generated clip (e.g. 5 clips = 10 credits).
- **Safety guarantee**: Credits are **reserved** when starting a project. If processing fails for any reason, the reserved credits are **immediately refunded** to the user.

---

## 8. Troubleshooting Common Issues

### Issue 1: Port 5000 or 5173 already in use
- **Fix**: Change `PORT=5001` in `server/.env` and update the proxy target in `client/vite.config.js`.

### Issue 2: MongoDB Atlas connection timeout
- **Cause**: IP whitelist restricted in Atlas.
- **Fix**: In MongoDB Atlas &rarr; Network Access &rarr; Add IP Address &rarr; Select "Allow access from anywhere (`0.0.0.0/0`)".
- **Alternative**: Clear `MONGODB_URI` in `server/.env` to use the built-in local engine.

### Issue 3: Gemini API Quota Exceeded (429)
- **Fix**: The backend automatically falls back to intelligent algorithmic moment detection so project rendering never breaks. You can also switch models in `server/.env` via `GEMINI_MODEL=gemini-1.5-flash`.

### Issue 4: Source video permission limits for YouTube
- **Explanation**: Per Section 5 of the specification, public YouTube URLs do not grant automated download permissions. CLIPPING supports creator-owned source files and provides an authorized 60s creator sample video for instant testing. Use the **Upload Creator Video** tab or **Sample Creator Video** tab to test custom video footage.

---

## 9. License

This project is licensed under the MIT License.
