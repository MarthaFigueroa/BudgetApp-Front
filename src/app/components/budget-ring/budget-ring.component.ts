import { Component, computed, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { BudgetService } from '../../services/budget.service';
import { CategorySummary } from '../../models/budget.model';

interface RingSegment {
  color: string;
  name: string;
  icon: string;
  dashArray: string;
  dashOffset: string;
  percentage: number;
  amount: number;
}

@Component({
  selector: 'app-budget-ring',
  standalone: true,
  imports: [CommonModule],
  template: `
    <div class="select-none">
      <!-- SVG Donut Ring -->
      <div class="relative">
        <svg viewBox="0 0 200 200" class="w-full drop-shadow-2xl">
          <!-- Track (fondo del ring) -->
          <circle
            cx="100" cy="100" r="76"
            fill="none"
            stroke="#1C1C1F"
            stroke-width="20"
          />

          <!-- Glow sutil en el track -->
          <circle
            cx="100" cy="100" r="76"
            fill="none"
            stroke="#232327"
            stroke-width="1"
          />

          <!-- Segmentos de categorías -->
          @for (seg of segments(); track seg.name) {
            <circle
              class="ring-segment"
              cx="100" cy="100" r="76"
              fill="none"
              [attr.stroke]="seg.color"
              stroke-width="20"
              stroke-linecap="butt"
              [attr.stroke-dasharray]="seg.dashArray"
              [attr.stroke-dashoffset]="seg.dashOffset"
              style="transform: rotate(-90deg); transform-origin: 100px 100px;"
            />
          }

          <!-- Estado vacío: ring punteado -->
          @if (segments().length === 0) {
            <circle
              cx="100" cy="100" r="76"
              fill="none"
              stroke="#2E2E33"
              stroke-width="20"
              stroke-dasharray="8 6"
              style="transform: rotate(-90deg); transform-origin: 100px 100px;"
            />
          }

          <!-- Texto central -->
          <text
            x="100" y="88"
            text-anchor="middle"
            fill="#4A4A52"
            font-family="DM Mono, monospace"
            font-size="9"
            font-weight="400"
            letter-spacing="2"
          >ASIGNADO</text>

          <text
            x="100" y="112"
            text-anchor="middle"
            fill="#F4F3EE"
            font-family="Cormorant Garamond, serif"
            font-size="28"
            font-weight="300"
          >{{ allocationPct() }}%</text>

          @if (summary().isOverBudget) {
            <text
              x="100" y="128"
              text-anchor="middle"
              fill="#FF7B7B"
              font-family="DM Mono, monospace"
              font-size="8"
              font-weight="400"
            >EXCEDIDO</text>
          }
        </svg>
      </div>

      <!-- Leyenda de categorías -->
      @if (segments().length > 0) {
        <div class="mt-4 space-y-2">
          @for (seg of segments(); track seg.name) {
            <div class="flex items-center gap-2.5 group">
              <div
                class="w-2 h-2 rounded-full flex-shrink-0"
                [style.background-color]="seg.color"
              ></div>
              <span class="font-sans text-xs text-[#7A7A82] flex-1 truncate">
                {{ seg.icon }} {{ seg.name }}
              </span>
              <span class="font-mono text-xs text-[#F4F3EE]">
                {{ seg.percentage.toFixed(1) }}%
              </span>
            </div>
          }
        </div>
      } @else {
        <div class="mt-4 text-center">
          <p class="font-mono text-[10px] text-[#4A4A52] uppercase tracking-widest">
            Añade conceptos a las categorías
          </p>
        </div>
      }
    </div>
  `,
})
export class BudgetRingComponent {
  private service = inject(BudgetService);
  readonly summary = this.service.summary;

  private readonly R = 76;
  private readonly C = 2 * Math.PI * this.R; // ≈ 477.52

  readonly allocationPct = computed(() => {
    const s = this.summary();
    if (s.totalIncome === 0) return '—';
    return Math.min(s.allocationPercentage, 999).toFixed(0);
  });

  readonly segments = computed<RingSegment[]>(() => {
    const s = this.summary();
    if (s.totalPlanned === 0) return [];

    const active = s.categories.filter(c => c.totalPlanned > 0);
    const GAP = active.length > 1 ? 4 : 0;

    let cumulative = 0;

    return active.map((c: CategorySummary) => {
      const frac = c.totalPlanned / s.totalPlanned;
      const arcLen = Math.max(frac * this.C - GAP, 0.5);
      const offset = -cumulative;
      cumulative += frac * this.C;

      return {
        color: c.category.color,
        name: c.category.name,
        icon: c.category.icon,
        dashArray: `${arcLen} ${this.C}`,
        dashOffset: offset.toFixed(3),
        percentage: frac * 100,
        amount: c.totalPlanned,
      };
    });
  });
}
