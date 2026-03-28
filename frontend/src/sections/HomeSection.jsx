import { EmptyState, InsightCard, LogoUploadField, MetricCard, Panel, QuickAction, StatusRow, MovementCard } from "../components/AppUI";

export default function HomeSection({ reports, cashSummary, inventoryValue, costValue, lowStockItems, latestMovements, branchName, loading, setActiveSection, totalCategories, totalItems, businessProfileForm, setBusinessProfileForm, handleBusinessProfileSave, handleLogoUpload, clearLogo, saving, handleText, formatMoney, topProduct }) {
  const needsOnboarding = totalCategories === 0 || totalItems === 0;
  return (
    <div className="space-y-6">
      {needsOnboarding ? <Panel title="Primeros pasos" description="Dejá el sistema listo para operar desde esta misma pantalla."><div className="onboarding-grid grid gap-4 lg:grid-cols-3"><QuickAction title="Cargar categorías" description={totalCategories === 0 ? "Creá la primera categoría para ordenar el catálogo." : totalCategories + " categorías disponibles para reutilizar."} onClick={() => setActiveSection("inventory")} emphasis={totalCategories === 0} /><QuickAction title="Cargar productos" description={totalItems === 0 ? "Empezá con el primer producto del local." : totalItems + " productos listos para vender o reponer."} onClick={() => setActiveSection("inventory")} emphasis={totalItems === 0} /><QuickAction title="Abrir caja diaria" description={cashSummary.current_session ? "La caja ya está abierta y operativa." : "Activá el turno para registrar ventas y cierres."} onClick={() => setActiveSection("treasury")} emphasis={!cashSummary.current_session} /></div></Panel> : null}
      <section className="grid gap-6 xl:grid-cols-[1.35fr_0.65fr]">
        <Panel title={`Bienvenido a ${branchName}`} description="Tu punto de entrada para revisar el estado general del negocio, la caja y el inventario del local.">
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
            <MetricCard label="Recaudación" value={formatMoney(reports.total_revenue)} />
            <MetricCard label="Ganancia" value={formatMoney(reports.total_profit)} />
            <MetricCard label="Valor de inventario" value={formatMoney(inventoryValue)} />
            <MetricCard label="Caja física" value={formatMoney(cashSummary.expected_cash_now)} />
          </div>
          <div className="mt-6 grid gap-4 md:grid-cols-3">
            <QuickAction title="Ir a Inventario" description="Altas, edición, escáner y stock." onClick={() => setActiveSection("inventory")} />
            <QuickAction title="Abrir Tesorería" description="Caja diaria, ventas y reportes." onClick={() => setActiveSection("treasury")} />
            <QuickAction title="Ver alertas" description={`${lowStockItems.length} productos en reposición.`} onClick={() => setActiveSection("inventory")} emphasis={lowStockItems.length > 0} />
          </div>
        </Panel>
        <Panel title="Estado operativo" description="Resumen inmediato del local y del turno actual.">
          <div className="space-y-4">
            <StatusRow label="Caja" value={cashSummary.current_session ? "Abierta" : "Cerrada"} strong={Boolean(cashSummary.current_session)} />
            <StatusRow label="Ventas del día" value={cashSummary.today_sales_count} />
            <StatusRow label="Efectivo del día" value={formatMoney(cashSummary.cash_revenue)} />
            <StatusRow label="Ventas virtuales" value={formatMoney(cashSummary.non_cash_revenue)} />
            <StatusRow label="Unidades vendidas" value={cashSummary.today_units_sold} />
            <StatusRow label="Costo inmovilizado" value={formatMoney(costValue)} />
          </div>
        </Panel>
      </section>

      <section className="grid gap-6 xl:grid-cols-[1.2fr_0.8fr]">
        <Panel title="Actividad reciente" description="Últimos movimientos relevantes del sistema local.">
          {loading ? <EmptyState>Cargando actividad...</EmptyState> : latestMovements.length === 0 ? <EmptyState>Todavía no hay actividad registrada.</EmptyState> : <div className="space-y-3">{latestMovements.map((movement) => <MovementCard key={movement.id} movement={movement} />)}</div>}
        </Panel>
        <Panel title="Inteligencia comercial" description="Lectura rápida para decidir qué mirar primero.">
          <div className="space-y-4">
            <InsightCard title="Producto líder" value={topProduct ? topProduct.name : "Sin ventas todavía"} helper={topProduct ? `${topProduct.quantity} unidades vendidas` : "Registrá ventas para ver tendencias."} />
            <InsightCard title="Productos con stock bajo" value={lowStockItems.length} helper={lowStockItems.length > 0 ? "Conviene revisar compras o reposición." : "Sin alertas críticas por ahora."} />
            <InsightCard title="Margen estimado" value={formatMoney(reports.total_profit)} helper="Calculado sobre ventas registradas y costo cargado." />
          </div>
        </Panel>
      </section>

      <Panel title="Perfil comercial" description="Estos datos alimentan el ticket térmico y dejan la aplicación lista para cualquier comercio.">
        <form className="grid gap-4 md:grid-cols-2" onSubmit={handleBusinessProfileSave}>
          <label className="block"><span className="field-label mb-2 block text-sm font-medium">Nombre del local</span><input name="businessName" value={businessProfileForm.businessName} onChange={handleText(setBusinessProfileForm)} className="field-input w-full rounded-2xl px-4 py-3 text-sm outline-none transition" /></label>
          <label className="block"><span className="field-label mb-2 block text-sm font-medium">Dirección comercial</span><input name="businessAddress" value={businessProfileForm.businessAddress} onChange={handleText(setBusinessProfileForm)} className="field-input w-full rounded-2xl px-4 py-3 text-sm outline-none transition" /></label>
          <label className="block"><span className="field-label mb-2 block text-sm font-medium">WhatsApp</span><input name="businessWhatsapp" value={businessProfileForm.businessWhatsapp} onChange={handleText(setBusinessProfileForm)} className="field-input w-full rounded-2xl px-4 py-3 text-sm outline-none transition" /></label>
          <label className="block"><span className="field-label mb-2 block text-sm font-medium">CUIT</span><input name="businessTaxId" value={businessProfileForm.businessTaxId} onChange={handleText(setBusinessProfileForm)} className="field-input w-full rounded-2xl px-4 py-3 text-sm outline-none transition" /></label>
          <div className="md:col-span-2">
            <LogoUploadField label="Logo del comercio (opcional)" logoDataUrl={businessProfileForm.businessLogoDataUrl} onSelect={(event) => handleLogoUpload(event, setBusinessProfileForm)} onClear={() => clearLogo(setBusinessProfileForm)} />
          </div>
          <button type="submit" disabled={saving} className="primary-button md:col-span-2 rounded-2xl px-4 py-3 text-sm font-semibold">Guardar perfil comercial</button>
        </form>
      </Panel>
    </div>
  );
}


