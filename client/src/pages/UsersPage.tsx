import { useEffect, useState } from "react";
import type { FormEvent } from "react";
import { Header } from "../components/layout/Header";
import { Card } from "../components/ui/Card";
import { MetaApi, UsersApi } from "../lib/api";
import type { User } from "../types";

interface RoleOption {
  id: string;
  name: string;
  code: string;
}

interface DepartmentOption {
  id: string;
  name: string;
  code: string;
}

export function UsersPage() {
  const [users, setUsers] = useState<User[]>([]);
  const [roles, setRoles] = useState<RoleOption[]>([]);
  const [departments, setDepartments] = useState<DepartmentOption[]>([]);
  const [message, setMessage] = useState<string | null>(null);
  const [form, setForm] = useState({
    full_name: "",
    email: "",
    password: "",
    role_id: "",
    department_id: "",
  });

  async function load() {
    const [usersResponse, rolesResponse, departmentResponse] = await Promise.all([
      UsersApi.list().catch(() => []),
      MetaApi.roles().catch(() => []),
      MetaApi.departments().catch(() => []),
    ]);
    setUsers(usersResponse as User[]);
    setRoles(rolesResponse as RoleOption[]);
    setDepartments(departmentResponse as DepartmentOption[]);
    if (!form.role_id && rolesResponse.length) {
      setForm((prev) => ({ ...prev, role_id: (rolesResponse as RoleOption[])[0].id }));
    }
    if (!form.department_id && departmentResponse.length) {
      setForm((prev) => ({ ...prev, department_id: (departmentResponse as DepartmentOption[])[0].id }));
    }
  }

  useEffect(() => {
    void load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function createUser(event: FormEvent) {
    event.preventDefault();
    await UsersApi.create({
      ...form,
      department_id: form.department_id || null,
    });
    setForm({
      full_name: "",
      email: "",
      password: "",
      role_id: form.role_id,
      department_id: form.department_id,
    });
    setMessage("User created.");
    await load();
  }

  return (
    <div className="space-y-6">
      <Header title="Users & Roles" subtitle="Role-based access for admin, department user, approver, viewer." />
      <Card>
        <h3 className="font-heading text-lg font-semibold text-ink">Create User</h3>
        <form onSubmit={createUser} className="mt-3 grid gap-3 md:grid-cols-2">
          <input
            value={form.full_name}
            onChange={(event) => setForm((prev) => ({ ...prev, full_name: event.target.value }))}
            placeholder="Full Name"
            className="rounded-lg border border-slate-300 px-3 py-2 text-sm"
            required
          />
          <input
            type="email"
            value={form.email}
            onChange={(event) => setForm((prev) => ({ ...prev, email: event.target.value }))}
            placeholder="Email"
            className="rounded-lg border border-slate-300 px-3 py-2 text-sm"
            required
          />
          <input
            type="password"
            value={form.password}
            onChange={(event) => setForm((prev) => ({ ...prev, password: event.target.value }))}
            placeholder="Password"
            className="rounded-lg border border-slate-300 px-3 py-2 text-sm"
            required
          />
          <select
            value={form.role_id}
            onChange={(event) => setForm((prev) => ({ ...prev, role_id: event.target.value }))}
            className="rounded-lg border border-slate-300 px-3 py-2 text-sm"
            required
          >
            {roles.map((role) => (
              <option key={role.id} value={role.id}>
                {role.name}
              </option>
            ))}
          </select>
          <select
            value={form.department_id}
            onChange={(event) => setForm((prev) => ({ ...prev, department_id: event.target.value }))}
            className="rounded-lg border border-slate-300 px-3 py-2 text-sm md:col-span-2"
          >
            {departments.map((department) => (
              <option key={department.id} value={department.id}>
                {department.name}
              </option>
            ))}
          </select>
          {message ? <p className="rounded-lg bg-green-50 px-3 py-2 text-sm text-green-700 md:col-span-2">{message}</p> : null}
          <button className="rounded-lg bg-ink px-4 py-2 text-sm font-semibold text-white hover:bg-slate-800 md:col-span-2">
            Create User
          </button>
        </form>
      </Card>

      <Card>
        <h3 className="font-heading text-lg font-semibold text-ink">Existing Users</h3>
        <div className="mt-3 overflow-x-auto">
          <table className="min-w-full text-left text-sm">
            <thead className="bg-slate-100 text-xs uppercase text-slate-600">
              <tr>
                <th className="px-3 py-2">Name</th>
                <th className="px-3 py-2">Email</th>
                <th className="px-3 py-2">Role</th>
                <th className="px-3 py-2">Department</th>
              </tr>
            </thead>
            <tbody>
              {users.map((user) => (
                <tr key={user.id} className="border-b border-slate-100">
                  <td className="px-3 py-2">{user.full_name}</td>
                  <td className="px-3 py-2">{user.email}</td>
                  <td className="px-3 py-2">{user.role?.name}</td>
                  <td className="px-3 py-2">{user.department?.name ?? "-"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  );
}
