# Employee Wellness Tracker - Frontend

A modern, responsive React + TypeScript frontend for the Employee Wellness Tracker application.

## Features

- **Landing Page**: Professional, eye-catching introduction with animations
- **Login Page**: Secure employee authentication with validation
- **Responsive Design**: Works seamlessly on all screen sizes
- **Modern UI**: Built with Tailwind CSS and Framer Motion for smooth animations

## Tech Stack

- **React 18** with TypeScript
- **Vite** for fast development and building
- **React Router** for navigation
- **Tailwind CSS** for styling
- **Framer Motion** for animations
- **Axios** for API calls
- **Socket.IO Client** (ready for real-time features)

## Project Structure

```
Frontend/
├── src/
│   ├── pages/
│   │   ├── LandingPage.tsx    # Landing page
│   │   └── LoginPage.tsx       # Login page
│   ├── services/
│   │   └── api.ts              # API client
│   ├── App.tsx                 # Main app component
│   ├── main.tsx                # Entry point
│   └── index.css               # Global styles
├── package.json
├── tsconfig.json
├── vite.config.ts
└── tailwind.config.js
```

## Installation

```bash
cd Frontend
npm install
```

## Development

```bash
npm run dev
```

The app will be available at `http://localhost:3000`

## Build

```bash
npm run build
```

## Project Reviews

### Review 1 (Current)
- ✅ Landing Page
- ✅ Login Page

### Review 2 (Upcoming)
- Employee Dashboard
- Real-time Camera Feed
- Emotion Detection Display
- Statistics & Charts

### Review 3 (Upcoming)
- Admin Dashboard
- Analytics & Reports
- Feedback System

## Backend Integration

The frontend is configured to connect to the FastAPI backend running on `http://localhost:8000`.

Make sure your backend server is running before starting the frontend.

## Environment Variables

Create a `.env` file in the Frontend directory:

```
VITE_API_URL=http://localhost:8000
```

