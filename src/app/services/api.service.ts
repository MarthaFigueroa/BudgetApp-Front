import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';

const API_BASE = 'http://localhost:3001/api';

// ─── Response types ───────────────────────────────────────────────────────────

export interface ApiIncomeSource {
  id:                 string;
  name:               string;
  amount:             number;
  isFromTemplate:     boolean;
  templateItemId:     string | null;
  recurringFrequency: string | null;   // from template item, for display only
  budgetId:           string;
}

export interface ApiItemDetail {
  id:                 string;
  name:               string;
  plannedAmount:      number;
  actualAmount:       number;
  isPaid:             boolean;
  dueDate:            string | null;
  isRecurring:        boolean;
  recurringFrequency: string | null;
  notes:              string | null;
  createdAt:          string;
}

export interface ApiCategorySummary {
  id:                  string;
  type:                string;
  name:                string;
  icon:                string;
  color:               string;
  totalPlanned:        number;
  totalActual:         number;
  percentageOfIncome:  number;
  percentageOfBudget:  number;
  variance:            number;
  paidCount:           number;
  pendingCount:        number;
  items:               ApiItemDetail[];
}

export interface ApiBudgetResponse {
  id:        string;
  month:     number;
  year:      number;
  createdAt: string;
  updatedAt: string;
  template:  { id: string; name: string } | null;
  incomeSources: ApiIncomeSource[];
  summary: {
    totalIncome:          number;
    totalPlanned:         number;
    totalActual:          number;
    unallocated:          number;
    savingsAmount:        number;
    savingsRate:          number;
    spendingAmount:       number;
    investmentAmount:     number;
    isOverBudget:         boolean;
    allocationPercentage: number;
    executionRate:        number;
    categories:           ApiCategorySummary[];
  };
}

// ─── Request payload types ────────────────────────────────────────────────────

export interface CreateItemPayload {
  name:               string;
  plannedAmount:      number;
  actualAmount?:      number;
  isPaid?:            boolean;
  dueDate?:           string;
  isRecurring?:       boolean;
  recurringFrequency?: string;
  notes?:             string;
}

export interface UpdateItemPayload {
  name?:               string;
  plannedAmount?:      number;
  actualAmount?:       number;
  isPaid?:             boolean;
  dueDate?:            string | null;
  isRecurring?:        boolean;
  recurringFrequency?: string;
  notes?:              string | null;
}

// ─── Service ─────────────────────────────────────────────────────────────────

@Injectable({ providedIn: 'root' })
export class ApiService {
  private readonly http = inject(HttpClient);

  // ── Budget ────────────────────────────────────────────────────────────────

  getBudget(year: number, month: number) {
    return this.http.get<ApiBudgetResponse>(`${API_BASE}/budgets/${year}/${month}`);
  }

  // ── Income sources ────────────────────────────────────────────────────────

  addIncomeSource(year: number, month: number, data: { name: string; amount: number }) {
    return this.http.post<ApiIncomeSource>(`${API_BASE}/budgets/${year}/${month}/income`, data);
  }

  updateIncomeSource(year: number, month: number, id: string, data: Partial<{ name: string; amount: number }>) {
    return this.http.put<ApiIncomeSource>(`${API_BASE}/budgets/${year}/${month}/income/${id}`, data);
  }

  deleteIncomeSource(year: number, month: number, id: string) {
    return this.http.delete<void>(`${API_BASE}/budgets/${year}/${month}/income/${id}`);
  }

  /** Toggles whether the income source is recurring (template) or one-time. */
  toggleRecurring(year: number, month: number, sourceId: string) {
    return this.http.patch<ApiIncomeSource>(
      `${API_BASE}/budgets/${year}/${month}/income/${sourceId}/toggle-recurring`,
      {},
    );
  }

  // ── Budget items ──────────────────────────────────────────────────────────

  addItem(year: number, month: number, categoryId: string, data: CreateItemPayload) {
    return this.http.post<ApiItemDetail>(
      `${API_BASE}/budgets/${year}/${month}/categories/${categoryId}/items`, data,
    );
  }

  updateItem(year: number, month: number, categoryId: string, itemId: string, data: UpdateItemPayload) {
    return this.http.put<ApiItemDetail>(
      `${API_BASE}/budgets/${year}/${month}/categories/${categoryId}/items/${itemId}`, data,
    );
  }

  deleteItem(year: number, month: number, categoryId: string, itemId: string) {
    return this.http.delete<void>(
      `${API_BASE}/budgets/${year}/${month}/categories/${categoryId}/items/${itemId}`,
    );
  }

  togglePaid(year: number, month: number, categoryId: string, itemId: string) {
    return this.http.patch<ApiItemDetail>(
      `${API_BASE}/budgets/${year}/${month}/categories/${categoryId}/items/${itemId}/toggle-paid`, {},
    );
  }

  updateActualAmount(year: number, month: number, categoryId: string, itemId: string, amount: number) {
    return this.http.patch<ApiItemDetail>(
      `${API_BASE}/budgets/${year}/${month}/categories/${categoryId}/items/${itemId}/actual`,
      { amount },
    );
  }

  // ── Income templates (read-only from UI) ─────────────────────────────────

  getTemplates() {
    return this.http.get<{ id: string; name: string; createdAt: string }[]>(`${API_BASE}/templates`);
  }
}
