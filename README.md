# AquaMonitor Pro — Smart Water Quality Monitoring System

AquaMonitor Pro is an IoT and AI-driven Water Quality Monitoring platform designed to observe, analyze, classify, and predict river water quality in real time across 10 strategic river monitoring stations.

The platform provides role-segregated workflows for **Regular Users** (telemetry observation, historical trend analytics, AI potability evaluation, threshold alerts, daily PDF reports, premium subscription management, and direct admin inquiry) and **Administrators** (live reading creation, station editing & deletion, user promotion, threshold reconfiguration, full payment audit ledgers, and contact message triage with email forwarding).

---

## 1. System Architecture & Tech Stack

- **Frontend**: Semantic HTML5, CSS3 with responsive variables & dynamic light/dark theming, Vanilla ES6+ JavaScript client application.
- **Backend**: Node.js & Express.js REST API with modular MVC architecture (Routes, Controllers, Services, Middleware).
- **Security & Auth**: JSON Web Tokens (JWT) in Authorization Bearer headers, bcryptjs password hashing (10 salt rounds), role-based middleware guards (`authMiddleware`, `adminMiddleware`).
- **Database**: Dual-engine repository layer connecting to **MongoDB / Mongoose** when `MONGODB_URI` is supplied, with seamless disk-backed JSON document storage fallback ensuring zero-crash developer boot.
- **AI & Analytics**: Weighted Arithmetic Water Quality Index (WQI) computation (Brown / WHO / BIS IS 10500:2012) + Machine Learning Water Potability Ensemble (SVM-RBF & Random Forest based on Kaggle Water Potability benchmark) with 7-day cyclical ARIMA trend forecast.
- **Document Generation**: Real-time PDF generation engine powered by `pdfkit` for Daily, Weekly, and Monthly reports.
- **Communications & Billing**: Nodemailer SMTP email service for admin message forwarding and incident notification dispatch; Razorpay 4-step modal checkout workflow simulation.

---

## 2. Implemented Modules & Screenshot Mapping

| Screenshot Ref | Module / Page | Role | Implementation Summary |
|---|---|---|---|
| `image1.png` | Sign In / Register | Both | Toggleable Admin Login / User Login tabs, password visibility toggle, role-specific helper banners, form validation |
| `image2.png`, `image3.png` | Water Quality Dashboard | User | 5 KPI summary cards (Avg pH 6.8, Turbidity 37.8, Temp 21.4, DO 9.4, TDS 304.3), 24h dual-axis line chart, 10 station WQI gauges with horizontal scroll, coordinate station map with status dots, recent alerts list |
| `image4.png` | IoT Monitoring Stations | User | 3-column station cards (Kaveri, Yamuna, Godavari, Saraswati...), real-time parameter table, historical telemetry log with auto-refresh |
| `image5.png`, `image8.png`, `image9.png` | Analytics & Trends | User | River station filter dropdown, date-range selector (Last 7 days, Last 30 days, Last 3 months), Pro notice banner, 3 sub-tabs (Overview, pH Analysis, AI Prediction) |
| `image6.png`, `image7.png` | Alert Center | Both | Notification channels status, today's severity cards (8 Critical, 5 Warning, 0 Info), alert log table with resolve actions, Configure Thresholds modal |
| `image10.png` | Reports & Exports | Both | Free Daily Report PDF generation, Weekly/Monthly Pro gated cards, report history download table |
| `image11.png`, `image14.png`-`image17.png` | Premium Plans & Payments | User | Free, Pro (₹499/mo), Enterprise (₹1999/mo) cards, 4-step Razorpay checkout (Contact details, Payment options, OTP verification, Bank loading redirect), instant Pro upgrade |
| `image12.png` | Contact Admin | User | Inquiry intake form with topic dropdown, admin contact details, request checklist, backend email forwarding |
| `image13.png` | About AquaMonitor Pro | Both | 4-step workflow cards (Sensors, Transmission, Processing, Analytics), parameter safe limits table, WQI criteria |
| `image18.png` | My Account | User | User profile banner, name/phone/org edit form, email/SMS notification preferences, change password modal |
| `image19.png` | Admin Dashboard | Admin | `[PRO] [ADMIN]` banner badge, active `+ Add Reading` button |
| `image20.png`, `image21.png` | Add Reading Modal | Admin | Station ID (e.g. ST009), Station Name, Location, GPS Lat/Lng, 6 numeric sensor fields (pH, Turbidity, Temp, DO, TDS, Conductivity) |
| `image22.png` | Admin Stations | Admin | Station cards with active `✏️ Edit` and `🗑️ Delete` actions, header `+ Add Reading` |
| `image23.png` | Admin Analytics | Admin | Full multi-parameter historical trend inspection across all rivers |
| `image24.png` | Admin Premium | Admin | "👑 Admin Account - Full Access" banner, complete user transaction ledger with Order ID and Paid status |
| `image25.png` | Admin User Management | Admin | Registered users table (Name, Email, Org, Plan, Role, Joined), `Make Admin` button with confirmation popup |

---

## 3. Seed Accounts for Testing

| Role | Email | Password | Access Privileges |
|---|---|---|---|
| **Administrator** | `admin@aquamonitor.in` | `Admin@123` | Full administrative rights, reading creation, editing, deletion, user promotion, full payment ledger |
| **Regular User** | `secretowars007@gmail.com` | `User@123` | User portal, dashboard telemetry, station feeds, free daily reports, contact form, subscription upgrade |

