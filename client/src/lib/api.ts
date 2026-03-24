import axios from "axios";
import type {
  Category,
  CorrespondenceItem,
  DashboardData,
  Department,
  Series,
  User,
} from "../types";

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL ?? "http://localhost:8000/api/v1";

export const api = axios.create({
  baseURL: API_BASE_URL,
});

type CacheEntry = {
  expiresAt: number;
  value: unknown;
};

const memoryCache = new Map<string, CacheEntry>();
const inflightCache = new Map<string, Promise<unknown>>();

function peekCacheValue<T>(key: string, allowExpired = true): T | undefined {
  const cached = memoryCache.get(key);
  if (!cached) return undefined;
  if (!allowExpired && cached.expiresAt <= Date.now()) return undefined;
  return cached.value as T;
}

function stableStringify(value: unknown): string {
  if (value === null || value === undefined) return "";
  if (typeof value !== "object") return String(value);
  if (Array.isArray(value)) return `[${value.map(stableStringify).join(",")}]`;
  const obj = value as Record<string, unknown>;
  const keys = Object.keys(obj).sort();
  return `{${keys.map((key) => `${key}:${stableStringify(obj[key])}`).join("|")}}`;
}

async function cachedQuery<T>(key: string, ttlMs: number, fn: () => Promise<T>): Promise<T> {
  const cached = memoryCache.get(key);
  if (cached && cached.expiresAt > Date.now()) {
    return cached.value as T;
  }

  const inflight = inflightCache.get(key);
  if (inflight) {
    return inflight as Promise<T>;
  }

  const promise = fn()
    .then((value) => {
      memoryCache.set(key, { value, expiresAt: Date.now() + ttlMs });
      return value;
    })
    .finally(() => {
      inflightCache.delete(key);
    });

  inflightCache.set(key, promise as Promise<unknown>);
  return promise;
}

function invalidateCache(prefixes: string[]) {
  for (const key of memoryCache.keys()) {
    if (prefixes.some((prefix) => key.startsWith(prefix))) {
      memoryCache.delete(key);
    }
  }
}

export function setAuthToken(token: string | null) {
  if (token) {
    api.defaults.headers.common.Authorization = `Bearer ${token}`;
  } else {
    delete api.defaults.headers.common.Authorization;
    memoryCache.clear();
    inflightCache.clear();
  }
}

export const AuthApi = {
  async login(email: string, password: string) {
    const { data } = await api.post("/auth/login", { email, password });
    return data as { token: { access_token: string; token_type: string }; user: User };
  },
  async me() {
    const { data } = await api.get("/auth/me");
    return data as User;
  },
};

export const MetaApi = {
  async categories() {
    return cachedQuery("meta:categories", 5 * 60 * 1000, async () => {
      const { data } = await api.get("/meta/categories");
      return data as Category[];
    });
  },
  peekCategories() {
    return peekCacheValue<Category[]>("meta:categories");
  },
  async departments() {
    return cachedQuery("meta:departments", 5 * 60 * 1000, async () => {
      const { data } = await api.get("/meta/departments");
      return data as Department[];
    });
  },
  peekDepartments() {
    return peekCacheValue<Department[]>("meta:departments");
  },
  async roles() {
    return cachedQuery("meta:roles", 5 * 60 * 1000, async () => {
      const { data } = await api.get("/meta/roles");
      return data as Array<{ id: string; name: string; code: string }>;
    });
  },
};

