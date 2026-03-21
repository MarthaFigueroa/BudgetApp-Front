import { Injectable, computed, signal, inject } from '@angular/core';
import { firstValueFrom } from 'rxjs';
import {
  BudgetCategory,
  BudgetItem,
  BudgetSummary,
  CategorySummary,
  CategoryType,
  IncomeSource,
  MonthlyBudget,
  RecurringFrequency,
  occurrencesPerMonth,
} from '../models/budget.model';
import { ApiService, ApiBudgetResponse, ApiCategorySummary } from './api.service';

@Injectable({ providedIn: 'root' })
export class BudgetService {
  private readonly api = inject(ApiService);

  readonly loading = signal(false);
  readonly budget  = signal<MonthlyBudget>(this._emptyBudget());
  readonly summary = computed<BudgetSummary>(() => this._compute(this.budget()));

  constructor() {
    const now = new Date();
    this._load(now.getMonth() + 1, now.getFullYear());
  }

  // ─── Carga / Refresco ────────────────────────────────────────────────────────

  private async _load(month: number, year: number): Promise<void> {
    this.loading.set(true);
    try {
      const response = await firstValueFrom(this.api.getBudget(year, month));
      this.budget.set(this._mapBudget(response));
    } catch (err) {
      console.error('[BudgetService] Error cargando presupuesto:', err);
    } finally {
      this.loading.set(false);
    }
  }

  private async _refresh(): Promise<void> {
    const { month, year } = this.budget();
    await this._load(month, year);
  }

  // ─── Mapeo API → modelo frontend ─────────────────────────────────────────────

  private _mapBudget(r: ApiBudgetResponse): MonthlyBudget {
    return {
      id:    r.id,
      month: r.month,
      year:  r.year,
      incomeSources: r.incomeSources.map((s) => ({
        id:                 s.id,
        name:               s.name,
        amount:             s.amount,
        isFromTemplate:     s.isFromTemplate,
        templateItemId:     s.templateItemId ?? undefined,
        recurringFrequency: (s.recurringFrequency as RecurringFrequency) ?? undefined,
      })),
      categories: r.summary.categories.map((c) => this._mapCategory(c)),
      template:   r.template ?? undefined,
      createdAt:  r.createdAt,
      updatedAt:  r.updatedAt,
    };
  }

  private _mapCategory(c: ApiCategorySummary): BudgetCategory {
    return {
      id: c.id, type: c.type as CategoryType,
      name: c.name, icon: c.icon, color: c.color,
      items: c.items.map((i) => ({
        id: i.id, name: i.name,
        plannedAmount: i.plannedAmount, actualAmount: i.actualAmount,
        isPaid: i.isPaid,
        dueDate: i.dueDate ?? undefined,
        isRecurring: i.isRecurring,
        recurringFrequency: (i.recurringFrequency as RecurringFrequency) ?? undefined,
        notes: i.notes ?? undefined,
        createdAt: i.createdAt,
      })),
    };
  }

  // ─── Cálculo matemático ──────────────────────────────────────────────────────

  private _compute(budget: MonthlyBudget): BudgetSummary {
    const totalIncome = budget.incomeSources.reduce((sum, s) => sum + (s.amount || 0), 0);

    const categories: CategorySummary[] = budget.categories.map((cat) => {
      const totalPlanned = cat.items.reduce(
        (s, i) => s + (i.plannedAmount || 0) * occurrencesPerMonth(i.recurringFrequency), 0,
      );
      const totalActual = cat.items.reduce((s, i) => s + (i.actualAmount || 0), 0);
      return {
        category: cat, totalPlanned, totalActual,
        percentageOfIncome: totalIncome > 0 ? (totalPlanned / totalIncome) * 100 : 0,
        percentageOfBudget: 0,
        variance: totalActual - totalPlanned,
        paidCount:   cat.items.filter((i) => i.isPaid).length,
        pendingCount: cat.items.filter((i) => !i.isPaid).length,
      };
    });

    const totalPlanned = categories.reduce((s, c) => s + c.totalPlanned, 0);
    const totalActual  = categories.reduce((s, c) => s + c.totalActual, 0);
    categories.forEach((c) => {
      c.percentageOfBudget = totalPlanned > 0 ? (c.totalPlanned / totalPlanned) * 100 : 0;
    });

    const savings    = categories.find((c) => c.category.type === 'savings');
    const investment = categories.find((c) => c.category.type === 'investments');

    return {
      totalIncome, totalPlanned, totalActual,
      unallocated:          totalIncome - totalPlanned,
      savingsAmount:        savings?.totalPlanned ?? 0,
      savingsRate:          totalIncome > 0 ? ((savings?.totalPlanned ?? 0) / totalIncome) * 100 : 0,
      investmentAmount:     investment?.totalPlanned ?? 0,
      spendingAmount:       totalPlanned - (savings?.totalPlanned ?? 0) - (investment?.totalPlanned ?? 0),
      isOverBudget:         totalPlanned > totalIncome && totalIncome > 0,
      allocationPercentage: totalIncome > 0 ? (totalPlanned / totalIncome) * 100 : 0,
      executionRate:        totalPlanned > 0 ? (totalActual / totalPlanned) * 100 : 0,
      categories,
    };
  }

  // ─── Navegación mensual ──────────────────────────────────────────────────────

  navigateMonth(direction: 1 | -1): void {
    const { month, year } = this.budget();
    let m = month + direction;
    let y = year;
    if (m > 12) { m = 1;  y++; }
    if (m < 1)  { m = 12; y--; }
    this._load(m, y);
  }

  // ─── Ingresos ────────────────────────────────────────────────────────────────

  private _incomeTimers = new Map<string, ReturnType<typeof setTimeout>>();

