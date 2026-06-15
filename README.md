# Chain Compliance Hub

A comprehensive web application for managing supply chain compliance, conducting AI-assisted audits, and tracking supplier documentation.

## 🚀 Getting Started

This project is built using **React**, **TypeScript**, **Vite**, **Tailwind CSS**, and **shadcn-ui**, with **Supabase** backend services.

### Prerequisites

You can use either **Bun** or **npm** as your package manager.

### Local Setup

1. **Install Dependencies:**
   ```bash
   npm install
   # or
   bun install
   ```

2. **Environment Variables:**
   Create a `.env` file in the root directory and configure the following variables:
   ```env
   VITE_SUPABASE_PROJECT_ID="your_project_id"
   VITE_SUPABASE_PUBLISHABLE_KEY="your_publishable_anon_key"
   VITE_SUPABASE_URL="https://your_project_id.supabase.co"
   VITE_GOOGLE_MAPS_API_KEY="your_google_maps_api_key"
   VITE_TURNSTILE_SITE_KEY="your_turnstile_site_key"
   VITE_TURNSTILE_ENABLED="false"
   ```

3. **Start Development Server:**
   ```bash
   npm run dev
   # or
   bun dev
   ```

4. **Build for Production:**
   ```bash
   npm run build
   ```

## 📂 Project Directory Structure

* **`src/pages/`**: Main pages of the application:
  * **`Index.tsx`**: Main supplier hub & dashboard.
  * **`AuditAssistantPage.tsx`**: AI-powered audit assistant interface.
  * **`ChatPage.tsx` / `MessagesPage.tsx`**: AI compliance agents & messaging interface.
  * **`WhitePaperPage.tsx`**: Knowledge repository of regulations and white papers.
  * **Dashboards**: Tiered access dashboards (`AdminDashboard.tsx`, `SuperAdminDashboard.tsx`, `PlatformAdminDashboard.tsx`).
* **`src/components/`**: Reusable component library (using shadcn-ui + custom elements).
* **`src/contexts/` & `src/hooks/`**: Contexts and hooks for authentication, database access, and global states.
* **`supabase/`**: Migration scripts, schemas, and configurations.

## 🛠️ Tech Stack & Key Libraries

* **Framework**: React 18 + Vite
* **Styling**: Tailwind CSS + shadcn-ui + Framer Motion (for smooth transitions/animations)
* **Routing**: React Router DOM v6
* **Database & Auth**: Supabase JS SDK
* **Mapping**: `@vis.gl/react-google-maps` + Mapbox GL
* **Data Visualizations**: Recharts + Chart.js
* **Validation**: Zod + React Hook Form
