import { Injectable, computed, signal } from '@angular/core';
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

// ─────────────────────────────────────────────────────────────────────────────
// Configuración por defecto de categorías
// ─────────────────────────────────────────────────────────────────────────────
const CATEGORY_DEFAULTS: Omit<BudgetCategory, 'id' | 'items'>[] = [
  { type: 'housing',       name: 'Vivienda',           icon: '🏠', color: '#7C9EFF' },
  { type: 'utilities',     name: 'Servicios básicos',  icon: '⚡', color: '#FFD166' },
  { type: 'savings',       name: 'Ahorros',            icon: '💎', color: '#C9F131' },
  { type: 'unexpected',    name: 'Imprevistos',        icon: '🛡️', color: '#FF7B7B' },
  { type: 'personal',      name: 'Ocio y personal',   icon: '✨', color: '#B4A7FF' },
  { type: 'investments',   name: 'Inversiones',        icon: '📈', color: '#4DFFB4' },
  { type: 'subscriptions', name: 'Suscripciones',     icon: '📱', color: '#FF9F4A' },
];

@Injectable({ providedIn: 'root' })
export class BudgetService {
  private readonly STORAGE_KEY = 'presupuesto';
  private readonly BASE_INCOME_KEY = 'presupuesto_base_income';

  /** Signal: indica si hay ingresos base guardados */
  readonly hasBaseIncome = signal(this.loadBaseIncomeEntries().length > 0);

  /** Señal reactiva con el presupuesto activo */
  readonly budget = signal<MonthlyBudget>(this.loadCurrentMonth());

  /** Resumen matemáticamente coherente del presupuesto */
  readonly summary = computed<BudgetSummary>(() => this.compute(this.budget()));

  // ─── Carga / Persistencia ───────────────────────────────────────────────────

  private loadCurrentMonth(): MonthlyBudget {
    const now = new Date();
    return this.loadMonth(now.getMonth() + 1, now.getFullYear());
  }

  private loadMonth(month: number, year: number): MonthlyBudget {
    const key = `${this.STORAGE_KEY}_${year}_${month}`;
    try {
      const stored = localStorage.getItem(key);
      if (stored) return JSON.parse(stored) as MonthlyBudget;
    } catch { /* continúa con el default */ }
    return this.createDefault(month, year);
  }

  private createDefault(month: number, year: number): MonthlyBudget {
    const now = new Date().toISOString();
    // Buscar la plantilla base más reciente aplicable a este mes
    const entries = this.loadBaseIncomeEntries();
    const targetTotal = year * 12 + month;
    let baseSources: Omit<IncomeSource, 'id'>[] | null = null;
    let baseIncomeTemplate: { month: number; year: number } | undefined;
    let bestTotal = -1;

    for (const e of entries) {
      const eTotal = Number(e.effectiveFrom.year) * 12 + Number(e.effectiveFrom.month);
      if (eTotal <= targetTotal && eTotal > bestTotal) {
        bestTotal = eTotal;
        baseSources = e.sources;
        baseIncomeTemplate = e.effectiveFrom;
      }
    }

    return {
      id: crypto.randomUUID(),
      month,
      year,
      incomeSources: baseSources
        ? baseSources.map(s => ({ ...s, id: crypto.randomUUID() }))
        : [{ id: crypto.randomUUID(), name: 'Salario neto', amount: 0, isRecurring: true }],
      categories: CATEGORY_DEFAULTS.map(cat => ({
        ...cat,
        id: crypto.randomUUID(),
        items: [],
      })),
      baseIncomeTemplate,
      createdAt: now,
      updatedAt: now,
    };
  }

  // ─── Ingresos base versionados (plantilla por fecha de efecto) ───────────────

  private loadBaseIncomeEntries(): Array<{
    effectiveFrom: { month: number; year: number };
    sources: Omit<IncomeSource, 'id'>[];
  }> {
    try {
      const stored = localStorage.getItem(this.BASE_INCOME_KEY);
      if (!stored) return [];
      const parsed = JSON.parse(stored);
      if (!Array.isArray(parsed) || parsed.length === 0) return [];
      // Distinguir formato nuevo (tiene effectiveFrom) del antiguo (array plano)
      if ('effectiveFrom' in parsed[0]) return parsed;
      // Migración formato antiguo: aplicar desde el principio de los tiempos
      return [{ effectiveFrom: { month: 1, year: 2000 }, sources: parsed }];
    } catch { return []; }
  }

