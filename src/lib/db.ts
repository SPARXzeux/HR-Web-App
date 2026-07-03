'use client';

export interface Profile {
  id: string;
  fullName: string;
  email: string;
  role: 'employee' | 'hr' | 'admin' | 'team_lead';
  joinedDate: string;
  onboardingCompleted: boolean;
  baseSalary: number;
  teams: string[];
  password?: string;
  isTeamLead?: boolean;
  leadTeams?: string[]; // teams this person is lead of
}

export interface LeaveApplication {
  id: string;
  employeeName: string;
  type: 'PTO' | 'Sick Leave' | 'Urgent';
  duration: string;
  reason: string;
  status: 'pending' | 'hr_approved' | 'approved' | 'rejected';
}

export interface Task {
  id: string;
  title: string;
  description: string;
  assignedTo: string;       // employee fullName
  assignedEmail: string;
  team: string;
  dueDate: string;          // 'YYYY-MM-DD'
  priority: 'low' | 'medium' | 'high';
  status: 'todo' | 'in_progress' | 'done';
  createdBy: string;        // role that created it
}

export interface PayrollRecord {
  id: string;
  employeeId: string;
  name: string;
  role: string;
  baseSalary: number;
  unpaidLeaves: number;
  bonus: number;
  deductions: number;
  processed: boolean;
}

export interface Notification {
  id: string;
  recipientEmail: string;
  recipientRole: string;
  message: string;
  read: boolean;
  timestamp: string;
}

const isClient = typeof window !== 'undefined';

const defaultEmployees: Profile[] = [
  { id: 'emp_1', fullName: 'John Doe', email: 'john@company.com', role: 'employee', joinedDate: '2024-01-15', onboardingCompleted: true, baseSalary: 62000, teams: ['Engineering'], password: 'john123', isTeamLead: true, leadTeams: ['Engineering'] },
  { id: 'emp_2', fullName: 'Jane Smith', email: 'jane@company.com', role: 'employee', joinedDate: '2025-06-15', onboardingCompleted: true, baseSalary: 58000, teams: ['Design', 'Engineering'], password: 'jane123' },
  { id: 'emp_3', fullName: 'Sarah Connor', email: 'employee@company.com', role: 'employee', joinedDate: '2026-07-02', onboardingCompleted: false, baseSalary: 65000, teams: ['Operations'], password: 'employee123' },
  { id: 'emp_4', fullName: 'Alex Mercer', email: 'alex@company.com', role: 'employee', joinedDate: '2026-07-01', onboardingCompleted: false, baseSalary: 48000, teams: ['Engineering'], password: 'alex123' }
];

const defaultLeaves: LeaveApplication[] = [
  { id: 'l_1', employeeName: 'John Doe', type: 'PTO', duration: 'Jul 10, 2026 - Jul 10, 2026', reason: 'Family vacation to the mountains.', status: 'pending' },
  { id: 'l_2', employeeName: 'Jane Smith', type: 'Sick Leave', duration: 'Jun 02, 2026 - Jun 03, 2026', reason: 'Fever and flu symptoms.', status: 'approved' }
];

const defaultTasks: Task[] = [
  { id: 'task_1', title: 'Q3 Sprint Planning', description: 'Define engineering roadmap for Q3 deliverables.', assignedTo: 'John Doe', assignedEmail: 'john@company.com', team: 'Engineering', dueDate: '2026-07-10', priority: 'high', status: 'todo', createdBy: 'hr' },
  { id: 'task_2', title: 'Onboarding Documentation', description: 'Update the employee handbook with new leave policies.', assignedTo: 'Jane Smith', assignedEmail: 'jane@company.com', team: 'Design', dueDate: '2026-07-15', priority: 'medium', status: 'in_progress', createdBy: 'hr' },
  { id: 'task_3', title: 'Payroll Reconciliation', description: 'Cross-check June payroll figures with bank records.', assignedTo: 'Sarah Connor', assignedEmail: 'employee@company.com', team: 'Operations', dueDate: '2026-07-08', priority: 'high', status: 'todo', createdBy: 'admin' },
];

