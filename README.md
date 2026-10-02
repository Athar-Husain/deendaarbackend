DEENDAAR Backend

Backend API for the DEENDAAR application, built with Node.js, Express, MongoDB, Socket.IO, and various supporting services.

The backend provides authentication, user and organization management, job management, applications, notifications, real-time chat, file uploads, validation, logging, and administrative functionality.

🚀 Tech Stack

Node.js — JavaScript runtime

Express.js — REST API framework

MongoDB — Database

Mongoose — MongoDB ODM

Socket.IO — Real-time communication and chat

JWT — Authentication and authorization

Joi — Request validation

Cloudinary — File/image uploads

Firebase Admin — Firebase services

Nodemailer — Email services

Multer — File upload handling

Winston — Application logging

Helmet — HTTP security headers

Express Rate Limit — API rate limiting

Morgan — HTTP request logging

bcryptjs — Password hashing

📁 Project Structure
backend/
│
├── logs/
│ ├── combined.log
│ ├── error.log
│ ├── exceptions.log
│ └── rejections.log
│
├── src/
│ │
│ ├── config/
│ │ ├── cloudinary.js
│ │ ├── database.js
│ │ ├── database1.js
│ │ ├── env.js
│ │ └── firebase.js
│ │
│ ├── constants/
│ │ ├── index.js
│ │ └── messages.js
│ │
│ ├── controllers/
│ │ ├── admin.controller.js
│ │ ├── applicant.controller.js
│ │ ├── application.controller.js
│ │ ├── auth.controller.js
│ │ ├── chat.controller.js
│ │ ├── job.controller.js
│ │ ├── notification.controller.js
│ │ └── organization.controller.js
│ │
│ ├── middleware/
│ │ ├── auth.middleware.js
│ │ ├── error.middleware.js
│ │ ├── rateLimit.middleware.js
│ │ ├── role.middleware.js
│ │ ├── upload.middleware.js
│ │ └── validate.middleware.js
│ │
│ ├── models/
│ │ ├── Admin.model.js
│ │ ├── Applicant.model.js
│ │ ├── Application.model.js
│ │ ├── Category.model.js
│ │ ├── Complaint.model.js
│ │ ├── Conversation.model.js
│ │ ├── Job.model.js
│ │ ├── Location.model.js
│ │ ├── Message.model.js
│ │ ├── Notification.model.js
│ │ ├── Organization.model.js
│ │ └── Role.model.js
│ │
│ ├── routes/
│ │ ├── admin.routes.js
│ │ ├── applicant.routes.js
│ │ ├── application.routes.js
│ │ ├── auth.routes.js
│ │ ├── chat.routes.js
│ │ ├── index.js
│ │ ├── job.routes.js
│ │ ├── notification.routes.js
│ │ └── organization.routes.js
│ │
│ ├── scripts/
│ │ ├── seeders/
│ │ │ ├── admin.seeder.js
│ │ │ ├── applicant.seeder.js
│ │ │ ├── interaction.seeder.js
│ │ │ ├── job.seeder.js
│ │ │ ├── lookup.seeder.js
│ │ │ └── organization.seeder.js
│ │ ├── admin.seeder.js
│ │ ├── seed-working.js
│ │ └── seed.js
│ │
│ ├── services/
│ │ ├── email.service.js
│ │ ├── push.service.js
│ │ ├── sms.service.js
│ │ ├── token.service.js
│ │ └── upload.service.js
│ │
│ ├── sockets/
│ │ └── chat.socket.js
│ │
│ ├── utils/
│ │ ├── ApiError.js
│ │ ├── ApiResponse.js
│ │ ├── asyncHandler.js
│ │ ├── errorResponse.js
│ │ ├── logger-deepseek.js
│ │ ├── logger.js
│ │ ├── otp.js
│ │ └── pagination.js
│ │
│ ├── validations/
│ │ ├── admin.validation.js
│ │ ├── applicant.validation.js
│ │ ├── application.validation.js
│ │ ├── auth.validation.js
│ │ ├── job.validation.js
│ │ └── organization.validation.js
│ │
│ ├── app-working.js
│ └── app.js
│
├── .env
├── .env_example
├── .gitignore
├── Backend.txt
├── package.json
├── server-working.js
└── server.js

