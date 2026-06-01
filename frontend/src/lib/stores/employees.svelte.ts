import { roles } from './roles.svelte';

export type EmployeeStatus = 'active' | 'inactive';

export type Employee = {
  id: string;
  name: string;
  email: string;
  phone: string;
  username: string;
  password: string;
  roleIds: string[];
  status: EmployeeStatus;
  joinedAt: string;
  pin: string;
};

export type EmployeeInput = Omit<Employee, 'id'>;

const seed: Employee[] = [
  {
    id: 'emp_1',
    name: 'Sari Wahyuni',
    email: 'sari@warmindo.test',
    phone: '+62 812-3456-7890',
    username: 'admin',
    password: 'admin123',
    roleIds: ['role_admin'],
    status: 'active',
    joinedAt: '2023-01-10',
    pin: '1234'
  },
  {
    id: 'emp_2',
    name: 'Joko Susilo',
    email: 'joko@warmindo.test',
    phone: '+62 813-9876-5432',
    username: 'joko',
    password: 'joko123',
    roleIds: ['role_manajer'],
    status: 'active',
    joinedAt: '2023-06-20',
    pin: '2580'
  },
  {
    id: 'emp_3',
    name: 'Rina Marlina',
    email: 'rina@warmindo.test',
    phone: '+62 821-1122-3344',
    username: 'kasir',
    password: 'kasir123',
    roleIds: ['role_kasir'],
    status: 'active',
    joinedAt: '2024-02-15',
    pin: '4321'
  },
  {
    id: 'emp_4',
    name: 'Andi Pratama',
    email: 'andi@warmindo.test',
    phone: '+62 822-5566-7788',
    username: 'andi',
    password: 'andi123',
    roleIds: ['role_kasir', 'role_gudang'],
    status: 'active',
    joinedAt: '2024-09-01',
    pin: '1357'
  },
  {
    id: 'emp_5',
    name: 'Dimas Saputra',
    email: 'dimas@warmindo.test',
    phone: '+62 823-4455-6677',
    username: 'dimas',
    password: 'dimas123',
    roleIds: ['role_staf'],
    status: 'inactive',
    joinedAt: '2025-03-05',
    pin: '8642'
  }
];

class EmployeesStore {
  items = $state<Employee[]>(structuredClone(seed));
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

  getByUsername(username: string): Employee | undefined {
    const u = username.trim().toLowerCase();
    return this.items.find((e) => e.username.toLowerCase() === u);
  }

  verifyPin(employeeId: string, pin: string): boolean {
    const emp = this.getById(employeeId);
    if (!emp) return false;
    return emp.pin === pin;
  }

  active(): Employee[] {
    return this.items.filter((e) => e.status === 'active');
  }

  /** Count of employees currently assigned to a given role. */
  countByRole(roleId: string): number {
    return this.items.reduce((n, e) => n + (e.roleIds.includes(roleId) ? 1 : 0), 0);
  }
}

export const employees = new EmployeesStore();

/** Human-readable label for an employee's role membership. */
export function roleLabelFor(employee: { roleIds: string[] }, separator = ' · '): string {
  return roles.labelFor(employee.roleIds, separator);
}