function getInitialData<T>(key: string, fallback: T): T {
  if (!isClient) return fallback;
  const data = localStorage.getItem(key);
  if (!data) {
    localStorage.setItem(key, JSON.stringify(fallback));
    return fallback;
  }
  return JSON.parse(data);
}

function saveData<T>(key: string, data: T) {
  if (isClient) {
    localStorage.setItem(key, JSON.stringify(data));
  }
}

export const db = {
  getEmployees: (): Profile[] => getInitialData('hr_employees_v4', defaultEmployees),
  saveEmployees: (data: Profile[]) => saveData('hr_employees_v4', data),

  getLeaves: (): LeaveApplication[] => getInitialData('hr_leaves_v4', defaultLeaves),
  saveLeaves: (data: LeaveApplication[]) => saveData('hr_leaves_v4', data),

  getTasks: (): Task[] => getInitialData('hr_tasks_v4', defaultTasks),
  saveTasks: (data: Task[]) => saveData('hr_tasks_v4', data),

  addTask: (task: Omit<Task, 'id'>) => {
    const tasks = db.getTasks();
    const newTask: Task = { ...task, id: `task_${Date.now()}` };
    db.saveTasks([newTask, ...tasks]);
    // Notify the assigned employee
    db.addNotification(task.assignedEmail, 'employee', `New task assigned: "${task.title}" due ${task.dueDate}.`);
    return newTask;
  },

  updateTaskStatus: (id: string, status: Task['status']) => {
    const tasks = db.getTasks();
    const updated = tasks.map(t => t.id === id ? { ...t, status } : t);
    db.saveTasks(updated);
    return updated;
  },

  deleteTask: (id: string) => {
    const tasks = db.getTasks();
    const updated = tasks.filter(t => t.id !== id);
    db.saveTasks(updated);
    return updated;
  },

  // Parse leave duration string to Date range
  parseLeaveDates: (duration: string): { start: Date; end: Date } | null => {
    try {
      const parts = duration.split(' - ');
      if (parts.length < 2) {
        const d = new Date(parts[0]);
        return { start: d, end: d };
      }
      return { start: new Date(parts[0]), end: new Date(parts[1]) };
    } catch {
      return null;
    }
  },

  calculateCurrentSalary: (profile: Profile): number => {
    const joinedYear = new Date(profile.joinedDate).getFullYear();
    const currentYear = new Date().getFullYear();
    const years = Math.max(0, currentYear - joinedYear);
    return profile.baseSalary + (years * 10000);
  },

  getPayroll: (): PayrollRecord[] => {
    const employees = db.getEmployees();
    const payroll: PayrollRecord[] = getInitialData('hr_payroll_v4', []);
    const leaves = db.getLeaves();

    const updatedPayroll = employees.map(emp => {
      const existing = payroll.find(p => p.employeeId === emp.id);
      const computedSalary = db.calculateCurrentSalary(emp);

      const employeeUrgentLeaves = leaves.filter(l => l.employeeName === emp.fullName && l.type === 'Urgent' && l.status === 'approved');
      const urgentDays = employeeUrgentLeaves.reduce((acc, l) => {
        const parts = l.duration.split(' - ');
        if (parts.length < 2) return acc + 1;
        const start = new Date(parts[0]);
        const end = new Date(parts[1]);
        const diff = Math.abs(end.getTime() - start.getTime());
        const days = Math.ceil(diff / (1000 * 3600 * 24)) + 1;
        return acc + days;
      }, 0);

      const dailyRate = computedSalary / 30;
      const urgentDeduction = Math.round(urgentDays * 2 * dailyRate);

      if (existing) {
        return { ...existing, baseSalary: computedSalary, deductions: urgentDeduction };
      }
      return {
        id: `pay_${emp.id}`,
        employeeId: emp.id,
        name: emp.fullName,
        role: emp.teams.includes('Design') ? 'UX Designer' : emp.teams.includes('Engineering') ? 'Software Engineer' : 'Operations Specialist',
        baseSalary: computedSalary,
        unpaidLeaves: emp.onboardingCompleted ? 0 : 2,
        bonus: 0,
        deductions: urgentDeduction + (emp.onboardingCompleted ? 0 : 200),
        processed: false
      };
    });

    db.savePayroll(updatedPayroll);
    return updatedPayroll;
  },

  savePayroll: (data: PayrollRecord[]) => saveData('hr_payroll_v4', data),

  addEmployee: (emp: Omit<Profile, 'id' | 'onboardingCompleted'>) => {
    const employees = db.getEmployees();
    const newEmp: Profile = { ...emp, id: `emp_${Date.now()}`, onboardingCompleted: false };
    db.saveEmployees([...employees, newEmp]);
    return newEmp;
  },

  updateOnboardingStatus: (email: string, completed: boolean) => {
    const employees = db.getEmployees();
    const updated = employees.map(emp => emp.email === email ? { ...emp, onboardingCompleted: completed } : emp);
    db.saveEmployees(updated);
  },

  updateEmployeeTeams: (employeeId: string, newTeams: string[]) => {
    const employees = db.getEmployees();
    const updated = employees.map(emp => emp.id === employeeId ? { ...emp, teams: newTeams } : emp);
    db.saveEmployees(updated);
    return updated;
  },

  setTeamLead: (employeeId: string, leadTeams: string[]) => {
    const employees = db.getEmployees();
    const updated = employees.map(emp => {
      if (emp.id === employeeId) {
        return { ...emp, isTeamLead: leadTeams.length > 0, leadTeams };
      }
      return emp;
    });
    db.saveEmployees(updated);
    return updated;
  },

  getTeams: (): string[] => {
    const defaultTeams = ['Engineering', 'Design', 'Marketing', 'Operations', 'Sales'];
    return getInitialData('hr_custom_teams_v4', defaultTeams);
  },

  saveTeams: (data: string[]) => saveData('hr_custom_teams_v4', data),

  addTeam: (name: string) => {
    const teams = db.getTeams();
    if (!teams.includes(name)) {
      const updated = [...teams, name];
      db.saveTeams(updated);
      return updated;
    }
    return teams;
  },

  deleteTeam: (name: string) => {
    const teams = db.getTeams();
    const updatedTeams = teams.filter(t => t !== name);
    db.saveTeams(updatedTeams);
    const employees = db.getEmployees();
    const updatedEmployees = employees.map(emp => ({ ...emp, teams: emp.teams.filter(t => t !== name) }));
    db.saveEmployees(updatedEmployees);
    return updatedTeams;
  },

  resetPassword: (email: string, newPass: string) => {
    const employees = db.getEmployees();
    const updated = employees.map(emp => emp.email === email ? { ...emp, password: newPass } : emp);
    db.saveEmployees(updated);
    return true;
  },

  getNotifications: (): Notification[] => getInitialData('hr_notifications_v4', []),
  saveNotifications: (data: Notification[]) => saveData('hr_notifications_v4', data),

  addNotification: (email: string, role: string, message: string) => {
    const notifications = db.getNotifications();
    const newNotif: Notification = {
      id: `notif_${Date.now()}_${Math.random().toString(36).substr(2, 5)}`,
      recipientEmail: email,
      recipientRole: role,
      message,
      read: false,
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
    };
    db.saveNotifications([newNotif, ...notifications]);
    return newNotif;
  },

  markNotificationsAsRead: (email: string, role: string) => {
    const notifications = db.getNotifications();
    const updated = notifications.map(n => {
      if (n.recipientEmail === email || (n.recipientRole === role && n.recipientEmail === 'all')) {
        return { ...n, read: true };
      }
      return n;
    });
    db.saveNotifications(updated);
  }
};
