# Furbank ERP

A production-ready Enterprise Resource Planning (ERP) system designed for task and project management, with a foundation built to evolve incrementally into a comprehensive business management solution.

## 📋 Overview

Furbank ERP is a modern, full-stack application built with React, TypeScript, and Supabase. It provides a closed authentication system, role-based access control, and comprehensive task/project management capabilities.

## 🏗️ Project Structure

```
furbank-erp/
├── furbank-erp-web/          # Main application directory
│   ├── src/                   # React application source code
│   ├── supabase/              # Supabase configuration and migrations
│   │   ├── migrations/        # Database migration files
│   │   └── functions/         # Edge functions
│   ├── README.md              # Detailed application documentation
│   └── ARCHITECTURE.md        # System architecture documentation
└── README.md                  # This file
```

## ✨ Key Features

- **🔐 Closed Authentication System**: No public signup - admins create users who receive credentials
- **👥 Role-Based Access Control (RBAC)**: Three distinct roles with granular permissions
  - **Super Admin**: Full system access
  - **Admin**: Operational management capabilities
  - **User**: Task execution and collaboration
- **📊 Project Management**: Create, manage, and track projects
- **✅ Task Management**: Full task lifecycle with status tracking, priorities, and assignments
- **💬 Task Interactions**: Comments, notes, and file uploads
- **🔔 Notifications**: Real-time notifications for task assignments and updates
- **📱 Responsive Design**: Desktop-first with mobile-friendly views
- **🎨 Modern UI**: Color-coded priorities, statuses, and due dates with icons

## 🛠️ Tech Stack

- **Frontend**: React 19, TypeScript, Tailwind CSS
- **Backend**: Supabase (PostgreSQL, Auth, Storage, Edge Functions)
- **Routing**: React Router
- **UI Components**: Custom components built with Radix UI primitives
- **Icons**: Lucide React

## 🚀 Quick Start

### Prerequisites

- Node.js 20.19.0+ or 22.12.0+
- npm or yarn
- Supabase account and project
- Git

### Installation

1. **Clone the repository:**
   ```bash
   git clone https://github.com/Furbank-Group/erp.git
   cd erp/furbank-erp-web
   ```

2. **Install dependencies:**
   ```bash
   npm install
   ```

3. **Set up environment variables:**
   Create a `.env` file in `furbank-erp-web/` with your Supabase credentials:
   ```env
   VITE_SUPABASE_URL=your_supabase_url
   VITE_SUPABASE_ANON_KEY=your_supabase_anon_key
   ```

4. **Run database migrations:**
   ```bash
   cd supabase
   # Follow instructions in furbank-erp-web/SETUP.md
   ```

5. **Start the development server:**
   ```bash
   npm run dev
   ```

For detailed setup instructions, see [furbank-erp-web/README.md](./furbank-erp-web/README.md) and [furbank-erp-web/SETUP.md](./furbank-erp-web/SETUP.md).

## 📚 Documentation

- **[Application README](./furbank-erp-web/README.md)**: Detailed application documentation
- **[Architecture](./furbank-erp-web/ARCHITECTURE.md)**: System architecture and design decisions
- **[Setup Guide](./furbank-erp-web/SETUP.md)**: Step-by-step setup instructions
- **[Edge Functions Setup](./furbank-erp-web/EDGE_FUNCTIONS_SETUP.md)**: Supabase Edge Functions configuration

## 🗄️ Database Migrations

The project includes 17 database migrations located in `furbank-erp-web/supabase/migrations/`:

- **001-006**: Initial schema, user management, and RLS policies
- **007-009**: Task review system and notifications
- **010-011**: Dashboard functions and auto user creation
- **012-014**: RLS policy fixes and user management improvements
- **015-017**: Project visibility, task comments, and status updates

## 🔒 Security

- **Row Level Security (RLS)**: Enforced at the database level for all tables
- **Role-Based Permissions**: Granular permission system for UI and API access
- **Closed Authentication**: No public user registration
- **Secure Edge Functions**: User management operations via Supabase Edge Functions

## 🎯 Current Capabilities

### Projects
- Create and manage projects
- Project status tracking (Active, Completed, Archived)
- Project member management

### Tasks
- Create, assign, and track tasks
- Priority levels (Low, Medium, High, Urgent)
- Status workflow (To Do, In Progress, Blocked, Done)
- Due date tracking with visual indicators
- Task comments and notes
- File attachments
- Review workflow for task approval

### Users
- Admin-controlled user creation
- Role assignment and management
- User profile management

### Notifications
- Task assignment notifications
- Due date reminders
- Review request notifications

## 🚧 Future Enhancements

The system is designed to evolve incrementally. Potential future modules include:
- Financial management
- Inventory tracking
- Client relationship management (CRM)
- Reporting and analytics
- Document management
- Time tracking

## 🤝 Contributing

This is a private repository for Furbank Group. For contributions, please follow the existing code style and architecture patterns.

## 📝 License

Proprietary - Furbank Group

## 🔗 Links

- **Repository**: https://github.com/Furbank-Group/erp
- **Supabase Dashboard**: Configure in your Supabase project settings

## 📞 Support

For issues or questions, please contact the development team or refer to the troubleshooting guides in the documentation.

---

**Built with ❤️ for Furbank Group**
