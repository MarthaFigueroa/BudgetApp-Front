import { Component, Input, Output, EventEmitter, inject, OnInit } from '@angular/core';
import { CommonModule, DatePipe } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { BudgetService } from '../../services/budget.service';
import { BudgetCategory, BudgetItem, RecurringFrequency } from '../../models/budget.model';
import { FREQUENCY_OPTIONS } from '../add-item-modal/add-item-modal.component';

type ModalMode = 'view' | 'edit' | 'confirm-delete';

@Component({
  selector: 'app-item-detail-modal',
  standalone: true,
  imports: [CommonModule, FormsModule, DatePipe],
  templateUrl: './item-detail-modal.component.html',
})
export class ItemDetailModalComponent implements OnInit {
  @Input() item!: BudgetItem;
  @Input() category!: BudgetCategory;
  @Output() close = new EventEmitter<void>();

  private svc = inject(BudgetService);

  mode: ModalMode = 'view';

  // Campos del formulario de edición
  editName = '';
  editPlanned: number | null = null;
  editDueDate = '';
  editIsRecurring = false;
  editFrequency: RecurringFrequency = 'monthly';
  editNotes = '';

  readonly frequencyOptions = FREQUENCY_OPTIONS;

  readonly FREQUENCY_LABELS: Record<RecurringFrequency, string> = {
    weekly:    'Semanal',
    biweekly:  'Quincenal',
    monthly:   'Mensual',
    quarterly: 'Trimestral',
    yearly:    'Anual',
  };

  ngOnInit(): void {
    // Pre-cargar campos de edición
    this.resetEditForm();
  }

  // ─── Getters ────────────────────────────────────────────────────────────────

  get frequencyLabel(): string {
    return this.item.recurringFrequency
      ? this.FREQUENCY_LABELS[this.item.recurringFrequency]
      : 'Mensual';
  }

  get variance(): number {
    return this.item.actualAmount - this.item.plannedAmount;
  }

  get isEditValid(): boolean {
    return (
      this.editName.trim().length > 0 &&
      this.editPlanned !== null &&
      this.editPlanned > 0
    );
  }

  get selectedFrequencyDesc(): string {
    return this.frequencyOptions.find(f => f.value === this.editFrequency)?.desc ?? '';
  }

  // ─── Acciones ────────────────────────────────────────────────────────────────

  enterEdit(): void {
    this.resetEditForm();
    this.mode = 'edit';
  }

  cancelEdit(): void {
    this.mode = 'view';
  }

  saveEdit(): void {
    if (!this.isEditValid || this.editPlanned === null) return;

    this.svc.updateItem(this.category.id, this.item.id, {
      name: this.editName.trim(),
      plannedAmount: this.editPlanned,
      dueDate: this.editDueDate || undefined,
      isRecurring: this.editIsRecurring,
      recurringFrequency: this.editIsRecurring ? this.editFrequency : undefined,
      notes: this.editNotes.trim() || undefined,
    });

    this.close.emit();
  }

  confirmDelete(): void {
    this.mode = 'confirm-delete';
  }

  cancelDelete(): void {
    this.mode = 'view';
  }

  deleteItem(): void {
    this.svc.removeItem(this.category.id, this.item.id);
    this.close.emit();
  }

  fmt(amount: number): string {
    return amount.toLocaleString('es-ES', {
      style: 'currency',
      currency: 'EUR',
      minimumFractionDigits: 2,
    });
  }

  fmtDate(dateStr: string): string {
    const [y, m, d] = dateStr.split('-').map(Number);
    return new Date(y, m - 1, d).toLocaleDateString('es-ES', {
      day: 'numeric', month: 'long', year: 'numeric',
    });
  }

  onBackdropClick(event: MouseEvent): void {
    if ((event.target as HTMLElement).classList.contains('modal-backdrop')) {
      this.close.emit();
    }
  }

  private resetEditForm(): void {
    this.editName        = this.item.name;
    this.editPlanned     = this.item.plannedAmount;
    this.editDueDate     = this.item.dueDate ?? '';
    this.editIsRecurring = this.item.isRecurring;
    this.editFrequency   = this.item.recurringFrequency ?? 'monthly';
    this.editNotes       = this.item.notes ?? '';
  }
}
