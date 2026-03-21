import { Component, Output, EventEmitter, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { BudgetService } from '../../services/budget.service';
import { IncomeSource } from '../../models/budget.model';

@Component({
  selector: 'app-income-modal',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './income-modal.component.html',
})
export class IncomeModalComponent {
  @Output() close = new EventEmitter<void>();

  protected svc = inject(BudgetService);
  readonly budget  = this.svc.budget;
  readonly summary = this.svc.summary;

  /** ID of the source whose name is being edited (focus management) */
  editingId = signal<string | null>(null);

  get recurringIncomeSources(): IncomeSource[] {
    return this.budget().incomeSources.filter((s) => s.isFromTemplate);
  }

  get oneTimeIncomeSources(): IncomeSource[] {
    return this.budget().incomeSources.filter((s) => !s.isFromTemplate);
  }

  onNameFocus(id: string): void {
    this.editingId.set(id);
  }

  onNameBlur(sourceId: string, event: Event): void {
    const val = (event.target as HTMLInputElement).value.trim();
    if (val) this.svc.updateIncomeName(sourceId, val);
    this.editingId.set(null);
  }

  onAmountInput(sourceId: string, event: Event): void {
    const val = parseFloat((event.target as HTMLInputElement).value) || 0;
    this.svc.setIncome(sourceId, val);
  }

  toggleRecurring(id: string): void  { this.svc.toggleRecurring(id); }
  addIncomeSource(): void             { this.svc.addIncomeSource(); }
  removeIncomeSource(id: string): void { this.svc.removeIncomeSource(id); }

  fmt(amount: number): string {
    return amount.toLocaleString('es-ES', {
      style: 'currency', currency: 'EUR',
      minimumFractionDigits: 0, maximumFractionDigits: 0,
    });
  }

  onBackdropClick(event: MouseEvent): void {
    if ((event.target as HTMLElement).classList.contains('modal-backdrop')) {
      this.close.emit();
    }
  }

  trackById(_: number, s: IncomeSource): string { return s.id; }
}
