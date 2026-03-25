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

  // ─── Name editing state ───────────────────────────────────────────────────

  editingNameId = signal<string | null>(null);

  onNameFocus(id: string): void   { this.editingNameId.set(id); }
  onNameBlur(sourceId: string, event: Event): void {
    const val = (event.target as HTMLInputElement).value.trim();
    if (val) this.svc.updateIncomeName(sourceId, val);
    this.editingNameId.set(null);
  }

  // ─── Amount editing state ─────────────────────────────────────────────────
  // We track the live value while the user is typing so [value] never re-binds
  // with the stale source.amount and resets the cursor / content mid-edit.

  editingAmountId  = signal<string | null>(null);
  private _editingAmountVal = signal<string>('');

  /** Returns the value to bind to [value]: live string while editing, signal value otherwise. */
  amountDisplayFor(source: IncomeSource): string | number {
    if (this.editingAmountId() === source.id) return this._editingAmountVal();
    return source.amount > 0 ? source.amount : '';
  }

  onAmountFocus(sourceId: string, event: Event): void {
    const input = event.target as HTMLInputElement;
    const source = this.budget().incomeSources.find((s) => s.id === sourceId);
    const str = source && source.amount > 0 ? String(source.amount) : '';
    this._editingAmountVal.set(str);
    this.editingAmountId.set(sourceId);
    // requestAnimationFrame so [value] binding has applied before we select
    requestAnimationFrame(() => input.select());
  }

  onAmountInput(sourceId: string, event: Event): void {
    // Only update local buffer — do NOT call setIncome yet (avoids re-bind mid-type)
    this._editingAmountVal.set((event.target as HTMLInputElement).value);
  }

  onAmountBlur(sourceId: string, event: Event): void {
    const val = parseFloat((event.target as HTMLInputElement).value) || 0;
    // Save FIRST (optimistic updates source.amount) then clear editing state,
    // so that when [value] re-binds it already sees the new amount.
    this.svc.setIncome(sourceId, val);
    this.editingAmountId.set(null);
    this._editingAmountVal.set('');
  }

  // ─── Actions ─────────────────────────────────────────────────────────────

  toggleRecurring(id: string): void   { this.svc.toggleRecurring(id); }
  addIncomeSource(): void              { this.svc.addIncomeSource(); }
  removeIncomeSource(id: string): void { this.svc.removeIncomeSource(id); }

  get canDelete(): boolean { return this.budget().incomeSources.length > 1; }

  // ─── Helpers ─────────────────────────────────────────────────────────────

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

  get recurringIncomeSources(): IncomeSource[] {
    return this.budget().incomeSources.filter((s) => s.isFromTemplate);
  }

  get oneTimeIncomeSources(): IncomeSource[] {
    return this.budget().incomeSources.filter((s) => !s.isFromTemplate);
  }
}
