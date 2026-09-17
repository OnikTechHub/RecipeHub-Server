# ⚙️ RecipeHub - Backend Server API

<div align="center">

![RecipeHub Server Banner](https://img.shields.io/badge/RecipeHub-RESTful%20API%20Server-green?style=for-the-badge&logo=express)

[![Node.js](https://img.shields.io/badge/Node.js-18.x-339933?style=for-the-badge&logo=node.js)](https://nodejs.org/)
[![Express.js](https://img.shields.io/badge/Express.js-4.x-000000?style=for-the-badge&logo=express)](https://expressjs.com/)
[![MongoDB](https://img.shields.io/badge/MongoDB-Database-47A248?style=for-the-badge&logo=mongodb)](https://www.mongodb.com/)
[![Google Gemini AI](https://img.shields.io/badge/Google_Gemini-AI_Engine-8E75B2?style=for-the-badge&logo=google)](https://deepmind.google/technologies/gemini/)
[![Stripe API](https://img.shields.io/badge/Stripe-Payment_API-6772E5?style=for-the-badge&logo=stripe)](https://stripe.com/)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg?style=for-the-badge)](LICENSE)

**RecipeHub Server** is the high-performance RESTful API backend powering the RecipeHub platform. Built on Node.js, Express, and MongoDB, it provides robust backend services for **Google Gemini AI Recipe Generation**, **Email OTP Verification**, **Stripe Subscription Checkout**, **Role-Based Access Control (RBAC)**, **Quota Enforcement**, and **Admin Analytics**.

[🌐 Live Application](https://recipe-hub-client-two.vercel.app) • [⚙️ Backend Repository](https://github.com/OnikTechHub/RecipeHub-Server) • [💻 Frontend Repository](https://github.com/OnikTechHub/RecipeHub-Client)

</div>

---

## 🌟 Core Backend Capabilities

### ⚡ 1. Multi-Lingual AI Chatbot & Intent Caching Engine
* **Semantic FAQ Caching**: Intercepts incoming chatbot queries against a 10-item multilingual dataset (Bengali & English) stored in `multilingualFAQ.json`. Returns instant answers for cached questions with zero API cost and zero network latency.
* **Automatic Language Matching**: Detects Unicode script (`[\u0980-\u09FF]`) and Banglish keywords to automatically respond in 100% fluent Bengali for Bengali prompts and English for English prompts.
* **Google Gemini 10-Key Rotation Fallback**: Uncached or complex culinary queries fall back to a 10-API key load-balanced Gemini AI engine with automatic failover across models (`gemini-1.5-flash`, `gemini-2.0-flash`).
* **Strict Domain Boundary Guard**: Enforces strict culinary boundary rules—politely declining off-topic non-culinary questions (coding, sports, finance, politics) in the user's language.

### 🔒 2. AI Daily Rate Limiting & Quota Management
* **Chatbot Daily Limit**: Tracks daily user chat requests in MongoDB (`ai_chat_usages` collection), allowing Free users up to 5 messages per day while unlocking unlimited queries for Premium members and Admins.
* **AI Recipe Weekly Quota**: Enforces a 7-day rolling window quota (max 2 AI recipes/week) with live reset timestamp calculations.

### 📧 3. Authentication & Email OTP Service
* **Secure Registration**: Generates and emails 6-digit verification OTP codes via Resend / Nodemailer prior to user account creation.
* **OTP Lifecycle Management**: Automatic code expiry, retry limits, and duplicate email prevention.
* **JWT Token Management**: Secure token issuing and HTTP-Only cookie authentication for session integrity.

### 💳 4. Stripe Payment Integration
* **PaymentIntent Engine**: Securely creates Stripe Payment Intents for purchasing Premium Membership.
* **Subscription & Tier Upgrade**: Automatically upgrades user accounts to `premium` upon successful payment verification.

### 👮 5. Middleware & Access Control
* **Role-Based Access Control (RBAC)**: Custom Express middlewares (`verifyToken`, `requireAdmin`, `requirePremium`).
* **Creation Quota Enforcement**: Limits free tier accounts to 3 recipe publications, prompting paywall upgrade upon reaching the quota.

### 📈 6. Admin & Quota Analytics API
* **Real-time Platform Metrics**: Endpoints delivering statistics on total users, active premium subscriptions, published recipes, reported content, and platform activity.
* **Content Moderation**: API routes for reviewing, dismissing, or deleting reported recipes and managing user roles.

### 🍽️ 6. Advanced MongoDB Aggregation Pipeline
* **High-Performance Search & Filtering**: Multi-field regex search by title, category filtering, server-side pagination, and sorting (newest, most liked, most favorited).
* **Social Engagement**: Atomic increment/decrement handlers for recipe likes, favorites bookmarking, and community reporting.

---

## 🛠️ Tech Stack

* **Runtime**: [Node.js](https://nodejs.org/) (v18.x+)
* **Framework**: [Express.js](https://expressjs.com/)
* **Database**: [MongoDB](https://www.mongodb.com/) & Mongoose / Native MongoDB Driver
* **AI Integration**: [@google/generative-ai](https://www.npmjs.com/package/@google/generative-ai)
* **Authentication**: [jsonwebtoken](https://www.npmjs.com/package/jsonwebtoken), `bcryptjs`, `cookie-parser`, `cors`
* **Email Service**: [Nodemailer](https://nodemailer.com/) (SMTP Email Delivery)
* **Payments**: [Stripe Node SDK](https://www.npmjs.com/package/stripe)
* **Deployment**: [Vercel Serverless](https://vercel.com/) / Render

---

## 📁 Directory Structure

```text
recipe-hub-server/
├── config/                     # Database & service configurations
│   └── db.js                   # MongoDB connection logic
├── controllers/                # Business logic controllers
│   ├── adminController.js      # Admin stats & content management
│   ├── aiController.js         # Google Gemini AI generation engine
│   ├── authController.js       # OTP email dispatch & verification logic
│   ├── paymentController.js    # Stripe payment intents & webhook handlers
│   ├── recipeController.js     # Recipe CRUD, search, filter, like, report
│   ├── testimonialController.js# Testimonials & community feedback
│   └── userController.js       # User profile & role management
├── middlewares/                # Custom Express middlewares
│   ├── authMiddleware.js       # JWT token verification
│   ├── checkQuotaMiddleware.js # Creation limit quota checker
│   └── roleMiddleware.js       # Admin & Premium authorization checks
├── models/                     # Database schemas / models
│   ├── Otp.js                  # Temporary OTP verification store
│   ├── Recipe.js               # Recipe document schema
│   ├── Report.js               # Recipe reports schema
│   ├── Testimonial.js          # User reviews schema
│   └── User.js                 # User profile & tier schema
├── routes/                     # API route declarations
│   ├── adminRoutes.js          # Admin dashboard API endpoints
│   ├── aiRoutes.js             # AI recipe generation endpoint
│   ├── authRoutes.js           # OTP authentication routes
│   ├── contactRoutes.js        # Public contact form submission route
│   ├── favoriteRoutes.js       # User favorites management routes
│   ├── paymentRoutes.js        # Stripe payment intent routes
│   ├── recipeRoutes.js         # Recipe CRUD & social interactions
│   ├── reportRoutes.js         # Recipe reporting endpoints
│   ├── testimonialRoutes.js    # Public testimonials endpoints
│   ├── userRoutes.js           # User management endpoints
│   └── index.js                # Master API router
├── services/                   # External service wrappers (Gemini, Email, Stripe)
├── utils/                      # Helper utilities & response formatters
├── .env.example                # Environment variables template
├── index.js                    # Server entry point & Express app setup
├── vercel.json                 # Vercel deployment configuration
└── package.json                # Server dependencies & start scripts
```

---

## 📡 API Endpoint Reference

### 🔐 Authentication & OTP
| Method | Endpoint | Description | Access |
| :--- | :--- | :--- | :--- |
| `POST` | `/api/auth/send-registration-otp` | Sends a 6-digit verification code to user email | Public |
| `POST` | `/api/auth/verify-registration-otp` | Validates submitted OTP code | Public |

### 🤖 AI Recipe Generation
| Method | Endpoint | Description | Access |
| :--- | :--- | :--- | :--- |
| `POST` | `/api/ai/generate-recipe` | Generates structured recipe via Google Gemini AI | Authenticated |

### 🍽️ Recipe Operations
| Method | Endpoint | Description | Access |
| :--- | :--- | :--- | :--- |
| `GET` | `/api/recipes` | Fetch paginated recipes with search, category, and sorting | Public |
| `GET` | `/api/recipes/:id` | Fetch single recipe details | Public |
| `POST` | `/api/recipes` | Create & publish a new recipe (Quota Enforced) | Authenticated |
| `PUT` | `/api/recipes/:id` | Update owned recipe | Owner / Admin |
| `DELETE` | `/api/recipes/:id` | Delete recipe | Owner / Admin |
| `PATCH` | `/api/recipes/:id/like` | Toggle like status on a recipe | Authenticated |
| `POST` | `/api/recipes/:id/report` | Submit report for inappropriate content | Authenticated |

### 💳 Payments & Premium Upgrade
| Method | Endpoint | Description | Access |
| :--- | :--- | :--- | :--- |
| `POST` | `/api/payments/create-payment-intent` | Creates Stripe Payment Intent for membership upgrade | Authenticated |

### 🛡️ Admin & Analytics
| Method | Endpoint | Description | Access |
| :--- | :--- | :--- | :--- |
| `GET` | `/api/admin/analytics` | Fetch real-time system stats and usage metrics | Admin |
| `GET` | `/api/admin/users` | List all registered users | Admin |
| `PATCH` | `/api/admin/users/:id/role` | Update user role (`user`, `premium`, `admin`) | Admin |
| `GET` | `/api/admin/reports` | Fetch pending recipe reports | Admin |

---

## ⚙️ Environment Variables

Create a `.env` file in the root of `recipe-hub-server`:

```env
# Server Port & Configuration
PORT=5000
NODE_ENV=development
CLIENT_URL=http://localhost:3000

# MongoDB Database URI
MONGO_DB_URI=mongodb+srv://<username>:<password>@cluster0.mongodb.net/recipehub?retryWrites=true&w=majority
AUTH_DB_NAME=recipehub

# JWT Secret Key
JWT_SECRET=your_super_secret_jwt_key_here

# Better Auth Connection
BETTER_AUTH_URL=http://localhost:5000
BETTER_AUTH_SECRET=your_better_auth_secret

# Google Gemini AI API Key
GEMINI_API_KEY=your_google_gemini_api_key

# Stripe Payment Gateway Secret
STRIPE_SECRET_KEY=sk_test_your_stripe_secret_key

# Nodemailer / Email OTP Service
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_USER=your_email@gmail.com
SMTP_PASS=your_app_specific_password
EMAIL_FROM=RecipeHub Security <noreply@recipehub.com>
```

---

## 🚀 Local Setup & Execution

### 1. Prerequisites
* [Node.js](https://nodejs.org/) (v18.x or higher)
* [MongoDB](https://www.mongodb.com/) instance (Local or MongoDB Atlas)

### 2. Clone the Repository
```bash
git clone https://github.com/OnikTechHub/RecipeHub-Server.git
cd RecipeHub-Server
```

### 3. Install Dependencies
```bash
npm install
```

### 4. Configure Environment Variables
Copy `.env.example` to `.env` and fill in your credentials:
```bash
cp .env.example .env
```

### 5. Run Server
```bash
# Run in development mode (with nodemon)
npm run dev

# Run in production mode
npm start
```

The API server will be available at [http://localhost:5000](http://localhost:5000).

---

## 📄 License

This project is open source and available under the [MIT License](LICENSE).

---

## 👨‍💻 Developed By

**Onik Das**
* 📧 Email: [onikdas.dev@gmail.com](mailto:onikdas.dev@gmail.com)
* 🌐 Portfolio: [https://onikdas-dev.vercel.app](https://onikdas-dev.vercel.app)
* 🐙 GitHub: [@OnikTechHub](https://github.com/OnikTechHub)

---
<div align="center">
  <sub>⭐ If you find RecipeHub useful, please consider giving it a star on GitHub!</sub>
</div>
