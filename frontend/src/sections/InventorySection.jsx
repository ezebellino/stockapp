import { CategorySelect, EmptyState, InputField, InventoryTable, Panel, QuickAction, ScannerStatus, ShortcutHint, SummaryBadge, MetricCard, MovementCard } from "../components/AppUI";

export default function InventorySection(props) {
  const {
    loading,
    searchTerm,
    setSearchTerm,
    inventoryCategoryFilter,
    setInventoryCategoryFilter,
    inventoryProviderFilter,
    setInventoryProviderFilter,
    providerOptions,
    refreshAll,
    scanState,
    scanInputRef,
    scanCode,
    setScanCode,
    processScan,
    scanAmount,
    setScanAmount,
    saving,
    submitScan,
    scanCandidate,
    productForm,
    handleProductFieldChange,
    setProductForm,
    categories,
    resetProductEditor,
    editingId,
    submitProduct,
    newCategoryName,
    setNewCategoryName,
    submitCategory,
    filteredItems,
    startEditing,
    handleDelete,
    movements,
    inventoryValue,
    lowStockItems,
    setActiveSection,
    formatMoney,
    selectedInventoryIds,
    bulkProviderName,
    setBulkProviderName,
    assignProviderToSelection,
    toggleInventorySelection,
    toggleAllVisibleInventorySelection,
  } = props;

  const needsSetup = categories.length === 0 || filteredItems.length === 0;
  const visibleLowStock = lowStockItems.filter((item) => filteredItems.some((visible) => visible.id === item.id)).length;
  const stockCoverage = filteredItems.length === 0 ? 0 : Math.max(0, Math.round(((filteredItems.length - visibleLowStock) / filteredItems.length) * 100));
  const calculatedMarginPrice = Number(productForm.cost_price || 0) * (1 + Number(productForm.markup_percentage || 0) / 100);

  return (
    <div className="space-y-6">
      {needsSetup ? <Panel title="Inventario listo para despegar" description="Una ayuda breve para dejar operativo el catálogo en pocos minutos."><div className="onboarding-grid grid gap-4 lg:grid-cols-3"><QuickAction title="Crear categorías" description={categories.length === 0 ? "Definí rubros como almacén, bebidas o limpieza." : "Sumá nuevas categorías cuando el negocio crezca."} onClick={() => document.getElementById("new-category-input")?.focus()} emphasis={categories.length === 0} /><QuickAction title="Agregar producto manualmente" description="Usá el formulario para cargar nombre, código, proveedor, costo y precio." onClick={() => document.getElementById("product-code-input")?.focus()} emphasis={filteredItems.length === 0} /><QuickAction title="Volver a ventas" description="Cuando el catálogo esté listo, vendé desde la pantalla principal." onClick={() => setActiveSection("home")} /></div></Panel> : null}
      <section className="grid gap-6 xl:grid-cols-[1.15fr_0.85fr]">
        <Panel title="Buscador y escáner" description="Buscá productos, registrá ingresos y mantené el foco listo para el lector de códigos.">
          <div className="grid gap-4 lg:grid-cols-[1.1fr_0.9fr]">
            <div className="space-y-4">
              <label className="block"><span className="field-label mb-2 block text-sm font-medium">Buscar por nombre, código, categoría o proveedor</span><input value={searchTerm} onChange={(event) => setSearchTerm(event.target.value)} placeholder="Buscar producto..." className="field-input w-full rounded-2xl px-4 py-3 text-sm outline-none transition" /></label>
              <div className="grid gap-4 md:grid-cols-2">
                <CategorySelect label="Filtrar por categoría" value={inventoryCategoryFilter} categories={[{ id: "all", name: "Todas las categorías" }, ...categories]} onChange={setInventoryCategoryFilter} />
                <label className="block">
                  <span className="field-label mb-2 block text-sm font-medium">Filtrar por proveedor</span>
                  <select value={inventoryProviderFilter} onChange={(event) => setInventoryProviderFilter(event.target.value)} className="field-input w-full rounded-2xl px-4 py-3 text-sm outline-none transition">
                    {providerOptions.map((provider) => <option key={provider} value={provider}>{provider}</option>)}
                  </select>
                </label>
              </div>
              <ShortcutHint>Presioná <strong>F2</strong> para saltar al lector desde cualquier sección.</ShortcutHint>
              <div className="grid gap-3 sm:grid-cols-[1fr_auto]"><button type="button" onClick={refreshAll} className="section-button section-button-idle rounded-2xl px-4 py-3 text-sm font-semibold transition">Actualizar datos</button><SummaryBadge label="Valor inventario" value={formatMoney(inventoryValue)} /></div>
            </div>
            <div className="card-surface rounded-[28px] p-5">
              <div className="flex items-center justify-between gap-3"><h3 className="panel-title text-lg font-semibold">Ingreso por escáner</h3><ScannerStatus state={scanState} /></div>
              <form className="mt-4 space-y-4" onSubmit={submitScan}>
                <InputField ref={scanInputRef} label="Código escaneado" id="product-code-input" name="scanCode" value={scanCode} onChange={(event) => setScanCode(event.target.value)} onKeyDown={async (event) => { if (event.key === "Enter") { event.preventDefault(); await processScan(); } }} placeholder="Escaneá o escribí el código" autoComplete="off" />
                <InputField label="Cantidad a ingresar" name="scanAmount" type="number" min="1" value={scanAmount} onChange={(event) => setScanAmount(event.target.value)} />
                <button type="submit" disabled={saving} className="primary-button w-full rounded-2xl px-4 py-3 text-sm font-semibold">Registrar ingreso</button>
              </form>
              {scanCandidate ? <div className="warning-box mt-4 rounded-2xl px-4 py-3 text-sm">Código nuevo detectado. Completá el alta rápida para crear el producto.</div> : null}
            </div>
          </div>
        </Panel>
        <Panel title={editingId ? "Editar producto" : "Nuevo producto"} description="Alta manual, edición y carga de categorías sin salir del panel principal." action={(editingId || scanCandidate) ? <button type="button" onClick={resetProductEditor} className="section-button section-button-idle rounded-full px-4 py-2 text-sm font-medium transition">Limpiar</button> : null}>
          <form className="grid gap-4 md:grid-cols-2" onSubmit={submitProduct}>
            <InputField label="Código de barras (opcional)" name="code" value={productForm.code} onChange={handleProductFieldChange} placeholder="Si no lo cargás, se genera una referencia interna" />
            <InputField label="Nombre del producto" name="name" value={productForm.name} onChange={handleProductFieldChange} />
            <CategorySelect label="Categoría" value={productForm.category} categories={categories} onChange={(value) => setProductForm((current) => ({ ...current, category: value }))} />
            <InputField label="Proveedor" name="provider" value={productForm.provider} onChange={handleProductFieldChange} placeholder="Ejemplo: Distribuidora Centro" />
            <InputField label="Stock actual" name="quantity" type="number" min="0" value={productForm.quantity} onChange={handleProductFieldChange} />
            <InputField label="Stock mínimo" name="min_quantity" type="number" min="0" value={productForm.min_quantity} onChange={handleProductFieldChange} />
            <InputField label="Costo" name="cost_price" type="number" min="0" step="0.01" value={productForm.cost_price} onChange={handleProductFieldChange} />
            <label className="block">
              <span className="field-label mb-2 block text-sm font-medium">Modo de precio</span>
              <select name="pricing_mode" value={productForm.pricing_mode} onChange={handleProductFieldChange} className="field-input w-full rounded-2xl px-4 py-3 text-sm outline-none transition">
                <option value="manual">Manual</option>
                <option value="margin">Por margen sobre costo</option>
              </select>
            </label>
            {productForm.pricing_mode === "margin" ? (
              <>
                <InputField label="Margen sobre costo (%)" name="markup_percentage" type="number" min="0" step="0.01" value={productForm.markup_percentage} onChange={handleProductFieldChange} />
                <div className="soft-card rounded-2xl px-4 py-4">
                  <div className="panel-description text-xs uppercase tracking-[0.22em]">Precio calculado</div>
                  <div className="content-strong mt-2 text-2xl font-semibold">{formatMoney(calculatedMarginPrice)}</div>
                  <div className="content-muted mt-2 text-sm">Se actualiza como costo + margen. Ejemplo: costo 1000 y margen 55% = 1550.</div>
                </div>
              </>
            ) : null}
            <InputField label="Precio de venta" name="sale_price" type="number" min="0" step="0.01" value={productForm.sale_price} onChange={handleProductFieldChange} />
            <button type="submit" disabled={saving} className="primary-button md:col-span-2 rounded-2xl px-4 py-3 text-sm font-semibold">{editingId ? "Actualizar producto" : "Guardar producto"}</button>
          </form>
          <form className="soft-card mt-4 flex flex-col gap-3 rounded-2xl p-4 sm:flex-row" onSubmit={submitCategory}>
            <input id="new-category-input" value={newCategoryName} onChange={(event) => setNewCategoryName(event.target.value)} placeholder={categories.length === 0 ? "Creá la primera categoría del local" : "Agregar nueva categoría"} className="field-input flex-1 rounded-2xl px-4 py-3 text-sm outline-none transition" />
            <button type="submit" disabled={saving || newCategoryName.trim().length < 2} className="section-button section-button-active rounded-2xl px-4 py-3 text-sm font-semibold transition">Guardar categoría</button>
          </form>
        </Panel>
      </section>
      <section className="grid gap-6 xl:grid-cols-[1.2fr_0.8fr]">
        <Panel title="Catálogo de productos" description="Visualizá inventario, editá datos, filtrá por categoría, proveedor y eliminá productos obsoletos." action={<div className="flex flex-wrap gap-2"><SummaryBadge label="Productos visibles" value={filteredItems.length} /><SummaryBadge label="Seleccionados" value={selectedInventoryIds.length} /><SummaryBadge label="Cobertura sana" value={`${stockCoverage}%`} /></div>}>
          <form className="soft-card mb-4 grid gap-3 rounded-2xl p-4 md:grid-cols-[1fr_auto_auto]" onSubmit={assignProviderToSelection}>
            <input value={bulkProviderName} onChange={(event) => setBulkProviderName(event.target.value)} placeholder="Asignar proveedor a los seleccionados" className="field-input rounded-2xl px-4 py-3 text-sm outline-none transition" />
            <button type="submit" disabled={saving || selectedInventoryIds.length === 0} className="section-button section-button-active rounded-2xl px-4 py-3 text-sm font-semibold transition">Asignar proveedor</button>
            <button type="button" onClick={() => setBulkProviderName("")} className="section-button section-button-idle rounded-2xl px-4 py-3 text-sm font-semibold transition">Vaciar campo</button>
          </form>
          {loading ? <EmptyState>Cargando inventario...</EmptyState> : filteredItems.length === 0 ? <EmptyState>No hay productos para ese filtro. Probá otra categoría, proveedor o limpiá la búsqueda.</EmptyState> : <InventoryTable items={filteredItems} onEdit={startEditing} onDelete={handleDelete} formatMoney={formatMoney} selectedIds={selectedInventoryIds} onToggleSelect={toggleInventorySelection} onToggleSelectAll={toggleAllVisibleInventorySelection} />}
        </Panel>
        <div className="space-y-6">
          <Panel title="Estado de stock" description="Una vista rápida para priorizar la reposición."><div className="grid gap-4 sm:grid-cols-2"><MetricCard label="Categorías" value={categories.length} /><MetricCard label="Stock bajo" value={lowStockItems.length} emphasis={lowStockItems.length > 0} /></div><div className="inventory-health mt-5 rounded-[24px] p-4"><div className="flex items-center justify-between gap-3"><div><div className="panel-description text-xs uppercase tracking-[0.22em]">Salud del inventario</div><div className="content-strong mt-1 text-lg font-semibold">{stockCoverage}% de productos visibles por encima del mínimo</div></div><div className="health-pill rounded-full px-3 py-2 text-xs font-semibold">{lowStockItems.length === 0 ? "Sin alertas" : `${lowStockItems.length} con alerta`}</div></div><div className="progress-track mt-4 h-3 overflow-hidden rounded-full"><div className="progress-bar h-full rounded-full" style={{ width: `${stockCoverage}%` }} /></div></div></Panel>
          <Panel title="Últimos movimientos" description="Entradas, ventas y ajustes más recientes del inventario.">{movements.length === 0 ? <EmptyState>Todavía no hay movimientos registrados.</EmptyState> : <div className="space-y-3">{movements.map((movement) => <MovementCard key={movement.id} movement={movement} />)}</div>}</Panel>
        </div>
      </section>
    </div>
  );
}