---

## 4. API Endpoints

### Authentication (`/api/auth`)
- `POST /register`: Registers new citizen account (Validates name, email, phone, password $\ge$ 6 chars).
- `POST /login`: Validates credentials, checks role if `ADMIN` login selected, returns JWT.
- `GET /me`: Returns authenticated user profile.
- `PUT /profile`: Updates name, phone, organization, alert preferences, and theme.
- `PUT /password`: Updates password with verification of old password.

### Monitoring Stations (`/api/stations`)
- `GET /`: Lists all 10 river stations with latest readings and WQI status.
- `GET /:id`: Retrieves single station telemetry and historical feed.
- `POST /`: **(Admin Only)** Creates new station and initializes telemetry.
- `PUT /:id`: **(Admin Only)** Updates station metadata and sensor readings.
- `DELETE /:id`: **(Admin Only)** Permanently deletes station and its reading records.

### Readings & Telemetry (`/api/readings`)
- `GET /latest`: Returns 5 aggregate KPI stats for the top dashboard cards.
- `GET /history`: Returns paginated historical readings with station filtering.
- `POST /`: **(Admin Only)** Adds new water quality reading, recalculates WQI, triggers automated alerts.
- `PUT /:id`: **(Admin Only)** Edits existing reading record.
- `DELETE /:id`: **(Admin Only)** Removes reading record.

### Analytics & AI Predictions (`/api/analytics`)
- `GET /`: Returns trend data filtered by river (`ALL` or specific) and range (`7d`, `30d`, `3m`).
- `GET /predict`: Returns AI potability classification, confidence score, risk factors, recommendations, and 7-day cyclical WQI forecast.

### Alerts & Thresholds (`/api/alerts`)
- `GET /`: Returns all active/resolved alerts with critical, warning, and info tallies.
- `POST /thresholds`: **(Admin Only)** Updates min/max thresholds for pH, turbidity, TDS, and DO.
- `PUT /:id/resolve`: Marks an alert as resolved.
- `DELETE /:id`: **(Admin Only)** Dismisses alert.

### Reports (`/api/reports`)
- `GET /`: Lists generated report history and user plan entitlement.
- `POST /generate`: Generates real PDF report (Daily allowed for Free; Weekly and Monthly require Pro/Admin).
- `GET /download/:id`: Streams PDF binary file to client.

### Subscriptions & Payments (`/api/subscriptions`)
- `POST /create-order`: Initiates Razorpay order transaction.
- `POST /verify-payment`: Verifies payment ID and automatically upgrades user account to `PRO`.
- `GET /history`: Returns payment records (scoped to user, or system-wide for Admin).

### Contact Admin (`/api/contact`)
- `POST /`: Citizen inquiry submission, saves to database, forwards to `ADMIN_NOTIFICATION_EMAIL`.
- `GET /`: **(Admin Only)** Admin inbox message list with read/unread tracking.
- `PUT /:id/read`: **(Admin Only)** Marks message as read.

### User Management (`/api/users`)
- `GET /`: **(Admin Only)** Lists registered users.
- `PUT /:id/make-admin`: **(Admin Only)** Promotes user to Administrator.

---

## 5. Local Setup & Execution

### Prerequisites
- Node.js $\ge$ 18.0.0
- npm $\ge$ 9.0.0

### Installation
```bash
# Clone or navigate to the project directory
cd "f:\Water QM"

# Install dependencies
npm install

# Configure environment variables
cp .env.example .env
```

### Running the Application
```bash
# Start server (backend API + static frontend)
npm start
```
Open [http://localhost:5000](http://localhost:5000) in your web browser.

### Executing Automated Tests
```bash
npm test
```

---

## 6. Production Deployment Instructions

### Frontend Deployment (Netlify)
1. Push repository to GitHub/GitLab.
2. Link the repository in Netlify.
3. Build command: `echo 'Build complete'`
4. Publish directory: `public`
5. The included `netlify.toml` automatically proxies all `/api/*` requests to the Render backend and handles SPA fallback routing.

### Backend Deployment (Render)
1. Create a new Web Service on [Render](https://render.com).
2. Connect your Git repository.
3. Select `Node` environment.
4. Build Command: `npm install`
5. Start Command: `node server.js`
6. Add Environment Variables:
   - `NODE_ENV`: `production`
   - `JWT_SECRET`: `<secure-random-string>`
   - `MONGODB_URI`: `<your-mongodb-atlas-uri>`
   - `ADMIN_NOTIFICATION_EMAIL`: `admin@aquamonitor.in`
   - `RAZORPAY_KEY_ID`: `rzp_test_aquamonitor2026`
   - `RAZORPAY_KEY_SECRET`: `<your-razorpay-secret>`
   - `SMTP_HOST`: `smtp.gmail.com`
   - `SMTP_USER`: `<your-smtp-user>`
   - `SMTP_PASS`: `<your-smtp-app-password>`

### Database Deployment (MongoDB Atlas)
1. Create a free cluster on [MongoDB Atlas](https://www.mongodb.com/atlas).
2. Create a database user with read/write access.
3. Allow network access from `0.0.0.0/0` (or Render outbound IPs).
4. Copy the connection string (e.g. `mongodb+srv://<user>:<password>@cluster0.mongodb.net/aquamonitor?retryWrites=true&w=majority`).
5. Set `MONGODB_URI` in Render's environment settings.