  private loadBaseIncomeForMonth(month: number, year: number): Omit<IncomeSource, 'id'>[] | null {
    const entries = this.loadBaseIncomeEntries();
    if (entries.length === 0) return null;
    const targetTotal = year * 12 + month;

    // Iterar todas las entradas y quedarse con la más reciente cuyo
    // effectiveFrom sea ≤ al mes destino. No depende del orden del array.
    let bestSources: Omit<IncomeSource, 'id'>[] | null = null;
    let bestTotal = -1;

    for (const e of entries) {
      const eTotal = Number(e.effectiveFrom.year) * 12 + Number(e.effectiveFrom.month);
      if (eTotal <= targetTotal && eTotal > bestTotal) {
        bestTotal = eTotal;
        bestSources = e.sources;
      }
    }

    return bestSources;
  }

  /** Guarda los ingresos del mes actual como plantilla base efectiva desde ese mes */
  saveBaseIncome(): void {
    const sources = this.budget().incomeSources.map(({ id: _id, ...rest }) => rest);
    const { month, year } = this.budget();
    const entries = this.loadBaseIncomeEntries()
      .filter(e => !(e.effectiveFrom.month === month && e.effectiveFrom.year === year));
    entries.push({ effectiveFrom: { month, year }, sources });
    entries.sort((a, b) =>
      (a.effectiveFrom.year * 12 + a.effectiveFrom.month) -
      (b.effectiveFrom.year * 12 + b.effectiveFrom.month)
    );
    localStorage.setItem(this.BASE_INCOME_KEY, JSON.stringify(entries));
    this.hasBaseIncome.set(true);
  }

  /** Elimina todas las plantillas de ingresos base */
  clearBaseIncome(): void {
    localStorage.removeItem(this.BASE_INCOME_KEY);
    this.hasBaseIncome.set(false);
  }

  private persist(budget: MonthlyBudget): void {
    const key = `${this.STORAGE_KEY}_${budget.year}_${budget.month}`;
    const updated = { ...budget, updatedAt: new Date().toISOString() };
    localStorage.setItem(key, JSON.stringify(updated));
    this.budget.set(updated);
  }

  // ─── Cálculo matemático ─────────────────────────────────────────────────────

  private compute(budget: MonthlyBudget): BudgetSummary {
    const totalIncome = budget.incomeSources.reduce(
      (sum, s) => sum + (s.amount || 0), 0
    );

    const categories: CategorySummary[] = budget.categories.map(cat => {
      const totalPlanned = cat.items.reduce((s, i) =>
        s + (i.plannedAmount || 0) * occurrencesPerMonth(i.recurringFrequency), 0);
      const totalActual  = cat.items.reduce((s, i) => s + (i.actualAmount  || 0), 0);
      const paid    = cat.items.filter(i => i.isPaid).length;
      const pending = cat.items.filter(i => !i.isPaid).length;

      return {
        category: cat,
        totalPlanned,
        totalActual,
        percentageOfIncome: totalIncome > 0 ? (totalPlanned / totalIncome) * 100 : 0,
        percentageOfBudget: 0, // se recalcula abajo
        variance: totalActual - totalPlanned,
        paidCount: paid,
        pendingCount: pending,
      };
    });

    const totalPlanned = categories.reduce((s, c) => s + c.totalPlanned, 0);
    const totalActual  = categories.reduce((s, c) => s + c.totalActual,  0);

    // Recalcular percentageOfBudget ahora que tenemos totalPlanned
    categories.forEach(c => {
      c.percentageOfBudget = totalPlanned > 0
        ? (c.totalPlanned / totalPlanned) * 100
        : 0;
    });

    const savings    = categories.find(c => c.category.type === 'savings');
    const investment = categories.find(c => c.category.type === 'investments');

    return {
      totalIncome,
      totalPlanned,
      totalActual,
      unallocated: totalIncome - totalPlanned,
      savingsAmount: savings?.totalPlanned    ?? 0,
      savingsRate:   totalIncome > 0 ? ((savings?.totalPlanned ?? 0) / totalIncome) * 100 : 0,
      investmentAmount: investment?.totalPlanned ?? 0,
      spendingAmount: totalPlanned - (savings?.totalPlanned ?? 0) - (investment?.totalPlanned ?? 0),
      isOverBudget: totalPlanned > totalIncome && totalIncome > 0,
      allocationPercentage: totalIncome > 0 ? (totalPlanned / totalIncome) * 100 : 0,
      executionRate: totalPlanned > 0 ? (totalActual / totalPlanned) * 100 : 0,
      categories,
    };
  }

