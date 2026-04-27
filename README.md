# ⚡ TANESCO Pole Monitor

IoT-based electricity pole tilt monitoring and alert system.  
Built with **Node.js · Express · PostgreSQL · ESP8266/ESP32**.

---

## 📁 Project Structure

```
tanesco-pole-monitor/
├── server.js              ← Entry point
├── render.yaml            ← Render auto-deploy config
├── package.json
├── .env.example           ← Copy to .env locally
├── db/
│   └── index.js           ← PostgreSQL connection + table setup
├── routes/
│   ├── api.js             ← ESP32 data endpoints
│   └── auth.js            ← Admin login / logout / session
├── views/
│   ├── login.ejs          ← Admin login page
│   └── dashboard.ejs      ← Live monitoring dashboard
├── public/
│   ├── css/style.css
│   └── js/dashboard.js
└── esp32/
    └── main.cpp           ← ESP8266 firmware
```

---

## 🔐 Default Admin Credentials

| Username | Password     |
|----------|-------------|
| `admin`  | `tanesco2025` |

> ⚠️ Change the password after first login (update in DB directly or add a settings page).

---

## 🚀 Deployment — Step by Step

### STEP 1 — Install Git (if not installed)

```bash
# Windows: download from https://git-scm.com/download/win
# Ubuntu/Debian:
sudo apt install git -y

# Verify:
git --version
```

---

### STEP 2 — Create GitHub Repository

1. Go to [github.com](https://github.com) → Sign in
2. Click **"+"** → **"New repository"**
3. Name it: `tanesco-pole-monitor`
4. Set to **Public** or **Private** (both work with Render)
5. Do **NOT** add README or .gitignore (we already have them)
6. Click **"Create repository"**
7. Copy the repo URL — looks like:
   ```
   https://github.com/YOUR_USERNAME/tanesco-pole-monitor.git
   ```

---

### STEP 3 — Push Code to GitHub

Open terminal inside the project folder and run:

```bash
# Initialize git
git init

# Add all files
git add .

# First commit
git commit -m "feat: initial TANESCO pole monitoring system"

# Connect to your GitHub repo (replace URL with yours)
git remote add origin https://github.com/YOUR_USERNAME/tanesco-pole-monitor.git

# Push to GitHub
git branch -M main
git push -u origin main
```

If prompted for GitHub credentials:
- **Username**: your GitHub username  
- **Password**: use a [Personal Access Token](https://github.com/settings/tokens) (not your password)

---

### STEP 4 — Deploy on Render

1. Go to [render.com](https://render.com) → Sign up / Log in
2. Click **"New +"** → **"Web Service"**
3. Connect your GitHub account if not already connected
4. Select your `tanesco-pole-monitor` repository
5. Render will auto-detect `render.yaml` — click **"Apply"**
6. This creates:
   - ✅ Web Service (Node.js app)
   - ✅ PostgreSQL database (free tier)

7. Wait ~3 minutes for first deploy
8. Your app URL will be:
   ```
   https://tanesco-pole-monitor.onrender.com
   ```

---

### STEP 5 — Update ESP8266 Firmware

Open `esp32/main.cpp` and change these 3 lines:

```cpp
const char* WIFI_SSID     = "YOUR_WIFI_NAME";
const char* WIFI_PASSWORD = "YOUR_WIFI_PASSWORD";
const char* SERVER_HOST   = "https://tanesco-pole-monitor.onrender.com";
const char* NODE_ID       = "A";   // Change per pole: A, B, C...
```

Flash using Arduino IDE or PlatformIO.

---

## 📡 API Endpoints

| Method | Endpoint | Description |
|--------|----------|-------------|
| `GET`  | `/api/reading?node=A&tilt=12.5` | ESP8266 sends tilt data |
| `GET`  | `/api/readings?node=A&limit=50` | Get recent readings |
| `GET`  | `/api/alerts?resolved=false` | Get active alerts |
| `PATCH`| `/api/alerts/:id/resolve` | Mark alert resolved |
| `GET`  | `/api/stats` | Dashboard stats |
| `POST` | `/auth/login` | Admin login |
| `GET`  | `/auth/logout` | Admin logout |
| `GET`  | `/health` | Health check |

---

## ⚠️ Tilt Alert Levels

| Angle | Level | Action |
|-------|-------|--------|
| < 10° | ✅ Normal | No action |
| 10° – 19° | ⚠️ Warning | Schedule inspection |
| ≥ 20° | 🚨 Critical | Dispatch crew immediately |

---

## 🔧 Local Development

```bash
# Clone
git clone https://github.com/YOUR_USERNAME/tanesco-pole-monitor.git
cd tanesco-pole-monitor

# Install dependencies
npm install

# Create .env file
cp .env.example .env
# Edit .env and add your local PostgreSQL URL

# Run
npm run dev
# Open: http://localhost:3000
```

---

## 🛠️ Tech Stack

- **Backend**: Node.js + Express
- **Database**: PostgreSQL
- **Templates**: EJS
- **Hardware**: ESP8266 + MPU-6050 IMU
- **Radio**: LoRa SX1276 (915 MHz)
- **Hosting**: Render.com