  setIncome(sourceId: string, amount: number): void {
    const b = this.budget();
    // Actualización optimista
    this.budget.set({
      ...b,
      incomeSources: b.incomeSources.map((s) =>
        s.id === sourceId ? { ...s, amount: Math.max(0, amount) } : s,
      ),
    });
    // Debounce 600ms
    const existing = this._incomeTimers.get(sourceId);
    if (existing) clearTimeout(existing);
    this._incomeTimers.set(
      sourceId,
      setTimeout(async () => {
        try {
          await firstValueFrom(
            this.api.updateIncomeSource(b.year, b.month, sourceId, { amount: Math.max(0, amount) }),
          );
          await this._refresh();
        } catch (err) {
          console.error('[BudgetService] Error actualizando ingreso:', err);
        }
        this._incomeTimers.delete(sourceId);
      }, 600),
    );
  }

  updateIncomeName(sourceId: string, name: string): void {
    const { month, year } = this.budget();
    firstValueFrom(this.api.updateIncomeSource(year, month, sourceId, { name }))
      .then(() => this._refresh())
      .catch((err) => console.error('[BudgetService] Error actualizando nombre de ingreso:', err));
  }

  addIncomeSource(): void {
    const { month, year } = this.budget();
    firstValueFrom(this.api.addIncomeSource(year, month, { name: 'Otros ingresos', amount: 0 }))
      .then(() => this._refresh())
      .catch((err) => console.error('[BudgetService] Error añadiendo fuente de ingreso:', err));
  }

  removeIncomeSource(id: string): void {
    if (this.budget().incomeSources.length <= 1) return;
    const { month, year } = this.budget();
    firstValueFrom(this.api.deleteIncomeSource(year, month, id))
      .then(() => this._refresh())
      .catch((err) => console.error('[BudgetService] Error eliminando fuente de ingreso:', err));
  }

  /** Marca/desmarca un ingreso como recurrente (plantilla). */
  toggleRecurring(sourceId: string): void {
    const { month, year } = this.budget();
    // No optimistic update: we update the signal directly from the API response
    // to avoid the flicker caused by the source briefly disappearing between sections.
    firstValueFrom(this.api.toggleRecurring(year, month, sourceId))
      .then((updated) => {
        this.budget.update((b) => ({
          ...b,
          incomeSources: b.incomeSources.map((s) =>
            s.id === sourceId
              ? {
                  ...s,
                  isFromTemplate:     updated.isFromTemplate,
                  templateItemId:     updated.templateItemId  ?? undefined,
                  recurringFrequency: (updated.recurringFrequency as RecurringFrequency) ?? undefined,
                }
              : s,
          ),
        }));
      })
      .catch((err) => console.error('[BudgetService] Error toggling recurrente:', err));
  }

  // ─── Items ───────────────────────────────────────────────────────────────────

  addItem(categoryId: string, item: Omit<BudgetItem, 'id' | 'createdAt'>): void {
    const { month, year } = this.budget();
    firstValueFrom(
      this.api.addItem(year, month, categoryId, {
        name: item.name, plannedAmount: item.plannedAmount,
        actualAmount: item.actualAmount, isPaid: item.isPaid, dueDate: item.dueDate,
        isRecurring: item.isRecurring, recurringFrequency: item.recurringFrequency, notes: item.notes,
      }),
    )
      .then(() => this._refresh())
      .catch((err) => console.error('[BudgetService] Error añadiendo concepto:', err));
  }

  updateItem(categoryId: string, itemId: string, updates: Partial<BudgetItem>): void {
    const { month, year } = this.budget();
    firstValueFrom(
      this.api.updateItem(year, month, categoryId, itemId, {
        name: updates.name, plannedAmount: updates.plannedAmount,
        actualAmount: updates.actualAmount, isPaid: updates.isPaid,
        dueDate: updates.dueDate !== undefined ? (updates.dueDate ?? null) : undefined,
        isRecurring: updates.isRecurring, recurringFrequency: updates.recurringFrequency,
        notes: updates.notes !== undefined ? (updates.notes ?? null) : undefined,
      }),
    )
      .then(() => this._refresh())
      .catch((err) => console.error('[BudgetService] Error actualizando concepto:', err));
  }

  removeItem(categoryId: string, itemId: string): void {
    const { month, year } = this.budget();
    firstValueFrom(this.api.deleteItem(year, month, categoryId, itemId))
      .then(() => this._refresh())
      .catch((err) => console.error('[BudgetService] Error eliminando concepto:', err));
  }

  togglePaid(categoryId: string, itemId: string): void {
    const { month, year } = this.budget();
    firstValueFrom(this.api.togglePaid(year, month, categoryId, itemId))
      .then(() => this._refresh())
      .catch((err) => console.error('[BudgetService] Error toggling pagado:', err));
  }

  updateActualAmount(categoryId: string, itemId: string, amount: number): void {
    const { month, year } = this.budget();
    firstValueFrom(this.api.updateActualAmount(year, month, categoryId, itemId, amount))
      .then(() => this._refresh())
      .catch((err) => console.error('[BudgetService] Error actualizando importe real:', err));
  }

  // ─── Utilidades ──────────────────────────────────────────────────────────────

  getCategoryType(type: CategoryType): BudgetCategory | undefined {
    return this.budget().categories.find((c) => c.type === type);
  }

  resetMonth(): void {
    const { month, year } = this.budget();
    this._load(month, year);
  }

  private _emptyBudget(): MonthlyBudget {
    const now = new Date();
    return {
      id: '', month: now.getMonth() + 1, year: now.getFullYear(),
      incomeSources: [], categories: [],
      createdAt: now.toISOString(), updatedAt: now.toISOString(),
    };
  }
}
