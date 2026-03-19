import { Component, Input, Output, EventEmitter, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { BudgetService } from '../../services/budget.service';
import { BudgetCategory, RecurringFrequency, occurrencesPerMonth } from '../../models/budget.model';

export const FREQUENCY_OPTIONS: { value: RecurringFrequency; label: string; desc: string }[] = [
  { value: 'monthly',   label: 'Mensual',     desc: 'Se propaga a los próximos 11 meses' },
  { value: 'quarterly', label: 'Trimestral',  desc: 'Se propaga cada 3 meses (3 veces)' },
  { value: 'biweekly',  label: 'Quincenal',   desc: 'Se propaga a los próximos 11 meses' },
  { value: 'weekly',    label: 'Semanal',     desc: 'Se propaga a los próximos 11 meses' },
  { value: 'yearly',    label: 'Anual',       desc: 'Se propaga al mismo mes del año siguiente' },
];

@Component({
  selector: 'app-add-item-modal',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './add-item-modal.component.html',
})
export class AddItemModalComponent {
  @Input() category!: BudgetCategory;
  @Output() close = new EventEmitter<void>();

  private budgetService = inject(BudgetService);

  name = '';
  plannedAmount: number | null = null;
  dueDate = '';
  isRecurring = false;
  recurringFrequency: RecurringFrequency = 'monthly';
  notes = '';

  readonly frequencyOptions = FREQUENCY_OPTIONS;

  get isValid(): boolean {
    return (
      this.name.trim().length > 0 &&
      this.plannedAmount !== null &&
      this.plannedAmount > 0
    );
  }

  get selectedFrequencyDesc(): string {
    return this.frequencyOptions.find(f => f.value === this.recurringFrequency)?.desc ?? '';
  }

  /** Label for the amount field based on selected frequency */
  get amountLabel(): string {
    if (!this.isRecurring) return 'Importe planificado (€)';
    if (this.recurringFrequency === 'weekly')   return 'Importe por semana (€)';
    if (this.recurringFrequency === 'biweekly') return 'Importe por quincena (€)';
    return 'Importe planificado (€)';
  }

  /** Monthly equivalent when weekly/biweekly, null otherwise */
  get monthlyPreview(): number | null {
    const occ = occurrencesPerMonth(this.recurringFrequency);
    if (!this.isRecurring || occ <= 1 || !this.plannedAmount || this.plannedAmount <= 0) return null;
    return this.plannedAmount * occ;
  }

  /** How many occurrences for the preview label */
  get previewOccurrences(): number {
    return occurrencesPerMonth(this.recurringFrequency);
  }

  /** Simple amount formatter */
  fmtAmount(n: number): string {
    return n.toLocaleString('es-ES', {
      style: 'currency', currency: 'EUR',
      minimumFractionDigits: 0, maximumFractionDigits: 2,
    });
  }

  submit(): void {
    if (!this.isValid || this.plannedAmount === null) return;

    this.budgetService.addItem(this.category.id, {
      name: this.name.trim(),
      plannedAmount: this.plannedAmount,
      actualAmount: 0,
      isPaid: false,
      dueDate: this.dueDate || undefined,
      isRecurring: this.isRecurring,
      recurringFrequency: this.isRecurring ? this.recurringFrequency : undefined,
      notes: this.notes.trim() || undefined,
    });

    this.close.emit();
  }

  cancel(): void {
    this.close.emit();
  }

  onBackdropClick(event: MouseEvent): void {
    if ((event.target as HTMLElement).classList.contains('modal-backdrop')) {
      this.cancel();
    }
  }
}