  // ─── Navegación mensual ─────────────────────────────────────────────────────

  navigateMonth(direction: 1 | -1): void {
    const { month, year } = this.budget();
    let m = month + direction;
    let y = year;
    if (m > 12) { m = 1;  y++; }
    if (m < 1)  { m = 12; y--; }
    let loaded = this.loadMonth(m, y);
    loaded = this.syncRecurringFromPreviousMonths(loaded);
    loaded = this.syncBaseIncomeIfNeeded(loaded);
    this.budget.set(loaded);
  }

  /**
   * Aplica la plantilla base al mes destino si:
   * - Los ingresos son 0 (mes nunca configurado), O
   * - Los ingresos vienen de una plantilla ANTERIOR a la más reciente aplicable.
   * Si el usuario editó los ingresos manualmente (baseIncomeTemplate === undefined
   * con ingresos > 0), no se toca nada.
   */
  private syncBaseIncomeIfNeeded(budget: MonthlyBudget): MonthlyBudget {
    const entries = this.loadBaseIncomeEntries();
    if (entries.length === 0) return budget;

    const targetTotal = budget.year * 12 + budget.month;

    // Buscar la plantilla más reciente aplicable (effectiveFrom ≤ mes destino)
    let bestSources: Omit<IncomeSource, 'id'>[] | null = null;
    let bestEffective: { month: number; year: number } | undefined;
    let bestTotal = -1;

    for (const e of entries) {
      const eTotal = Number(e.effectiveFrom.year) * 12 + Number(e.effectiveFrom.month);
      if (eTotal <= targetTotal && eTotal > bestTotal) {
        bestTotal = eTotal;
        bestSources = e.sources;
        bestEffective = e.effectiveFrom;
      }
    }

    if (!bestSources || !bestEffective) return budget;

    const totalIncome = budget.incomeSources.reduce((s, src) => s + (src.amount || 0), 0);

    // Ingresos > 0 configurados manualmente → no tocar nunca
    if (totalIncome > 0 && !budget.baseIncomeTemplate) return budget;

    // Ingresos de plantilla → actualizar si hay una plantilla más reciente O si el
    // contenido de la misma versión de plantilla ha cambiado (p.ej. se editó y re-guardó)
    if (totalIncome > 0 && budget.baseIncomeTemplate) {
      const appliedTotal =
        Number(budget.baseIncomeTemplate.year) * 12 + Number(budget.baseIncomeTemplate.month);
      if (appliedTotal > bestTotal) return budget; // Plantilla aplicada es más reciente (no debería ocurrir)
      if (appliedTotal === bestTotal) {
        // Same version: re-apply only if content changed (different total or different sources)
        const templateTotal = bestSources.reduce((s, src) => s + (src.amount || 0), 0);
        if (totalIncome === templateTotal) return budget; // Content identical, nothing to do
        // Falls through → apply updated content
      }
    }

    // Aplicar plantilla (mes en 0, o tiene plantilla antigua)
    const updated: MonthlyBudget = {
      ...budget,
      incomeSources: bestSources.map(s => ({ ...s, id: crypto.randomUUID() })),
      baseIncomeTemplate: bestEffective,
      updatedAt: new Date().toISOString(),
    };

    localStorage.setItem(
      `${this.STORAGE_KEY}_${budget.year}_${budget.month}`,
      JSON.stringify(updated)
    );
    return updated;
  }

