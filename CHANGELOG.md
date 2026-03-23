# Changelog

All notable changes to the Bryan Finance App will be documented in this file.

## [1.0.0] - 2026-03-23

### Added
- Personal finance dashboard with daily budget calculator, metric cards, and quick expense tracking
- Bill management with CRUD operations, recurring bill support, and automatic monthly rollover
- Income tracking with multiple schedule types (weekly, bi-monthly, monthly)
- Bank account balance management for 8 Philippine banks/wallets (GCash, BPI, GoTyme, Wise, Payoneer, PayPal, PayMaya, Cash)
- Daily expense tracker with category-based classification (food, transport, tools, personal, other)
- AI Financial Advisor powered by Claude (Sonnet 4.5) with tool-use support for data manipulation
- Image upload support in AI chat for receipt/bill/invoice scanning and data extraction
- Team salary management for tracking developer payments
- Invoice generation system with auto-numbering (INV-001, INV-002, etc.)
- Financial goals tracking with configurable monthly target (default: PHP 1,120,000)
- Timeline view for chronological bill/income visualization
- Financial insights module with caching
- Firebase Realtime Database cloud sync for cross-device data access
- Service worker for PWA offline support with asset caching
- Push notification handlers (placeholder for Phase 5)
- Client-side authentication with SHA-256 password hashing
- Data export/import (full JSON backup/restore)
- Monthly history snapshots (up to 12 months)
- Custom canvas-based bar chart rendering
- Real-time clock in sidebar and dashboard header
- Toast notification system
- Hash-based SPA routing with 10 views (Dashboard, Bills, Timeline, Income, Banks, Team, Invoices, Goals, AI Advisor, Settings)
- Mobile-responsive layout with bottom navigation and "More" menu sheet
- Security headers (X-Content-Type-Options, X-Frame-Options, X-XSS-Protection, Referrer-Policy)
- Server-side rate limiting (20 requests/minute per IP)
- Dark theme UI branded as "SUMAIT Finance"

### Security Issues (Known)
- Hardcoded credentials displayed on login screen
- Firebase config exposed in client-side JavaScript
- No server-side authentication on API endpoints
- API key stored in `.env` file (must not be committed to git)
- Client-side-only session management (localStorage)
