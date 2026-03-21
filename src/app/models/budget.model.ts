// ─────────────────────────────────────────────────────────────────────────────
// MODELO DE DATOS — Planificación de Presupuesto Mensual
// ─────────────────────────────────────────────────────────────────────────────

/** Tipos de categoría disponibles */
export type CategoryType =
  | 'housing'       // Gastos de vivienda (alquiler, hipoteca, comunidad)
  | 'utilities'     // Servicios básicos (agua, luz, gas, internet)
  | 'savings'       // Ahorros (fondo de emergencia, metas)
  | 'unexpected'    // Gastos imprevistos (colchón)
  | 'personal'      // Ocio y gastos personales (restaurantes, ropa, gym)
  | 'investments'   // Inversiones (bolsa, fondos, cripto, planes de pensiones)
  | 'subscriptions'; // Suscripciones (streaming, software, revistas)

/** Frecuencia de recurrencia de un gasto */
export type RecurringFrequency = 'weekly' | 'biweekly' | 'monthly' | 'quarterly' | 'yearly';

/** Un concepto individual dentro de una categoría */
export interface BudgetItem {
  id: string;
  name: string;
  plannedAmount: number;   // Importe por ocurrencia (para weekly ×4, biweekly ×2)
  actualAmount: number;    // Importe real gastado
  isPaid: boolean;         // ¿Pagado / ejecutado?
  dueDate?: string;        // Fecha límite (ISO: YYYY-MM-DD)
  isRecurring: boolean;    // ¿Se repite cada mes?
  recurringFrequency?: RecurringFrequency;
  notes?: string;
  createdAt: string;       // ISO timestamp
}

/** Categoría de gasto con sus conceptos */
export interface BudgetCategory {
  id: string;
  type: CategoryType;
  name: string;
  icon: string;
  color: string;  // HEX color para visualizaciones
  items: BudgetItem[];
}

/** Fuente de ingresos del mes.
 *  isFromTemplate=true  → copiada de una plantilla; se repetirá en futuros meses
 *  isFromTemplate=false → ingreso puntual (regalo, venta, bonus…); solo este mes */
export interface IncomeSource {
  id: string;
  name: string;
  amount: number;
  isFromTemplate: boolean;
  templateItemId?: string;
  /** Frecuencia heredada del ítem de plantilla (solo para display si isFromTemplate=true) */
  recurringFrequency?: RecurringFrequency;
}

/** Presupuesto mensual completo */
export interface MonthlyBudget {
  id: string;
  month: number;  // 1–12
  year: number;
  incomeSources: IncomeSource[];
  categories: BudgetCategory[];
  /** Plantilla aplicada al crear este presupuesto, si existe. */
  template?: { id: string; name: string };
  createdAt: string;
  updatedAt: string;
}

/** Returns how many times an item occurs per month (for budget calculations).
 *  weekly=4, biweekly=2, everything else=1 */
export function occurrencesPerMonth(frequency?: RecurringFrequency): number {
  if (frequency === 'weekly') return 4;
  if (frequency === 'biweekly') return 2;
  return 1;
}

// ─────────────────────────────────────────────────────────────────────────────
// TIPOS DERIVADOS / COMPUTADOS
// ─────────────────────────────────────────────────────────────────────────────

/** Resumen calculado de una categoría */
export interface CategorySummary {
  category: BudgetCategory;
  totalPlanned: number;
  totalActual: number;
  percentageOfIncome: number;   // % respecto al ingreso total
  percentageOfBudget: number;   // % respecto al total planificado
  variance: number;             // actual - planned (+ = sobrepasado)
  paidCount: number;
  pendingCount: number;
}

/** Resumen global del presupuesto (coherencia matemática) */
export interface BudgetSummary {
  totalIncome: number;
  totalPlanned: number;
  totalActual: number;
  unallocated: number;          // totalIncome - totalPlanned
  savingsAmount: number;        // Planificado en ahorros
  savingsRate: number;          // savingsAmount / totalIncome * 100
  spendingAmount: number;       // Todo lo que no es ahorro ni inversión
  investmentAmount: number;
  isOverBudget: boolean;        // totalPlanned > totalIncome
  allocationPercentage: number; // totalPlanned / totalIncome * 100
  executionRate: number;        // totalActual / totalPlanned * 100
  categories: CategorySummary[];
}