  /**
   * Al navegar a un mes, revisa los meses anteriores en busca de conceptos
   * recurrentes que deberían estar en el mes destino pero no están.
   * Esto corrige casos donde el push inicial falló o el mes ya existía.
   */
  private syncRecurringFromPreviousMonths(budget: MonthlyBudget): MonthlyBudget {
    const { month, year } = budget;

    // Cuántos meses atrás mirar según frecuencia
    const lookbacks: Array<{ distances: number[]; frequencies: RecurringFrequency[] }> = [
      { distances: [1, 2, 3],  frequencies: ['monthly', 'biweekly', 'weekly'] },
      { distances: [3, 6],     frequencies: ['quarterly'] },
      { distances: [12],       frequencies: ['yearly'] },
    ];

    let categories = budget.categories.map(c => ({ ...c, items: [...c.items] }));
    let changed = false;

    for (const { distances, frequencies } of lookbacks) {
      for (const distance of distances) {
        let srcM = month - distance;
        let srcY = year;
        while (srcM < 1) { srcM += 12; srcY--; }

        // Solo leer meses que ya existen en localStorage (no crear vacíos)
        const raw = localStorage.getItem(`${this.STORAGE_KEY}_${srcY}_${srcM}`);
        if (!raw) continue;

        let srcBudget: MonthlyBudget;
        try { srcBudget = JSON.parse(raw); } catch { continue; }

        for (const srcCat of srcBudget.categories) {
          const recurringItems = srcCat.items.filter(i =>
            i.isRecurring && i.recurringFrequency && frequencies.includes(i.recurringFrequency)
          );
          if (recurringItems.length === 0) continue;

          const targetIdx = categories.findIndex(c => c.type === srcCat.type);
          if (targetIdx === -1) continue;

          for (const item of recurringItems) {
            const exists = categories[targetIdx].items.some(
              i => i.name === item.name && i.isRecurring
            );
            if (exists) continue;

            categories[targetIdx].items = [
              ...categories[targetIdx].items,
              {
                ...item,
                id: crypto.randomUUID(),
                actualAmount: 0,
                isPaid: false,
                createdAt: new Date().toISOString(),
              },
            ];
            changed = true;
          }
        }
      }
    }

    if (!changed) return budget;

    const synced: MonthlyBudget = { ...budget, categories, updatedAt: new Date().toISOString() };
    localStorage.setItem(`${this.STORAGE_KEY}_${year}_${month}`, JSON.stringify(synced));
    return synced;
  }

  // ─── Ingresos ───────────────────────────────────────────────────────────────

  setIncome(sourceId: string, amount: number): void {
    const b = this.budget();
    this.persist({
      ...b,
      baseIncomeTemplate: undefined, // Edición manual: desvincula de plantilla
      incomeSources: b.incomeSources.map(s =>
        s.id === sourceId ? { ...s, amount: Math.max(0, amount) } : s
      ),
    });
  }

  updateIncomeName(sourceId: string, name: string): void {
    const b = this.budget();
    this.persist({
      ...b,
      incomeSources: b.incomeSources.map(s =>
        s.id === sourceId ? { ...s, name } : s
      ),
    });
  }

  addIncomeSource(): void {
    const b = this.budget();
    const source: IncomeSource = {
      id: crypto.randomUUID(),
      name: 'Otros ingresos',
      amount: 0,
      isRecurring: false,
    };
    this.persist({ ...b, baseIncomeTemplate: undefined, incomeSources: [...b.incomeSources, source] });
  }

  removeIncomeSource(id: string): void {
    const b = this.budget();
    if (b.incomeSources.length <= 1) return;
    this.persist({ ...b, baseIncomeTemplate: undefined, incomeSources: b.incomeSources.filter(s => s.id !== id) });
  }

  // ─── Items ──────────────────────────────────────────────────────────────────

  addItem(categoryId: string, item: Omit<BudgetItem, 'id' | 'createdAt'>): void {
    const newItem: BudgetItem = {
      ...item,
      id: crypto.randomUUID(),
      createdAt: new Date().toISOString(),
    };
    this.mutateCategory(categoryId, cat => ({
      ...cat,
      items: [...cat.items, newItem],
    }));

    // Propagar a meses futuros si es recurrente
    if (item.isRecurring) {
      const { month, year } = this.budget();
      this.propagateRecurring(categoryId, newItem, month, year);
    }
  }

  updateItem(categoryId: string, itemId: string, updates: Partial<BudgetItem>): void {
    this.mutateCategory(categoryId, cat => ({
      ...cat,
      items: cat.items.map(i => i.id === itemId ? { ...i, ...updates } : i),
    }));
  }

  removeItem(categoryId: string, itemId: string): void {
    this.mutateCategory(categoryId, cat => ({
      ...cat,
      items: cat.items.filter(i => i.id !== itemId),
    }));
  }

