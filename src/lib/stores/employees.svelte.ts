export type EmployeeRole = 'admin' | 'manager' | 'cashier' | 'staff';
export type EmployeeStatus = 'active' | 'inactive';

export type Employee = {
  id: string;
  name: string;
  email: string;
  phone: string;
  role: EmployeeRole;
  status: EmployeeStatus;
  joinedAt: string;
};

export type EmployeeInput = Omit<Employee, 'id'>;

const seed: Employee[] = [
  {
    id: 'emp_1',
    name: 'Maria Lopez',
    email: 'maria.lopez@store.test',
    phone: '+1 (415) 555-0142',
    role: 'manager',
    status: 'active',
    joinedAt: '2024-03-12'
  },
  {
    id: 'emp_2',
    name: 'James Chen',
    email: 'james.chen@store.test',
    phone: '+1 (415) 555-0177',
    role: 'cashier',
    status: 'active',
    joinedAt: '2024-08-04'
  },
  {
    id: 'emp_3',
    name: 'Aisha Patel',
    email: 'aisha.patel@store.test',
    phone: '+1 (415) 555-0193',
    role: 'admin',
    status: 'active',
    joinedAt: '2023-11-20'
  },
  {
    id: 'emp_4',
    name: 'Diego Ortiz',
    email: 'diego.ortiz@store.test',
    phone: '+1 (415) 555-0108',
    role: 'staff',
    status: 'inactive',
    joinedAt: '2025-01-30'
  }
];

class EmployeesStore {
  items = $state<Employee[]>([...seed]);
  private nextId = seed.length + 1;

  add(input: EmployeeInput): Employee {
    const employee: Employee = { ...input, id: `emp_${this.nextId++}` };
    this.items.push(employee);
    return employee;
  }

  update(id: string, patch: Partial<EmployeeInput>): Employee | undefined {
    const idx = this.items.findIndex((e) => e.id === id);
    if (idx === -1) return undefined;
    this.items[idx] = { ...this.items[idx], ...patch };
    return this.items[idx];
  }

  remove(id: string) {
    this.items = this.items.filter((e) => e.id !== id);
  }

  getById(id: string): Employee | undefined {
    return this.items.find((e) => e.id === id);
  }
}

export const employees = new EmployeesStore();

export const roleLabels: Record<EmployeeRole, string> = {
  admin: 'Admin',
  manager: 'Manajer',
  cashier: 'Kasir',
  staff: 'Staf'
};
