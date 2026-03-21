import { Component, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { BudgetService } from '../../services/budget.service';
import { BudgetRingComponent } from '../budget-ring/budget-ring.component';
import { CategoryCardComponent } from '../category-card/category-card.component';
import { AddItemModalComponent } from '../add-item-modal/add-item-modal.component';
import { IncomeModalComponent } from '../income-modal/income-modal.component';
import { BudgetCategory } from '../../models/budget.model';

@Component({
  selector: 'app-dashboard',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    BudgetRingComponent,
    CategoryCardComponent,
    AddItemModalComponent,
    IncomeModalComponent,
  ],
  templateUrl: './dashboard.component.html',
})
export class DashboardComponent {
  protected svc = inject(BudgetService);

  readonly budget  = this.svc.budget;
  readonly summary = this.svc.summary;

  // ─── Nombres de meses en español ────────────────────────────────────────────
  readonly MONTHS = [
    'Enero','Febrero','Marzo','Abril','Mayo','Junio',
    'Julio','Agosto','Septiembre','Octubre','Noviembre','Diciembre',
  ];

  get monthName(): string {
    return this.MONTHS[this.budget().month - 1];
  }

  // ─── Navegación ─────────────────────────────────────────────────────────────

  prevMonth(): void { this.svc.navigateMonth(-1); }
  nextMonth(): void { this.svc.navigateMonth(1); }

  // ─── Modal: Ingresos ────────────────────────────────────────────────────────

  incomePanelOpen = signal(false);
  openIncomePanel(): void  { this.incomePanelOpen.set(true); }
  closeIncomePanel(): void { this.incomePanelOpen.set(false); }

  // ─── Panel: Asignar ingresos sin asignar ────────────────────────────────────

  assignPanelOpen    = signal(false);
  assignCategoryId   = signal<string>('');
  assignAmount       = signal<number | null>(null);
  assignConcept      = signal('Disponible');

  get assignableCategories(): BudgetCategory[] {
    return this.budget().categories;
  }

  openAssignPanel(): void {
    const cats = this.budget().categories;
    this.assignCategoryId.set(cats[0]?.id ?? '');
    this.assignAmount.set(Math.floor(this.summary().unallocated));
    this.assignConcept.set('Disponible');
    this.assignPanelOpen.set(true);
  }

  closeAssignPanel(): void {
    this.assignPanelOpen.set(false);
  }

  onAssignBackdropClick(event: MouseEvent): void {
    if ((event.target as HTMLElement).classList.contains('modal-backdrop')) {
      this.closeAssignPanel();
    }
  }

  confirmAssign(): void {
    const amount  = this.assignAmount();
    const catId   = this.assignCategoryId();
    const concept = this.assignConcept().trim() || 'Disponible';
    if (!amount || amount <= 0 || !catId) return;
    this.svc.addItem(catId, {
      name: concept,
      plannedAmount: amount,
      actualAmount: 0,
      isPaid: false,
      isRecurring: false,
    });
    this.assignPanelOpen.set(false);
  }

  onAssignAmountInput(event: Event): void {
    const val = parseFloat((event.target as HTMLInputElement).value);
    this.assignAmount.set(isNaN(val) ? null : val);
  }

  onAssignCategoryChange(event: Event): void {
    this.assignCategoryId.set((event.target as HTMLSelectElement).value);
  }

  onAssignConceptInput(event: Event): void {
    this.assignConcept.set((event.target as HTMLInputElement).value);
  }

  // ─── Modal: Añadir concepto ──────────────────────────────────────────────────

  modalOpen        = signal(false);
  selectedCategory = signal<BudgetCategory | null>(null);

  openModal(category: BudgetCategory): void {
    this.selectedCategory.set(category);
    this.modalOpen.set(true);
  }

  closeModal(): void {
    this.modalOpen.set(false);
    this.selectedCategory.set(null);
  }

  // ─── Formato ─────────────────────────────────────────────────────────────────

  fmt(amount: number, decimals = 0): string {
    return amount.toLocaleString('es-ES', {
      style: 'currency',
      currency: 'EUR',
      minimumFractionDigits: decimals,
      maximumFractionDigits: decimals,
    });
  }

  fmtPct(value: number): string {
    return value.toFixed(1) + '%';
  }

  trackByCategoryId(_: number, c: { category: BudgetCategory }): string {
    return c.category.id;
  }

  protected readonly Math = Math;
}
