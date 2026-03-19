import { Component, Input, Output, EventEmitter, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import {
  trigger,
  transition,
  style,
  animate,
} from '@angular/animations';
import { BudgetService } from '../../services/budget.service';
import { CategorySummary, BudgetItem, RecurringFrequency, occurrencesPerMonth } from '../../models/budget.model';
import { ItemDetailModalComponent } from '../item-detail-modal/item-detail-modal.component';

@Component({
  selector: 'app-category-card',
  standalone: true,
  imports: [CommonModule, FormsModule, ItemDetailModalComponent],
  templateUrl: './category-card.component.html',
  animations: [
    trigger('expandCollapse', [
      transition(':enter', [
        style({ height: '0', opacity: 0, overflow: 'hidden' }),
        animate(
          '220ms cubic-bezier(0.16, 1, 0.3, 1)',
          style({ height: '*', opacity: 1 })
        ),
      ]),
      transition(':leave', [
        style({ overflow: 'hidden' }),
        animate(
          '160ms cubic-bezier(0.4, 0, 1, 1)',
          style({ height: '0', opacity: 0 })
        ),
      ]),
    ]),
  ],
})
export class CategoryCardComponent {
  @Input() categorySummary!: CategorySummary;
  @Input() totalIncome = 0;
  @Output() addItem = new EventEmitter<void>();

  private budgetService = inject(BudgetService);

  expanded = false;
  editingPlanned: string | null = null;
  editingActual: string | null = null;
  selectedItem: BudgetItem | null = null; // item abierto en el modal de detalle

  readonly FREQUENCY_LABELS: Record<RecurringFrequency, string> = {
    weekly:    'Semanal',
    biweekly:  'Quincenal',
    monthly:   'Mensual',
    quarterly: 'Trimestral',
    yearly:    'Anual',
  };

  // ─── Computed getters ────────────────────────────────────────────────────────

  get progressPercent(): number {
    const { totalActual, totalPlanned } = this.categorySummary;
    if (totalPlanned === 0) return 0;
    return Math.min((totalActual / totalPlanned) * 100, 100);
  }

  get incomePercent(): number {
    if (this.totalIncome === 0) return 0;
    return (this.categorySummary.totalPlanned / this.totalIncome) * 100;
  }

  get isOverSpent(): boolean {
    return this.categorySummary.variance > 0 && this.categorySummary.totalPlanned > 0;
  }

  get progressColor(): string {
    if (this.isOverSpent) return '#FF7B7B';
    if (this.progressPercent >= 100) return '#C9F131';
    return this.categorySummary.category.color;
  }

  get statusLabel(): string {
    const { totalActual, totalPlanned, variance } = this.categorySummary;
    if (totalPlanned === 0) return 'Sin planificar';
    if (variance > 0) return `+${this.fmt(variance)} excedido`;
    if (variance < 0) return `${this.fmt(Math.abs(variance))} disponible`;
    return 'Exacto';
  }

  get hasItems(): boolean {
    return this.categorySummary.category.items.length > 0;
  }

  // ─── Actions ─────────────────────────────────────────────────────────────────

  toggle(): void {
    this.expanded = !this.expanded;
  }

  togglePaid(item: BudgetItem): void {
    this.budgetService.togglePaid(this.categorySummary.category.id, item.id);
  }

  removeItem(itemId: string): void {
    this.budgetService.removeItem(this.categorySummary.category.id, itemId);
  }

  // Edición del importe planificado (siempre disponible)
  startEditPlanned(itemId: string): void {
    this.editingActual = null;
    this.editingPlanned = itemId;
  }

  commitPlanned(itemId: string, value: string): void {
    const amount = parseFloat(value) || 0;
    if (amount > 0) {
      this.budgetService.updateItem(
        this.categorySummary.category.id,
        itemId,
        { plannedAmount: amount }
      );
    }
    this.editingPlanned = null;
  }

  // Edición del importe real (solo para conceptos marcados como pagados)
  startEditActual(itemId: string): void {
    this.editingPlanned = null;
    this.editingActual = itemId;
  }

  commitActual(itemId: string, value: string): void {
    const amount = parseFloat(value) || 0;
    this.budgetService.updateActualAmount(
      this.categorySummary.category.id,
      itemId,
      amount
    );
    this.editingActual = null;
  }

  cancelEdit(): void {
    this.editingPlanned = null;
    this.editingActual = null;
  }

  openDetail(item: BudgetItem, event: MouseEvent): void {
    event.stopPropagation();
    this.editingPlanned = null;
    this.editingActual = null;
    this.selectedItem = item;
  }

  closeDetail(): void {
    this.selectedItem = null;
  }

  frequencyLabel(freq: RecurringFrequency | undefined): string {
    return freq ? this.FREQUENCY_LABELS[freq] : 'Mensual';
  }

  /** Number of monthly occurrences for this item */
  itemOccurrences(item: BudgetItem): number {
    if (!item.isRecurring) return 1;
    return occurrencesPerMonth(item.recurringFrequency);
  }

  /** Monthly planned amount (per-occurrence × occurrences) */
  monthlyPlanned(item: BudgetItem): number {
    return item.plannedAmount * this.itemOccurrences(item);
  }

  /** Short suffix for weekly/biweekly display */
  frequencySuffix(freq: RecurringFrequency | undefined): string {
    if (freq === 'weekly') return '/sem';
    if (freq === 'biweekly') return '/quin';
    return '';
  }

  onAddItem(event: MouseEvent): void {
    event.stopPropagation();
    this.expanded = true;
    this.addItem.emit();
  }

  // ─── Formatting ──────────────────────────────────────────────────────────────

  fmt(amount: number): string {
    return amount.toLocaleString('es-ES', {
      style: 'currency',
      currency: 'EUR',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    });
  }

  fmtDecimal(amount: number): string {
    return amount.toLocaleString('es-ES', {
      style: 'currency',
      currency: 'EUR',
      minimumFractionDigits: 2,
    });
  }

  trackById(_: number, item: BudgetItem): string {
    return item.id;
  }
}
