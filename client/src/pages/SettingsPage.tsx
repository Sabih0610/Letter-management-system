/* eslint-disable react-hooks/set-state-in-effect */
import { useEffect, useState } from "react";
import type { FormEvent } from "react";
import { Header } from "../components/layout/Header";
import { Card } from "../components/ui/Card";
import { MetaApi, api } from "../lib/api";
import type { Category, Department } from "../types";

export function SettingsPage() {
  const [categories, setCategories] = useState<Category[]>([]);
  const [departments, setDepartments] = useState<Department[]>([]);
  const [categoryForm, setCategoryForm] = useState({ name: "", code: "", description: "" });
  const [departmentForm, setDepartmentForm] = useState({ name: "", code: "" });
  const [message, setMessage] = useState<string | null>(null);

  async function load() {
    const [categoryResponse, departmentResponse] = await Promise.all([MetaApi.categories(), MetaApi.departments()]);
    setCategories(categoryResponse);
    setDepartments(departmentResponse);
  }

  useEffect(() => {
    void load();
  }, []);

  async function createCategory(event: FormEvent) {
    event.preventDefault();
    await api.post("/meta/categories", { ...categoryForm, is_active: true });
    setCategoryForm({ name: "", code: "", description: "" });
    setMessage("Category created.");
    await load();
  }

  async function createDepartment(event: FormEvent) {
    event.preventDefault();
    await api.post("/meta/departments", { ...departmentForm, is_active: true });
    setDepartmentForm({ name: "", code: "" });
    setMessage("Department created.");
    await load();
  }

  return (
    <div className="space-y-6">
      <Header title="System Settings" subtitle="Configure correspondence categories and departments." />
      {message ? <p className="rounded-lg bg-green-50 px-3 py-2 text-sm text-green-700">{message}</p> : null}

      <div className="grid gap-6 xl:grid-cols-2">
        <Card>
          <h3 className="font-heading text-lg font-semibold text-ink">Categories</h3>
          <form onSubmit={createCategory} className="mt-3 grid gap-3">
            <input
              value={categoryForm.name}
              onChange={(event) => setCategoryForm((prev) => ({ ...prev, name: event.target.value }))}
              placeholder="Category Name (e.g., PTA Correspondence)"
              className="rounded-lg border border-slate-300 px-3 py-2 text-sm"
              required
            />
            <input
              value={categoryForm.code}
              onChange={(event) => setCategoryForm((prev) => ({ ...prev, code: event.target.value }))}
              placeholder="Code (e.g., PTA)"
              className="rounded-lg border border-slate-300 px-3 py-2 text-sm"
              required
            />
            <input
              value={categoryForm.description}
              onChange={(event) => setCategoryForm((prev) => ({ ...prev, description: event.target.value }))}
              placeholder="Description"
              className="rounded-lg border border-slate-300 px-3 py-2 text-sm"
            />
            <button className="rounded-lg bg-ink px-4 py-2 text-sm font-semibold text-white hover:bg-slate-800">
              Add Category
            </button>
          </form>
          <ul className="mt-4 space-y-2 text-sm">
            {categories.map((category) => (
              <li key={category.id} className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-2">
                <span className="font-semibold">{category.name}</span> ({category.code})
              </li>
            ))}
          </ul>
        </Card>

        <Card>
          <h3 className="font-heading text-lg font-semibold text-ink">Departments</h3>
          <form onSubmit={createDepartment} className="mt-3 grid gap-3">
            <input
              value={departmentForm.name}
              onChange={(event) => setDepartmentForm((prev) => ({ ...prev, name: event.target.value }))}
              placeholder="Department Name"
              className="rounded-lg border border-slate-300 px-3 py-2 text-sm"
              required
            />
            <input
              value={departmentForm.code}
              onChange={(event) => setDepartmentForm((prev) => ({ ...prev, code: event.target.value }))}
              placeholder="Code"
              className="rounded-lg border border-slate-300 px-3 py-2 text-sm"
              required
            />
            <button className="rounded-lg bg-ink px-4 py-2 text-sm font-semibold text-white hover:bg-slate-800">
              Add Department
            </button>
          </form>
          <ul className="mt-4 space-y-2 text-sm">
            {departments.map((department) => (
              <li key={department.id} className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-2">
                <span className="font-semibold">{department.name}</span> ({department.code})
              </li>
            ))}
          </ul>
        </Card>
      </div>
    </div>
  );
}
