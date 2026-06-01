import { roles } from './roles.svelte';
import {
  listUsers,
  createUser,
  updateUser,
  deleteUser,
  type ApiUser,
  type UserInput
} from '$lib/api/users';

export type EmployeeStatus = 'active' | 'inactive';

// Mirrors the backend `users` table. Login uses `email`; PIN is for shift open.
// `password` is write-only — never read back from the API.
export type Employee = {
  id: string;
  name: string;
  email: string;
  phone: string;
  roleIds: string[];
  status: EmployeeStatus;
  joinedAt: string;
  pin: string;
};

export type EmployeeInput = Omit<Employee, 'id'> & {
  password: string;
};

function toEmployee(u: ApiUser): Employee {
  return {
    id: u.id,
    name: u.name,
    email: u.email,
    phone: u.phone,
    roleIds: u.roleIds,
    status: u.status,
    joinedAt: u.joinedAt.slice(0, 10),
    pin: u.pin
  };
}

function toUserInput(input: EmployeeInput): UserInput {
  return {
    email: input.email,
    name: input.name,
    phone: input.phone,
    password: input.password,
    pin: input.pin,
    status: input.status,
    joinedAt: input.joinedAt,
    roleIds: input.roleIds
  };
}

class EmployeesStore {
  items = $state<Employee[]>([]);
  loaded = $state(false);
  loading = $state(false);

  async load(): Promise<void> {
    if (this.loading) return;
    this.loading = true;
    try {
      const users = await listUsers();
      this.items = users.map(toEmployee);
      this.loaded = true;
    } finally {
      this.loading = false;
    }
  }

  async add(input: EmployeeInput): Promise<Employee> {
    const created = await createUser(toUserInput(input));
    const emp = toEmployee(created);
    this.items = [...this.items, emp];
    return emp;
  }

  async update(id: string, patch: EmployeeInput): Promise<Employee | undefined> {
    const updated = await updateUser(id, toUserInput(patch));
    const emp = toEmployee(updated);
    this.items = this.items.map((e) => (e.id === id ? emp : e));
    return emp;
  }

  async remove(id: string): Promise<void> {
    await deleteUser(id);
    this.items = this.items.filter((e) => e.id !== id);
  }

  getById(id: string): Employee | undefined {
    return this.items.find((e) => e.id === id);
  }

  getByEmail(email: string): Employee | undefined {
    const lower = email.trim().toLowerCase();
    return this.items.find((e) => e.email.toLowerCase() === lower);
  }

  verifyPin(employeeId: string, pin: string): boolean {
    const emp = this.getById(employeeId);
    if (!emp) return false;
    return emp.pin === pin;
  }

  active(): Employee[] {
    return this.items.filter((e) => e.status === 'active');
  }

  countByRole(roleId: string): number {
    return this.items.reduce((n, e) => n + (e.roleIds.includes(roleId) ? 1 : 0), 0);
  }
}

export const employees = new EmployeesStore();

export function roleLabelFor(employee: { roleIds: string[] }, separator = ' · '): string {
  return roles.labelFor(employee.roleIds, separator);
}
