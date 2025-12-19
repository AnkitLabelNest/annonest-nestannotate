# AnnoNest Design Guidelines

## Design Approach
**Reference-Based:** Enterprise SaaS platforms (Salesforce, Asana, Linear) with clean module navigation, role-based dashboards, and task management interfaces.

## Typography
- **Primary Font:** Inter for body text and UI elements
- **Display Font:** SF Pro Display for headings and emphasis
- **Hierarchy:** 
  - H1: 32px bold for page titles
  - H2: 24px semibold for module headers
  - H3: 18px semibold for card titles
  - Body: 14px regular, 16px for important content
  - Small: 12px for metadata and labels

## Color System
- **Primary:** #2563EB (professional blue for CTAs, active states)
- **Secondary:** #7C3AED (purple accent for highlights)
- **Success:** #10B981 (confirmations, completed tasks)
- **Warning:** #F59E0B (warnings, pending states)
- **Error:** #EF4444 (errors, locked modules)
- **Background:** #F9FAFB (page background)
- **Surface:** #FFFFFF (cards, panels)
- **Text Primary:** #111827, **Text Muted:** #6B7280
- **Borders:** #E5E7EB

## Layout System
**Spacing Units:** 4, 8, 16, 24, 32, 48px (Tailwind: p-1, p-2, p-4, p-6, p-8, p-12)
- Card padding: 24px
- Section spacing: 32px vertical
- Grid gap: 24px
- Border radius: 8px consistently

## Component Library

### Dashboard
- Grid-based module tiles (3-column on desktop, 2 on tablet, 1 on mobile)
- Lock icon overlay on disabled modules with blur effect
- Hover state: subtle lift (shadow-lg) on unlocked tiles
- Active tiles: border accent in primary color

### Navigation
- Top navigation bar with user role badge and profile dropdown
- Breadcrumb navigation for deep pages
- Side panel (320px width) for task management, slides in from right

### Data Tables
- Striped rows with hover highlight
- Sortable column headers with arrow indicators
- Inline edit capability with validation feedback
- "Viewed by" and "Last edited by" metadata in muted text
- Action buttons grouped at row end

### Forms
- Clear label hierarchy with required field indicators
- Multi-input options (URL/PDF/website) as tab-style selectors
- Validation feedback inline with error/success states
- Confidence scoring slider with percentage display
- Duplicate prevention warnings (yellow alert box) vs errors (red alert box)

### Workflow Visualization
- Multi-step progress indicator: Input → Relevancy → Action → Entity Tagging → Confidence → QA
- Current step highlighted in primary color
- Completed steps in success green
- Pending steps in muted grey

### Modals & Popups
- Access denial popup: centered, 400px width, clear error messaging with lock icon
- Confirmation dialogs with primary/secondary button pairing
- Overlay: rgba(0,0,0,0.5) backdrop

### Badges & Status
- Role badges: colored background with white text (Admin: purple, Manager: blue, Annotator: green, QA: amber)
- Status indicators: dot + text (Running: blue dot, Changed: green dot, No Change: grey dot)

## Images
No hero images. This is an enterprise data platform focused on functional dashboards, data tables, and workflow interfaces.

## Interactions
- Minimal animations: smooth transitions (200ms) for dropdowns, modals, side panels
- Button states: solid primary for main actions, outlined for secondary
- Hover feedback on interactive elements
- Loading states with spinner for async operations