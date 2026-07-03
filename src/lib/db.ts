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
  jobTitle?: string;
  gender?: 'male' | 'female';
}

export interface LeaveApplication {
  id: string;
  employeeName: string;
  type: 'PTO' | 'Sick Leave' | 'Urgent' | 'Parental Leave';
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

export interface CareerPosition {
  id: string;
  title: string;
  department: string;
  location: string;
  description: string;
  requirements: string[];
}

export interface TicketReply {
  id: string;
  senderName: string;
  senderRole: 'employee' | 'hr' | 'admin' | 'team_lead';
  message: string;
  timestamp: string;
}

export interface Ticket {
  id: string;
  employeeName: string;
  employeeEmail: string;
  title: string;
  description: string;
  status: 'open' | 'closed';
  createdAt: string;
  replies: TicketReply[];
}

const isClient = typeof window !== 'undefined';

const defaultEmployees: Profile[] = [
  { id: 'emp_1', fullName: 'John Doe', email: 'john@company.com', role: 'employee', joinedDate: '2024-01-15', onboardingCompleted: true, baseSalary: 62000, teams: ['Engineering'], password: 'john123', isTeamLead: true, leadTeams: ['Engineering'], jobTitle: 'Software Architect', gender: 'male' },
  { id: 'emp_2', fullName: 'Jane Smith', email: 'jane@company.com', role: 'employee', joinedDate: '2025-06-15', onboardingCompleted: true, baseSalary: 58000, teams: ['Design', 'Engineering'], password: 'jane123', jobTitle: 'Lead Product Designer', gender: 'female' },
  { id: 'emp_3', fullName: 'Sarah Connor', email: 'employee@company.com', role: 'employee', joinedDate: '2023-03-01', onboardingCompleted: false, baseSalary: 65000, teams: ['Operations'], password: 'employee123', jobTitle: 'Operations Manager', gender: 'female' },
  { id: 'emp_4', fullName: 'Alex Mercer', email: 'alex@company.com', role: 'employee', joinedDate: '2026-07-01', onboardingCompleted: false, baseSalary: 48000, teams: ['Engineering'], password: 'alex123', jobTitle: 'QA Specialist', gender: 'male' }
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

const defaultCareers: CareerPosition[] = [
  { id: 'car_1', title: 'Senior React Developer', department: 'Engineering', location: 'Remote (Pakistan)', description: 'We are seeking a senior frontend developer with expertise in React, Next.js, and clean tailwind architectures.', requirements: ['3+ years Experience with React/Next.js', 'Strong CSS & Tailwind skills', 'Knowledge of REST & GraphQL APIs'] },
  { id: 'car_2', title: 'UX/UI Designer', department: 'Design', location: 'Lahore Office', description: 'Join our design system team to craft gorgeous experiences across logistics and tracking software platforms.', requirements: ['Figma master with strong portfolio', 'Interactive prototyping skill', 'Understanding of user accessibility guidelines'] }
];

const defaultTickets: Ticket[] = [
  {
    id: 't_1',
    employeeName: 'Jane Smith',
    employeeEmail: 'jane@company.com',
    title: 'Salary Slip Error',
    description: 'My June payroll shows incorrect bonus structures compared to my target achievements.',
    status: 'open',
    createdAt: '2026-07-02 10:15 AM',
    replies: [
      { id: 'rep_1', senderName: 'Jane Smith', senderRole: 'employee', message: 'I can attach my performance metrics sheet if needed.', timestamp: '10:16 AM' }
    ]
  }
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
  getEmployees: (): Profile[] => getInitialData('hr_employees_v6', defaultEmployees),
  saveEmployees: (data: Profile[]) => saveData('hr_employees_v6', data),

  getLeaves: (): LeaveApplication[] => getInitialData('hr_leaves_v6', defaultLeaves),
  saveLeaves: (data: LeaveApplication[]) => saveData('hr_leaves_v6', data),

  getTasks: (): Task[] => getInitialData('hr_tasks_v6', defaultTasks),
  saveTasks: (data: Task[]) => saveData('hr_tasks_v6', data),

  getCareers: (): CareerPosition[] => getInitialData('hr_careers_v6', defaultCareers),
  saveCareers: (data: CareerPosition[]) => saveData('hr_careers_v6', data),

  getTickets: (): Ticket[] => getInitialData('hr_tickets_v6', defaultTickets),
  saveTickets: (data: Ticket[]) => saveData('hr_tickets_v6', data),

  createTicket: (ticket: Omit<Ticket, 'id' | 'status' | 'createdAt' | 'replies'>) => {
    const list = db.getTickets();
    const newTicket: Ticket = {
      ...ticket,
      id: `t_${Date.now()}`,
      status: 'open',
      createdAt: new Date().toLocaleDateString('en-US', { month: 'short', day: '2-digit', year: 'numeric' }) + ' ' + new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      replies: []
    };
    db.saveTickets([newTicket, ...list]);
    db.addNotification('all', 'hr', `New support ticket opened: "${ticket.title}" by ${ticket.employeeName}.`);
    return newTicket;
  },

  addTicketReply: (ticketId: string, reply: Omit<TicketReply, 'id' | 'timestamp'>) => {
    const list = db.getTickets();
    const updated = list.map(t => {
      if (t.id === ticketId) {
        const newReply: TicketReply = {
          ...reply,
          id: `rep_${Date.now()}`,
          timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
        };
        // Notify respective participants
        if (reply.senderRole === 'hr' || reply.senderRole === 'admin') {
          db.addNotification(t.employeeEmail, 'employee', `Support response received from HR regarding ticket "${t.title}".`);
        } else {
          db.addNotification('all', 'hr', `New support message from ${t.employeeName} on ticket "${t.title}".`);
        }
        return { ...t, replies: [...t.replies, newReply] };
      }
      return t;
    });
    db.saveTickets(updated);
    return updated;
  },

  updateTicketStatus: (ticketId: string, status: 'open' | 'closed') => {
    const list = db.getTickets();
    const updated = list.map(t => {
      if (t.id === ticketId) {
        db.addNotification(t.employeeEmail, 'employee', `Support ticket "${t.title}" was marked as ${status}.`);
        db.addNotification('all', 'hr', `Support ticket "${t.title}" is now ${status}.`);
        return { ...t, status };
      }
      return t;
    });
    db.saveTickets(updated);
    return updated;
  },

  deleteCareer: (id: string) => {
    const list = db.getCareers();
    const updated = list.filter(item => item.id !== id);
    db.saveCareers(updated);
    return updated;
  },

  addCareer: (position: Omit<CareerPosition, 'id'>) => {
    const list = db.getCareers();
    const newPos = { ...position, id: `car_${Date.now()}` };
    db.saveCareers([...list, newPos]);
    return newPos;
  },

  addTask: (task: Omit<Task, 'id'>) => {
    const tasks = db.getTasks();
    const newTask: Task = { ...task, id: `task_${Date.now()}` };
    db.saveTasks([newTask, ...tasks]);
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

  // Calculate tenure details: returns year count & month count
  calculateTenure: (joinedDate: string): { years: number; totalMonths: number } => {
    const start = new Date(joinedDate);
    const today = new Date();
    let years = today.getFullYear() - start.getFullYear();
    let months = today.getMonth() - start.getMonth();
    if (months < 0 || (months === 0 && today.getDate() < start.getDate())) {
      years--;
      months += 12;
    }
    const totalMonths = (today.getFullYear() - start.getFullYear()) * 12 + (today.getMonth() - start.getMonth());
    return { years: Math.max(0, years), totalMonths: Math.max(0, totalMonths) };
  },

  // Calculate PTO Accrual dynamically based on individual anniversary tenure months
  calculatePTOAccrued: (joinedDate: string): number => {
    const { totalMonths } = db.calculateTenure(joinedDate);
    let totalAccrued = 0;

    // Monthly accrual rate lookups depending on which service year the month belongs to
    for (let m = 0; m < totalMonths; m++) {
      const yearOfService = Math.floor(m / 12) + 1;
      let monthlyRate = 0.83; // Default Year 1

      if (yearOfService === 2) monthlyRate = 1.0;
      else if (yearOfService === 3) monthlyRate = 1.17;
      else if (yearOfService === 4) monthlyRate = 1.33;
      else if (yearOfService === 5) monthlyRate = 1.5;
      else if (yearOfService === 6) monthlyRate = 1.67;
      else if (yearOfService === 7) monthlyRate = 1.83;
      else if (yearOfService === 8) monthlyRate = 2.08;
      else if (yearOfService === 9) monthlyRate = 2.25;
      else if (yearOfService >= 10) monthlyRate = 2.5;

      totalAccrued += monthlyRate;
    }

    return Math.min(30, Math.round(totalAccrued * 100) / 100);
  },

  // Remaining PTO: accrued minus taken approved PTO days
  getRemainingPTO: (fullName: string, joinedDate: string): number => {
    const accrued = db.calculatePTOAccrued(joinedDate);
    const leaves = db.getLeaves();
    const approvedPTODays = leaves
      .filter(l => l.employeeName === fullName && l.type === 'PTO' && l.status === 'approved')
      .reduce((acc, l) => {
        const dates = db.parseLeaveDates(l.duration);
        if (!dates) return acc + 1;
        const diff = Math.abs(dates.end.getTime() - dates.start.getTime());
        const days = Math.ceil(diff / (1000 * 3600 * 24)) + 1;
        return acc + days;
      }, 0);
    return Math.max(0, Math.round((accrued - approvedPTODays) * 100) / 100);
  },

  calculateCurrentSalary: (profile: Profile): number => {
    const joinedYear = new Date(profile.joinedDate).getFullYear();
    const currentYear = new Date().getFullYear();
    const years = Math.max(0, currentYear - joinedYear);
    return profile.baseSalary + (years * 10000);
  },

  getPayroll: (): PayrollRecord[] => {
    const employees = db.getEmployees();
    const payroll: PayrollRecord[] = getInitialData('hr_payroll_v6', []);
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
        role: emp.jobTitle || (emp.teams.includes('Design') ? 'UX Designer' : emp.teams.includes('Engineering') ? 'Software Engineer' : 'Operations Specialist'),
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

  savePayroll: (data: PayrollRecord[]) => saveData('hr_payroll_v6', data),

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
    return getInitialData('hr_custom_teams_v6', defaultTeams);
  },

  saveTeams: (data: string[]) => saveData('hr_custom_teams_v6', data),

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

  getNotifications: (): Notification[] => getInitialData('hr_notifications_v6', []),
  saveNotifications: (data: Notification[]) => saveData('hr_notifications_v6', data),

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
    
    // Dispatch custom event for real-time toast push notifications
    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent('newPushNotification', { detail: newNotif }));
    }
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