✨ Features
Authentication & Authorization

User authentication using JWT

Password hashing with bcrypt

Role-based access control

Authentication middleware

OTP functionality

Token management

Protected API routes

Applicant Management

Applicant registration and authentication

Applicant profiles

Applicant-related applications

Applicant validation

Role-based applicant access

Organization Management

Organization registration and management

Organization profiles

Organization-specific functionality

Organization validation

Job Management

Create and manage job postings

Job categories

Job locations

Job-related validation

Job application management

Application Management

Submit job applications

Manage application status

Applicant/application relationships

Application validation

Real-Time Chat

The backend uses Socket.IO for real-time communication.

Chat functionality is organized into:

src/controllers/chat.controller.js
src/routes/chat.routes.js
src/sockets/chat.socket.js

The Socket.IO server is initialized in server.js.

Notifications

The backend supports notification functionality through:

Push notifications

Application notifications

System notifications

Notification management

Relevant services and controllers:

src/services/push.service.js
src/controllers/notification.controller.js
src/routes/notification.routes.js

File Uploads

File uploads are handled using Multer and can be integrated with Cloudinary for cloud storage.

src/middleware/upload.middleware.js
src/services/upload.service.js
src/config/cloudinary.js

Communication Services

The project contains services for:

Email

SMS

Push notifications

src/services/email.service.js
src/services/sms.service.js
src/services/push.service.js

Security

The backend includes several security mechanisms:

Helmet

CORS

Rate limiting

JWT authentication

Password hashing

Request validation

Role-based authorization

Secure cookie handling

Logging

Application logs are stored inside the logs/ directory.

logs/
├── combined.log
├── error.log
├── exceptions.log
└── rejections.log

Winston is used for application-level logging.

🛠️ Requirements

Before running the backend, make sure you have:

Node.js 18+ recommended

npm

MongoDB

Cloudinary account if file uploads are enabled

Firebase project if Firebase functionality is enabled

SMTP/email provider if email functionality is enabled

SMS provider if SMS functionality is enabled

📦 Installation

Clone the repository and enter the backend directory:

cd backend

Install dependencies:

npm install

🔐 Environment Variables

Create a .env file in the backend root directory.

A sample environment file is provided:

.env_example

Copy it to .env:

cp .env_example .env

Then configure the required environment variables.

A typical configuration may contain:

NODE_ENV=development
PORT=5000

MONGO_URI=your_mongodb_connection_string

JWT_SECRET=your_jwt_secret

CORS_ORIGINS=http://localhost:3000

CLOUDINARY_CLOUD_NAME=your_cloudinary_cloud_name
CLOUDINARY_API_KEY=your_cloudinary_api_key
CLOUDINARY_API_SECRET=your_cloudinary_api_secret

FIREBASE_PROJECT_ID=your_firebase_project_id
FIREBASE_CLIENT_EMAIL=your_firebase_client_email
FIREBASE_PRIVATE_KEY=your_firebase_private_key

The exact environment variable names should match those defined in src/config/env.js.

⚠️ Important

Never commit your real .env file or secrets to Git.

The project already contains:

.env
.env_example
.gitignore

Use .env_example as the template for other developers.

▶️ Running the Application
Development

Run the server using Nodemon:

npm run dev

Production

Start the application with:

npm start

The server entry point is:

server.js

The server first connects to the database and then creates the HTTP server and Socket.IO instance.

🗄️ Database

The application uses MongoDB with Mongoose.

Database configuration is located in:

src/config/database.js
src/config/database1.js

The active server configuration currently imports:

import { connectDatabase } from "./src/config/database1.js";

from server.js.

🌱 Database Seeding

The project includes multiple seeders for creating initial/sample data.

Run the main seed script
npm run seed

This executes:

src/scripts/seed.js

Additional seeders are located in:

src/scripts/seeders/

Including:

Admin

Applicant

Organization

Jobs

Interactions

Lookup/reference data

Make sure your database connection and environment variables are configured before running seed scripts.

🔌 Socket.IO

The application creates a Socket.IO server alongside the Express HTTP server.

The configuration is located in:

server.js

The chat socket implementation is located at:

src/sockets/chat.socket.js

Socket.IO uses:

/socket.io

as its configured path.

