# HR Operations System: Architecture & Execution Plan

## 1. System Overview
A comprehensive blueprint for building a modern HR Operations system tailored for 100+ employees. The system is architected to launch completely free on Vercel as a web application, with a frictionless transition path to native mobile applications (iOS/Android) using Ionic and Capacitor.

## 2. Technology Stack & Scalability
To support both a free web deployment and a future mobile application, the architecture relies on decoupling the frontend from a backend-as-a-service.

* **Frontend:** React (Next.js). Configured for Static Site Generation (SSG) using `output: 'export'`. This is crucial because Capacitor wraps static HTML/JS/CSS, meaning Server-Side Rendering (SSR) cannot be used if you want a smooth mobile transition.
* **Styling:** Tailwind CSS. Allows for rapid development of a minimal, clean interface (e.g., using glassmorphism and modern UI elements).
* **Backend (BaaS):** Supabase (PostgreSQL). Provides authentication, a robust relational database, file storage, and Row Level Security (RLS) on a generous free tier. It connects directly via client-side API calls.
* **Mobile Wrapper (Future):** Capacitor. When ready for mobile, the static Next.js build is dropped into Capacitor to bridge the web code to native iOS/Android device APIs.

## 3. Feasibility & Free Tier Strategy
Running this system for 100+ employees for free is highly feasible:
* **Vercel (Hosting):** Offers 100GB of bandwidth per month. 100 daily active internal users will consume minimal bandwidth, especially with a Single Page Application (SPA) architecture where only data (not UI) is fetched on navigation.
* **Supabase (Database/Auth):** The free tier includes 500MB of database space and 50,000 Monthly Active Users (MAU). 500MB of text data (leaves, salaries, profiles) will easily last for years.
* **Storage:** Supabase offers 1GB for file storage. To stay under this limit, ensure employee profile pictures and onboarding documents are compressed locally on the client before uploading.

## 4. Core Features Implementation

### 1. Role-Based Access Control (RBAC)
Managed entirely via Supabase Row Level Security (RLS) in the PostgreSQL database.
* **Admin/CEO/Owner:** Unrestricted access (`SELECT`, `UPDATE`, `INSERT`, `DELETE`) across all tables.
* **HR:** Full access to onboarding, team assignments, and leave approvals. Can read all salary data and input payroll records.
* **Employee:** Can only access their own profile, view their specific salary history, and submit leave requests mapped to their user ID.

### 2. Employee Onboarding
* HR inputs basic details to generate an invite link or initial credentials.
* Employees log in, complete their profile, and upload necessary documents to Supabase Storage.

### 3. Salary Management (Internal Ledger)
* **Salaries Table:** Tracks base pay and yearly increment percentages.
* **Payroll Records Table:** Generated monthly. HR logs deductions (e.g., unpaid leaves) and bonuses. The system calculates the net payable amount purely for HR viewing (no banking API integration required).

### 4. Leave Workflows (PTO & Urgent)
* Implemented as a state machine: `Pending` -> `HR_Approved` -> `CEO_Approved` (or `Rejected`).
* **UX Recommendation:** Use a Kanban-style drag-and-drop board on the HR/Admin dashboards to easily move leave requests between status columns.

### 5. Dashboards
* **Employee Dashboard:** Analytics on personal leave balances, current salary/deductions, and a portal to apply for time off.
* **HR Dashboard:** Overviews of pending leave requests, onboarding statuses, payroll processing checklists, and team management modules.
* **Admin/CEO Dashboard:** High-level metrics on total payroll costs, company-wide leave trends, and final approval controls.

### 6. Team Management
* Uses a junction table (`team_members`) allowing for many-to-many relationships. HR can create a team (e.g., "Engineering") and assign multiple employees, or view an employee and assign them to multiple teams.

---

## 5. Complete Database Schema (PostgreSQL)

Execute this in your Supabase SQL Editor to establish the foundation:

```sql
-- 1. Custom Enum Types
CREATE TYPE user_role AS ENUM ('employee', 'hr', 'admin');
CREATE TYPE leave_status AS ENUM ('pending', 'hr_approved', 'approved', 'rejected');
CREATE TYPE leave_type AS ENUM ('pto', 'urgent', 'sick');

-- 2. Profiles Table (Extends Supabase Auth)
CREATE TABLE profiles (
    id UUID REFERENCES auth.users(id) PRIMARY KEY,
    full_name TEXT NOT NULL,
    role user_role DEFAULT 'employee',
    joined_date DATE NOT NULL DEFAULT CURRENT_DATE,
    onboarding_completed BOOLEAN DEFAULT false,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now())
);

-- 3. Teams Table
CREATE TABLE teams (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name TEXT NOT NULL UNIQUE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now())
);

-- 4. Team Assignments (Many-to-Many)
CREATE TABLE team_members (
    team_id UUID REFERENCES teams(id) ON DELETE CASCADE,
    user_id UUID REFERENCES profiles(id) ON DELETE CASCADE,
    assigned_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()),
    PRIMARY KEY (team_id, user_id)
);

-- 5. Salary Management (Base tracking)
CREATE TABLE salaries (
    user_id UUID REFERENCES profiles(id) PRIMARY KEY,
    base_salary DECIMAL(10, 2) NOT NULL,
    yearly_increment_percentage DECIMAL(5, 2) DEFAULT 0.00,
    last_increment_date DATE,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now())
);

-- 6. Monthly Payroll Records (For HR deductions/additions)
CREATE TABLE payroll_records (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID REFERENCES profiles(id),
    month_year DATE NOT NULL, -- e.g., 2026-07-01
    base_amount DECIMAL(10, 2) NOT NULL,
    deductions DECIMAL(10, 2) DEFAULT 0.00,
    bonuses DECIMAL(10, 2) DEFAULT 0.00,
    net_payable DECIMAL(10, 2) GENERATED ALWAYS AS (base_amount + bonuses - deductions) STORED,
    processed BOOLEAN DEFAULT false
);

-- 7. Leave Applications
CREATE TABLE leaves (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID REFERENCES profiles(id),
    type leave_type NOT NULL,
    start_date DATE NOT NULL,
    end_date DATE NOT NULL,
    reason TEXT,
    status leave_status DEFAULT 'pending',
    hr_reviewer_id UUID REFERENCES profiles(id),
    admin_reviewer_id UUID REFERENCES profiles(id),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now())
);

-- 8. Enable Row Level Security (Examples)
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE leaves ENABLE ROW LEVEL SECURITY;

-- Employees can read their own profile
CREATE POLICY "Users can view own profile" 
ON profiles FOR SELECT 
USING (auth.uid() = id);

-- HR and Admins can view all profiles
CREATE POLICY "HR and Admin can view all profiles" 
ON profiles FOR SELECT 
USING (
    EXISTS (
        SELECT 1 FROM profiles 
        WHERE id = auth.uid() AND role IN ('hr', 'admin')
    )
);

-- Employees can insert their own leave requests
CREATE POLICY "Employees can request leaves" 
ON leaves FOR INSERT 
WITH CHECK (auth.uid() = user_id);
```
