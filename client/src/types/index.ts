export type RoleCode = "admin" | "department_user" | "approver" | "viewer";

export type Direction = "incoming" | "outgoing";
export type DispatchMode = "by_hand" | "courier" | "email";

export type SeriesStatus =
  | "open"
  | "awaiting_internal_draft"
  | "awaiting_approval"
  | "awaiting_external_response"
  | "closed";

export interface AuthToken {
  access_token: string;
  token_type: string;
}

export interface Role {
  id: string;
  name: string;
  code: RoleCode;
}

export interface Department {
  id: string;
  name: string;
  code: string;
}

export interface User {
  id: string;
  full_name: string;
  email: string;
  is_active: boolean;
  role: Role;
  department?: Department | null;
}

export interface Category {
  id: string;
  name: string;
  code: string;
  description?: string | null;
  is_active: boolean;
}

export interface Series {
  id: string;
  series_number: string;
  category_id: string;
  subject: string;
  organization_name: string;
  started_with: Direction;
  status: SeriesStatus;
  assigned_department_id?: string | null;
  assigned_to_user_id?: string | null;
  priority: "low" | "medium" | "high" | "urgent";
  opened_at: string;
  closed_at?: string | null;
  total_exchanges: number;
  latest_direction?: Direction | null;
  latest_item_id?: string | null;
  due_date?: string | null;
  notes?: string | null;
  created_at: string;
  updated_at: string;
}

export interface CorrespondenceItem {
  id: string;
  series_id: string;
  sequence_no: number;
  direction: Direction;
  item_type: string;
  diary_number?: string | null;
  letter_number?: string | null;
  subject: string;
  sender_name?: string | null;
  sender_organization?: string | null;
  recipient_name?: string | null;
  recipient_organization?: string | null;
  recipient_address_email?: string | null;
  in_reference_to?: string | null;
  date_on_letter?: string | null;
  received_date?: string | null;
  sent_date?: string | null;
  mode: DispatchMode;
  incoming_status?: string | null;
  outgoing_status?: string | null;
  prompt_title?: string | null;
  prompt_text?: string | null;
  ai_draft_text?: string | null;
  final_draft_text?: string | null;
  remarks?: string | null;
  mode_specific_data?: Record<string, unknown> | null;
  created_at: string;
  updated_at: string;
}

export interface DashboardData {
  summary: {
    total_open_series: number;
    total_pending_approval: number;
    total_overdue: number;
    total_awaiting_external_response: number;
    total_drafts_in_progress: number;
    recently_closed: number;
  };
  categories: Array<{
    category_id: string;
    category_name: string;
    open_series: number;
    pending_draft: number;
    pending_approval: number;
    awaiting_external_response: number;
    overdue_items: number;
    closed_this_month: number;
  }>;
  recent_activity: Array<{
    action: string;
    entity: string;
    entity_id?: string | null;
    timestamp: string;
    actor?: string | null;
  }>;
}