export const DashboardApi = {
  async get(params?: { include_activity?: boolean }) {
    const key = `dashboard:get:${stableStringify(params)}`;
    return cachedQuery(key, 60 * 1000, async () => {
      const { data } = await api.get("/dashboard", { params });
      return data as DashboardData;
    });
  },
  peek(params?: { include_activity?: boolean }) {
    const key = `dashboard:get:${stableStringify(params)}`;
    return peekCacheValue<DashboardData>(key);
  },
  async activity() {
    return cachedQuery("dashboard:activity", 60 * 1000, async () => {
      const { data } = await api.get("/dashboard/activity");
      return data as DashboardData["recent_activity"];
    });
  },
  async automation() {
    return cachedQuery("dashboard:automation", 60 * 1000, async () => {
      const { data } = await api.get("/dashboard/automation");
      return data as {
        awaiting_reply_series: number;
        pending_approval_items: number;
        drafts_in_progress: number;
        smart_reply_queue: Array<{
          series_id: string;
          series_number: string;
          subject: string;
          organization_name: string;
          latest_incoming_item_id: string;
          latest_incoming_subject: string;
          updated_at: string;
          due_date?: string | null;
        }>;
      };
    });
  },
};

export const SeriesApi = {
  async list(params?: { query?: string; status?: string }) {
    const key = `series:list:${stableStringify(params)}`;
    return cachedQuery(key, 60 * 1000, async () => {
      const { data } = await api.get("/series", { params });
      return data as { items: Series[]; total: number };
    });
  },
  peekList(params?: { query?: string; status?: string }) {
    const key = `series:list:${stableStringify(params)}`;
    return peekCacheValue<{ items: Series[]; total: number }>(key);
  },
  async get(seriesId: string) {
    return cachedQuery(`series:get:${seriesId}`, 60 * 1000, async () => {
      const { data } = await api.get(`/series/${seriesId}`);
      return data as Series;
    });
  },
  peek(seriesId: string) {
    return peekCacheValue<Series>(`series:get:${seriesId}`);
  },
  async create(payload: Record<string, unknown>) {
    const { data } = await api.post("/series", payload);
    invalidateCache(["series:", "dashboard:", "reports:"]);
    return data as Series;
  },
  async close(seriesId: string) {
    const { data } = await api.post(`/series/${seriesId}/close`);
    invalidateCache([`series:get:${seriesId}`, `series:items:${seriesId}`, "series:list:", "dashboard:", "reports:"]);
    return data as { message: string };
  },
  async items(seriesId: string) {
    return cachedQuery(`series:items:${seriesId}`, 60 * 1000, async () => {
      const { data } = await api.get(`/series/${seriesId}/items`);
      return data as { items: CorrespondenceItem[]; total: number };
    });
  },
  peekItems(seriesId: string) {
    return peekCacheValue<{ items: CorrespondenceItem[]; total: number }>(`series:items:${seriesId}`);
  },
  async addItem(seriesId: string, payload: Record<string, unknown>) {
    const { data } = await api.post(`/series/${seriesId}/items`, payload);
    invalidateCache([`series:get:${seriesId}`, `series:items:${seriesId}`, "series:list:", "dashboard:", "reports:", "approvals:"]);
    return data as CorrespondenceItem;
  },
  async updateItem(seriesId: string, itemId: string, payload: Record<string, unknown>) {
    const { data } = await api.patch(`/series/${seriesId}/items/${itemId}`, payload);
    invalidateCache([`series:get:${seriesId}`, `series:items:${seriesId}`, "series:list:", "dashboard:", "reports:", `approvals:item:${itemId}`]);
    return data as CorrespondenceItem;
  },
  async submitApproval(payload: { item_id: string; submitted_to_user_id: string; comments?: string }) {
    const { data } = await api.post("/approvals/submit", payload);
    invalidateCache(["dashboard:", "approvals:"]);
    return data;
  },
  async approvalHistory(itemId: string) {
    return cachedQuery(`approvals:item:${itemId}`, 10 * 1000, async () => {
      const { data } = await api.get(`/approvals/item/${itemId}`);
      return data;
    });
  },
  async upsertDispatch(itemId: string, payload: Record<string, unknown>) {
    const { data } = await api.put(`/dispatch/item/${itemId}`, payload);
    invalidateCache([`dispatch:item:${itemId}`, "dashboard:", "reports:"]);
    return data;
  },
  async getDispatch(itemId: string) {
    return cachedQuery(`dispatch:item:${itemId}`, 20 * 1000, async () => {
      const { data } = await api.get(`/dispatch/item/${itemId}`);
      return data;
    });
  },
  async uploadAttachments(seriesId: string, itemId: string, files: File[], attachmentType?: string) {
    const form = new FormData();
    files.forEach((file) => form.append("files", file));
    if (attachmentType) form.append("attachment_type", attachmentType);
    const { data } = await api.post(`/series/${seriesId}/items/${itemId}/attachments`, form, {
      headers: { "Content-Type": "multipart/form-data" },
    });
    invalidateCache([`series:items:${seriesId}`, `attachments:${seriesId}:${itemId}`]);
    return data;
  },
  async listAttachments(seriesId: string, itemId: string) {
    return cachedQuery(`attachments:${seriesId}:${itemId}`, 20 * 1000, async () => {
      const { data } = await api.get(`/series/${seriesId}/items/${itemId}/attachments`);
      return data;
    });
  },
  async generateAIDraft(payload: Record<string, unknown>) {
    const { data } = await api.post("/ai/draft", payload);
    invalidateCache(["dashboard:", "series:list:"]);
    return data as {
      draft_text: string;
      subject_suggestion?: string;
      reference_line?: string;
      thread_summary?: string;
      context_preview: Record<string, unknown>;
    };
  },
};