  togglePaid(categoryId: string, itemId: string): void {
    this.mutateCategory(categoryId, cat => ({
      ...cat,
      items: cat.items.map(i => {
        if (i.id !== itemId) return i;
        const isPaid = !i.isPaid;
        return {
          ...i, isPaid,
          actualAmount: isPaid
            ? i.plannedAmount * occurrencesPerMonth(i.recurringFrequency)
            : 0,
        };
      }),
    }));
  }

  updateActualAmount(categoryId: string, itemId: string, amount: number): void {
    this.mutateCategory(categoryId, cat => ({
      ...cat,
      items: cat.items.map(i =>
        i.id === itemId
          ? { ...i, actualAmount: Math.max(0, amount), isPaid: amount > 0 }
          : i
      ),
    }));
  }

  // ─── Propagación de recurrencias ────────────────────────────────────────────

  /** Copia un item recurrente a los meses futuros según su frecuencia */
  propagateRecurring(
    categoryId: string,
    item: BudgetItem,
    sourceMonth: number,
    sourceYear: number
  ): void {
    // Obtener el TYPE de la categoría origen (los IDs cambian entre meses, el tipo no)
    const sourceCategory = this.budget().categories.find(c => c.id === categoryId);
    if (!sourceCategory) return;

    const targets = this.getRecurringTargets(
      sourceMonth,
      sourceYear,
      item.recurringFrequency ?? 'monthly'
    );

    targets.forEach(({ month, year }) => {
      const targetBudget = this.loadMonth(month, year);

      // Buscar por TYPE, no por id (cada mes tiene sus propios UUIDs)
      const targetCategory = targetBudget.categories.find(
        c => c.type === sourceCategory.type
      );
      if (!targetCategory) return;

      // Evitar duplicados (mismo nombre + recurrente en esa categoría)
      const alreadyExists = targetCategory.items.some(
        i => i.name === item.name && i.isRecurring
      );
      if (alreadyExists) return;

      const propagated: BudgetItem = {
        ...item,
        id: crypto.randomUUID(),
        actualAmount: 0,
        isPaid: false,
        createdAt: new Date().toISOString(),
      };

      const updatedBudget: MonthlyBudget = {
        ...targetBudget,
        categories: targetBudget.categories.map(c =>
          // Usar el id de la categoría DESTINO para actualizar correctamente
          c.id === targetCategory.id ? { ...c, items: [...c.items, propagated] } : c
        ),
        updatedAt: new Date().toISOString(),
      };

      const key = `${this.STORAGE_KEY}_${year}_${month}`;
      localStorage.setItem(key, JSON.stringify(updatedBudget));
    });
  }

  /** Devuelve los meses destino para cada tipo de recurrencia */
  private getRecurringTargets(
    month: number,
    year: number,
    frequency: RecurringFrequency
  ): { month: number; year: number }[] {
    const results: { month: number; year: number }[] = [];

    switch (frequency) {
      case 'weekly':
      case 'biweekly':
      case 'monthly': {
        // Próximos 11 meses (1 año completo)
        let m = month, y = year;
        for (let i = 0; i < 11; i++) {
          m++; if (m > 12) { m = 1; y++; }
          results.push({ month: m, year: y });
        }
        break;
      }
      case 'quarterly': {
        // 3 siguientes trimestres
        let m = month, y = year;
        for (let i = 0; i < 3; i++) {
          m += 3; if (m > 12) { m -= 12; y++; }
          results.push({ month: m, year: y });
        }
        break;
      }
      case 'yearly': {
        // Mismo mes del año siguiente
        results.push({ month, year: year + 1 });
        break;
      }
    }

    return results;
  }

  private mutateCategory(
    categoryId: string,
    fn: (cat: BudgetCategory) => BudgetCategory
  ): void {
    const b = this.budget();
    this.persist({
      ...b,
      categories: b.categories.map(c => c.id === categoryId ? fn(c) : c),
    });
  }

  // ─── Utilidades ─────────────────────────────────────────────────────────────

  getCategoryType(type: CategoryType): BudgetCategory | undefined {
    return this.budget().categories.find(c => c.type === type);
  }

  resetMonth(): void {
    const { month, year } = this.budget();
    this.persist(this.createDefault(month, year));
  }
}