The server also exposes the Socket.IO instance to Express using:

app.set("io", io);

This allows controllers and other application components to access the Socket.IO instance when needed.

🏗️ Application Architecture

The backend follows a modular architecture:

Request
│
▼
Routes
│
▼
Middleware
│
▼
Controllers
│
├── Services
│
├── Models
│
└── Utilities
│
▼
MongoDB / External Services

Routes

Routes define API endpoints and connect requests to controllers.

src/routes/

Controllers

Controllers contain request/response handling and business-flow coordination.

src/controllers/

Models

Mongoose models define database schemas and relationships.

src/models/

Services

Services contain reusable functionality for external systems and application-specific operations.

src/services/

Middleware

Middleware handles cross-cutting concerns such as:

Authentication

Authorization

Validation

Error handling

Rate limiting

File uploads

src/middleware/

Validations

Joi validation schemas are organized by feature:

src/validations/

Utilities

Reusable helper functions and classes are located in:

src/utils/

🔒 Middleware

The backend includes the following middleware:

Middleware Purpose
auth.middleware.js Authentication and JWT verification
error.middleware.js Centralized error handling
rateLimit.middleware.js API request rate limiting
role.middleware.js Role-based authorization
upload.middleware.js Multipart/file upload handling
validate.middleware.js Request validation
📡 API Modules

The API is organized into the following modules:

Module Route
Authentication auth.routes.js
Admin admin.routes.js
Applicants applicant.routes.js
Applications application.routes.js
Jobs job.routes.js
Organizations organization.routes.js
Chat chat.routes.js
Notifications notification.routes.js

The main route entry point is:

src/routes/index.js

🧪 Testing

The project is configured to use Jest:

npm test

Test configuration/files can be added as the test suite grows.

📜 Available NPM Scripts
Command Description
npm run dev Start development server with Nodemon
npm start Start production server
npm run seed Seed the database
npm test Run Jest tests
🧹 Error Handling

The application uses centralized error-handling utilities.

Important files include:

src/utils/ApiError.js
src/utils/ApiResponse.js
src/utils/errorResponse.js
src/utils/asyncHandler.js
src/middleware/error.middleware.js

This provides a consistent approach to API errors and responses.

📊 Logging

Winston is used for application logging.

Logs are stored in:

logs/

Available log files include:

combined.log
error.log
exceptions.log
rejections.log

These logs can be useful for debugging application errors, rejected promises, and uncaught exceptions.

🛑 Graceful Shutdown

The server handles:

SIGINT
SIGTERM

during shutdown.

It closes the Socket.IO server and HTTP server before exiting.

The application also handles:

Unhandled promise rejections

Uncaught exceptions

Bootstrap/startup failures

🔄 Server Startup Flow

When server.js starts, the application follows this general flow:

Start server
│
▼
Connect to MongoDB
│
▼
Create Express application
│
▼
Create HTTP server
│
▼
Initialize Socket.IO
│
▼
Initialize chat sockets
│
▼
Start listening on configured PORT

📌 Entry Points
Main server
server.js

Express application
src/app.js

Working/alternative server
server-working.js

Working/alternative application
src/app-working.js

The primary application should be run through server.js unless the project specifically requires the alternative working files.

🔧 Development Guidelines

When adding a new feature, follow the existing structure.

For example, a new feature can generally be organized as:

src/
├── controllers/
├── routes/
├── models/
├── validations/
└── services/

Keep responsibilities separated:

Routes → Define endpoints

Controllers → Handle request/response flow

Services → Handle reusable business/external-service logic

Models → Handle database schemas

Validations → Validate incoming data

Middleware → Handle shared request processing

Utils → Generic reusable helpers

🚀 Production Checklist

Before deploying the backend:

Configure production environment variables

Use a production MongoDB database

Set NODE_ENV=production

Configure production CORS origins

Configure JWT secrets securely

Configure Cloudinary if required

Configure Firebase if required

Configure email/SMS providers if required

Verify Socket.IO CORS configuration

Ensure .env is not committed

Review rate-limiting configuration

Review application logs

Run database migrations/seeding only when appropriate

Run tests before deployment

📄 License

This project is currently licensed under the ISC License, as specified in package.json.

👨‍💻 Author

DEENDAAR Backend

Version: 1.0.0
