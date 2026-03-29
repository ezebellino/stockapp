import { CashSessionCard, DailySalesChart, EmptyState, InsightCard, InputField, Panel, RecentSaleCard, ReportList } from "../components/AppUI";

export default function TreasurySection(props) {
  const {
    cashSummary,
    treasuryFilter,
    setTreasuryFilter,
    treasuryPreset,
    treasuryMetric,
    setTreasuryMetric,
    applyTreasuryPreset,
    applyTreasuryFilter,
    clearTreasuryFilter,
    exportTreasuryCsv,
    printTreasurySummary,
    saving,
    treasuryFilterActive,
    reports,
    dailySales,
    cashMovementForm,
    setCashMovementForm,
    submitCashMovement,
    handleText,
    formatMoney,
    formatInteger,
    formatDate,
    formatDateTime,
  } = props;

  return (
    <div className="space-y-6">
      <section className="grid gap-6 xl:grid-cols-[1.08fr_0.92fr]">
        <Panel
          title="Pulso diario de ventas"
          description="Compará la evolución diaria de la métrica clave dentro del período actual."
          action={
            <div className="flex flex-col gap-3">
              <div className="range-chip-group flex flex-wrap gap-2">
                {[
                  { id: "7d", label: "7 días" },
                  { id: "30d", label: "30 días" },
                  { id: "month", label: "Mes actual" },
                  { id: "all", label: "Todo" },
                ].map((preset) => (
                  <button
                    key={preset.id}
                    type="button"
                    onClick={() => applyTreasuryPreset(preset.id)}
                    className={`rounded-full px-4 py-2 text-xs font-semibold transition ${treasuryPreset === preset.id ? "section-button section-button-active" : "section-button section-button-idle"}`}
                  >
                    {preset.label}
                  </button>
                ))}
              </div>
              <div className="metric-chip-group flex flex-wrap gap-2">
                {[
                  { id: "revenue", label: "Recaudación" },
                  { id: "profit", label: "Ganancia" },
                  { id: "units_sold", label: "Unidades" },
                ].map((metric) => (
                  <button
                    key={metric.id}
                    type="button"
                    onClick={() => setTreasuryMetric(metric.id)}
                    className={`rounded-full px-4 py-2 text-xs font-semibold transition ${treasuryMetric === metric.id ? "section-button section-button-active" : "section-button section-button-idle"}`}
                  >
                    {metric.label}
                  </button>
                ))}
              </div>
            </div>
          }
        >
          {dailySales.length === 0 ? (
            <EmptyState>Todavía no hay suficientes ventas para dibujar el gráfico diario.</EmptyState>
          ) : (
            <DailySalesChart rows={dailySales} metric={treasuryMetric} formatMoney={formatMoney} formatInteger={formatInteger} />
          )}
        </Panel>

        <Panel title="Resumen ejecutivo" description="Esta pantalla queda pensada para el dueño o la administración del comercio.">
          <div className="treasury-summary-grid grid gap-4 sm:grid-cols-2">
            <InsightCard title="Recaudación total" value={formatMoney(cashSummary.today_revenue)} helper="Incluye efectivo y ventas virtuales del período visible." />
            <InsightCard title="Caja física esperada" value={formatMoney(cashSummary.expected_cash_now)} helper="Incluye apertura, efectivo vendido e ingresos/egresos manuales del turno." />
            <InsightCard title="Margen estimado" value={cashSummary.today_revenue > 0 ? `${Math.round((cashSummary.today_profit / cashSummary.today_revenue) * 100)}%` : "0%"} helper="Basado en recaudación y costos cargados." />
            <InsightCard title="Ventas virtuales" value={formatMoney(cashSummary.non_cash_revenue)} helper={`${cashSummary.today_units_sold} unidades vendidas en el período.`} />
          </div>
        </Panel>
      </section>

      <section className="grid gap-6 xl:grid-cols-[0.95fr_1.05fr]">
        <div className="space-y-6">
          <Panel
            title="Período de análisis"
            description="Filtrá tesorería por rango de fechas para revisar cierres, ventas y resultados."
            action={
              <div className="flex flex-wrap gap-2">
                <button type="button" onClick={exportTreasuryCsv} disabled={saving} className="section-button section-button-active rounded-full px-4 py-2 text-sm font-semibold transition">
                  Descargar CSV
                </button>
                <button type="button" onClick={printTreasurySummary} className="section-button section-button-idle rounded-full px-4 py-2 text-sm font-semibold transition">
                  Imprimir resumen
                </button>
              </div>
            }
          >
            <form className="grid gap-4 md:grid-cols-2" onSubmit={applyTreasuryFilter}>
              <InputField label="Desde" name="startDate" type="date" value={treasuryFilter.startDate} onChange={handleText(setTreasuryFilter)} />
              <InputField label="Hasta" name="endDate" type="date" value={treasuryFilter.endDate} onChange={handleText(setTreasuryFilter)} />
              <button type="submit" disabled={saving} className="primary-button rounded-2xl px-4 py-3 text-sm font-semibold">
                Aplicar filtro
              </button>
              <button type="button" onClick={clearTreasuryFilter} className="section-button section-button-idle rounded-2xl px-4 py-3 text-sm font-semibold transition">
                Ver todo
              </button>
            </form>
            {treasuryFilterActive ? (
              <div className="info-box mt-4 rounded-2xl px-4 py-3 text-sm">
                Mostrando tesorería desde {treasuryFilter.startDate ? formatDate(treasuryFilter.startDate) : "el inicio"} hasta {treasuryFilter.endDate ? formatDate(treasuryFilter.endDate) : "hoy"}.
              </div>
            ) : null}
          </Panel>

          <Panel title="Movimientos manuales de caja" description="Registrá ingresos y egresos operativos para que el cierre refleje la caja física real.">
            <form className="grid gap-4 md:grid-cols-2" onSubmit={submitCashMovement}>
              <label className="block">
                <span className="field-label mb-2 block text-sm font-medium">Tipo</span>
                <select name="movement_type" value={cashMovementForm.movement_type} onChange={handleText(setCashMovementForm)} className="field-input w-full rounded-2xl px-4 py-3 text-sm outline-none transition">
                  <option value="EXPENSE">Egreso</option>
                  <option value="INCOME">Ingreso</option>
                </select>
              </label>
              <label className="block">
                <span className="field-label mb-2 block text-sm font-medium">Monto</span>
                <input name="amount" type="number" min="0.01" step="0.01" value={cashMovementForm.amount} onChange={handleText(setCashMovementForm)} placeholder="0,00" className="field-input w-full rounded-2xl px-4 py-3 text-sm outline-none transition" />
              </label>
              <label className="block md:col-span-2">
                <span className="field-label mb-2 block text-sm font-medium">Concepto</span>
                <input name="concept" value={cashMovementForm.concept} onChange={handleText(setCashMovementForm)} placeholder="Proveedor, flete, retiro, fondo extra" className="field-input w-full rounded-2xl px-4 py-3 text-sm outline-none transition" />
              </label>
              <label className="block md:col-span-2">
                <span className="field-label mb-2 block text-sm font-medium">Notas</span>
                <input name="notes" value={cashMovementForm.notes} onChange={handleText(setCashMovementForm)} placeholder="Detalle opcional para auditoría" className="field-input w-full rounded-2xl px-4 py-3 text-sm outline-none transition" />
              </label>
              <button type="submit" disabled={saving || !cashSummary.current_session} className="primary-button md:col-span-2 rounded-2xl px-4 py-3 text-sm font-semibold">
                Registrar movimiento
              </button>
            </form>
            <div className="mt-5 grid gap-4 sm:grid-cols-2">
              <InsightCard title="Ingresos manuales" value={formatMoney(cashSummary.manual_income)} helper="Suman a la caja física esperada del período." />
              <InsightCard title="Egresos manuales" value={formatMoney(cashSummary.manual_expense)} helper="Descuentan caja por pagos, compras o retiros." />
            </div>
            <div className="mt-5 space-y-3">
              {(cashSummary.recent_cash_movements ?? []).length === 0 ? (
                <EmptyState>Todavía no hay movimientos manuales de caja.</EmptyState>
              ) : (
                (cashSummary.recent_cash_movements ?? []).map((movement) => (
                  <div key={movement.id} className="card-surface rounded-2xl px-4 py-3">
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <div className="content-strong font-medium">{movement.concept}</div>
                        <div className="content-muted text-xs uppercase tracking-[0.18em]">{movement.movement_type === "INCOME" ? "Ingreso" : "Egreso"} · {formatDateTime(movement.created_at)}</div>
                      </div>
                      <div className={`rounded-full px-3 py-1 text-xs font-semibold ${movement.movement_type === "INCOME" ? "success-soft text-emerald-100" : "danger-box text-rose-100"}`}>
                        {movement.movement_type === "INCOME" ? "+" : "-"}{formatMoney(movement.amount)}
                      </div>
                    </div>
                    {movement.notes ? <div className="soft-card content-default mt-3 rounded-2xl px-4 py-3 text-sm">{movement.notes}</div> : null}
                  </div>
                ))
              )}
            </div>
          </Panel>

          <Panel title="Jornadas registradas" description={treasuryFilterActive ? "Cierres y aperturas del período filtrado." : "Últimos cierres y turnos de caja registrados."}>
            {cashSummary.recent_sessions.length === 0 ? (
              <EmptyState>No hay jornadas en ese período.</EmptyState>
            ) : (
              <div className="space-y-3">
                {cashSummary.recent_sessions.map((session) => (
                  <CashSessionCard key={session.id} session={session} formatMoney={formatMoney} formatDateTime={formatDateTime} />
                ))}
              </div>
            )}
          </Panel>
        </div>

        <div className="space-y-6">
          <Panel title="Reportes inteligentes" description="Lectura rápida de recaudación, rentabilidad y comportamiento de ventas.">
            <div className="grid gap-4 lg:grid-cols-2">
              <ReportList title="Productos más vendidos" rows={reports.top_products} renderLabel={(row) => row.name} renderMeta={(row) => `${row.quantity} unidades · ${formatMoney(row.revenue)}`} />
              <ReportList title="Categorías más vendidas" rows={reports.top_categories} renderLabel={(row) => row.category} renderMeta={(row) => `${row.quantity} unidades · ${formatMoney(row.revenue)}`} />
            </div>
            <div className="soft-card mt-5 rounded-2xl p-4">
              <h3 className="panel-description text-sm font-semibold uppercase tracking-[0.2em]">Insights</h3>
              <div className="mt-3 space-y-2">
                {reports.insights.length === 0 ? (
                  <EmptyState>Sin insights todavía.</EmptyState>
                ) : (
                  reports.insights.map((insight) => (
                    <div key={insight} className="success-soft rounded-2xl px-4 py-3 text-sm">
                      {insight}
                    </div>
                  ))
                )}
              </div>
            </div>
            <div className="mt-5">
              <h3 className="panel-description text-sm font-semibold uppercase tracking-[0.2em]">Últimas ventas del período</h3>
              <div className="mt-3 space-y-3">
                {reports.recent_sales.length === 0 ? (
                  <EmptyState>No hay ventas en ese período.</EmptyState>
                ) : (
                  reports.recent_sales.map((sale) => <RecentSaleCard key={sale.id} sale={sale} formatMoney={formatMoney} formatDateTime={formatDateTime} />)
                )}
              </div>
            </div>
          </Panel>
        </div>
      </section>
    </div>
  );
}