export const AIApi = {
  async autoReply(payload: {
    series_id: string;
    selected_letter_item_id?: string;
    prompt_instructions?: string;
    tone?: string;
    draft_purpose?: string;
    thread_scope?: string;
    file_scope?: string;
    length_preference?: string;
  }) {
    const { data } = await api.post("/ai/auto-reply", payload);
    invalidateCache(["series:", "dashboard:", "reports:"]);
    return data as {
      series_id: string;
      item_id: string;
      letter_number?: string | null;
      draft_text: string;
      subject_suggestion?: string | null;
      reference_line?: string | null;
    };
  },
};

export const ApprovalsApi = {
  async pending() {
    return cachedQuery("approvals:pending", 10 * 1000, async () => {
      const { data } = await api.get("/approvals/pending");
      return data as Array<{
        approval_id: string;
        item_id: string;
        series_id: string;
        series_number: string;
        series_subject: string;
        organization_name: string;
        sequence_no: number;
        item_type: string;
        item_subject: string;
        letter_number?: string | null;
        diary_number?: string | null;
        outgoing_status?: string | null;
        submitted_at: string;
        submitted_by_user_id: string;
        submitted_by_name?: string | null;
        comments?: string | null;
        current_decision: string;
        final_draft_excerpt?: string | null;
      }>;
    });
  },
  async decide(approvalId: string, payload: { decision: string; comments?: string; sent_back_reason?: string }) {
    const { data } = await api.post(`/approvals/${approvalId}/decision`, payload);
    invalidateCache(["approvals:", "dashboard:", "series:", "reports:"]);
    return data;
  },
};

export const SearchApi = {
  async search(payload: Record<string, unknown>) {
    const { data } = await api.post("/search", payload);
    return data as {
      total: number;
      items: Array<{
        series_id: string;
        series_number: string;
        item_id?: string;
        diary_number?: string;
        letter_number?: string;
        subject: string;
        organization_name: string;
        direction?: string;
        tracking_number?: string;
      }>;
    };
  },
};

export const ReportsApi = {
  async summary() {
    return cachedQuery("reports:summary", 20 * 1000, async () => {
      const { data } = await api.get("/reports/summary");
      return data as { metrics: Array<{ label: string; value: number }> };
    });
  },
};

export const UsersApi = {
  async list() {
    return cachedQuery("users:list", 2 * 60 * 1000, async () => {
      const { data } = await api.get("/users");
      return data as User[];
    });
  },
  peekList() {
    return peekCacheValue<User[]>("users:list");
  },
  async create(payload: Record<string, unknown>) {
    const { data } = await api.post("/users", payload);
    invalidateCache(["users:list"]);
    return data as User;
  },
};
