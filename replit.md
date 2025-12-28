# AnnoNest

## Overview

AnnoNest is an enterprise data annotation and intelligence platform designed for managing structured data workflows. The platform provides role-based access control with four user types (admin, manager, annotator, QA), multi-module architecture for different business functions, and comprehensive task management capabilities.

Core modules include:
- **NestAnnotate**: Text, image, video labeling with multi-step workflows
- **DataNest**: Structured data hub for firms, contacts, funds, and deals
- **NestExtract**: URL monitoring and web data extraction
- **Contact Intelligence**: Relationship mapping and analysis (planned)

## User Preferences

Preferred communication style: Simple, everyday language.

## System Architecture

### Frontend Architecture
- **Framework**: React 18 with TypeScript
- **Build Tool**: Vite with custom build script for production
- **Routing**: Wouter (lightweight React router)
- **State Management**: TanStack React Query for server state, React Context for auth and theme
- **UI Components**: shadcn/ui component library built on Radix UI primitives
- **Styling**: Tailwind CSS with CSS custom properties for theming (light/dark mode support)

### Backend Architecture
- **Runtime**: Node.js with Express
- **Language**: TypeScript with ES modules
- **API Design**: RESTful endpoints under `/api` prefix
- **Development**: tsx for TypeScript execution, Vite dev server for HMR

### Data Layer
- **ORM**: Drizzle ORM with PostgreSQL dialect
- **Schema Location**: `shared/schema.ts` contains all table definitions and Zod validation schemas
- **Migrations**: Drizzle Kit for schema management (`npm run db:push`)
- **Storage Interface**: Abstracted storage layer in `server/storage.ts` supporting in-memory and database backends

### Authentication & Authorization
- **Auth Strategy**: Client-side authentication state stored in localStorage
- **Role System**: Four roles (admin, manager, annotator, QA) with module-level access control
- **Module Access**: Role-to-module mapping defined in shared schema (`moduleAccessByRole`)

### Project Structure
```
├── client/           # React frontend application
│   ├── src/
│   │   ├── components/   # Reusable UI components
│   │   ├── pages/        # Route-level page components
│   │   ├── lib/          # Utilities, contexts, query client
│   │   └── hooks/        # Custom React hooks
├── server/           # Express backend
│   ├── index.ts      # Server entry point
│   ├── routes.ts     # API route definitions
│   └── storage.ts    # Data access layer
├── shared/           # Shared code between client/server
│   └── schema.ts     # Database schema and validation
└── migrations/       # Drizzle database migrations
```

### Design System
- **Typography**: Inter font family
- **Color Palette**: Professional blue primary (#2563EB), purple secondary (#7C3AED)
- **Component Styling**: 8px border radius, consistent spacing units (4, 8, 16, 24, 32, 48px)
- **Theme Support**: CSS variable-based theming with light/dark mode toggle

## External Dependencies

### Database
- **PostgreSQL**: Primary database (configured via DATABASE_URL environment variable)
- **Drizzle ORM**: Database toolkit for TypeScript

### UI Libraries
- **Radix UI**: Headless component primitives (dialog, dropdown, tabs, etc.)
- **shadcn/ui**: Pre-built component library using Radix
- **Lucide React**: Icon library

### Build & Development
- **Vite**: Frontend build tool and dev server
- **esbuild**: Server bundling for production
- **TypeScript**: Type checking across the stack

### Form & Validation
- **React Hook Form**: Form state management
- **Zod**: Schema validation (shared between client and server)
- **drizzle-zod**: Generates Zod schemas from Drizzle tables

## News Intelligence & Annotation Architecture

### Data Model
- **news**: Stores article content (raw_text, cleaned_text) with org_id for multi-tenant isolation
- **news_entity_links**: Junction table linking news items to entities (firms, funds, etc.) with org_id
- **text_annotations**: Stores text labeling annotations with org_id for multi-tenant security
- **annotation_tasks**: Task records for annotation workflows (stored in Supabase)

### Entity Linking Flow
1. News Item Detail page loads entity links from news_entity_links table using parallel Promise.all
2. Entity links are persisted immediately when added/removed (real-time persistence)
3. All write operations include org_id for multi-tenant isolation

### Text Annotation Flow
1. Annotations saved to text_annotations table with org_id
2. Labels are persisted immediately when added/removed
3. Task metadata stores confidence and notes (non-label data)

## NestAnnotate News Projects

### News Project Workflow
1. **Project Creation**: Managers create projects with `project_category: "news"` for bulk article tagging
2. **News Upload**: CSV/Excel upload with columns (headline, url, source_name, publish_date, raw_text, article_state)
3. **Auto Task Creation**: Tasks auto-created for articles with article_state="pending", skips completed/not_relevant
4. **Task Assignment**: Contributors claim pending tasks, managers can assign tasks
5. **Entity Tagging**: Contributors tag articles with entities (Firm, Person, Location, Topic, Fund, Deal)
6. **Task Submission**: Contributors submit tasks for review, managers approve/reject

### Shell Profile Queue
- **Purpose**: Manage new entities created from tagging workflows
- **Table**: `shell_profiles` with status (pending/approved/rejected)
- **Workflow**: Contributors create shell profiles when tagging new entities, managers review and approve

### API Endpoints (NestAnnotate)
- `GET /api/nest-annotate/projects` - List projects for org
- `POST /api/nest-annotate/projects` - Create project (manager only)
- `POST /api/nest-annotate/projects/:id/upload-news` - Upload news articles (manager only)
- `PATCH /api/nest-annotate/tasks/:id/claim` - Claim task
- `PATCH /api/nest-annotate/tasks/:id/submit` - Submit task for review
- `PATCH /api/nest-annotate/tasks/:id/complete` - Approve task (manager only)
- `GET /api/nest-annotate/shell-profiles` - List shell profiles
- `POST /api/nest-annotate/shell-profiles` - Create shell profile
- `PATCH /api/nest-annotate/shell-profiles/:id/approve` - Approve (manager only)
- `PATCH /api/nest-annotate/shell-profiles/:id/reject` - Reject (manager only)

### Known Architectural Gaps (Future Work)
- **Task-News Linkage**: annotation_tasks.metadata.news_id links to news table; future: add FK column for referential integrity