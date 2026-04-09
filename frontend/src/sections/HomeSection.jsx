import { EmptyState, InputField, LogoUploadField, MetricCard, Panel, QuickAction, RecentSaleCard, SelectField, StatusRow } from "../components/AppUI";

export default function HomeSection(props) {
  const { cashSummary, lowStockItems, totalItems, totalCategories, businessProfileForm, setBusinessProfileForm, handleBusinessProfileSave, handleLogoUpload, clearLogo, saving, handleText, handleScaleField, handleScaleEnabledChange, saveScaleConfig, testScaleRead, formatMoney, formatDateTime, recentSales, saleForm, setSaleForm, addSaleLine, submitSale, paymentMethodOptions, salesSearchTerm, setSalesSearchTerm, saleMatches, chooseSaleItem, selectedSaleItem, saleCart, removeSaleLine, clearSaleCart, saleCartTotal, saleCartUnits, submitCashOpen, cashOpenForm, setCashOpenForm, submitCashClose, cashCloseForm, setCashCloseForm, setActiveSection, scaleConfig, scaleStatus, scaleReadResult, scaleProviderOptions, scaleConnectionOptions, scaleUnitOptions, serialPorts, refreshScalePorts } = props;
  const needsOnboarding = totalCategories === 0 || totalItems === 0;
  const addDisabled = saving || !selectedSaleItem;
  const checkoutDisabled = saving || !cashSummary.current_session || saleCart.length === 0;

  return (
    <div className="space-y-6">
      {needsOnboarding ? <Panel title="Base del comercio" description="Antes de salir a vender, cargá rubros y productos esenciales para que el mostrador arranque prolijo."><div className="onboarding-grid grid gap-4 lg:grid-cols-3"><QuickAction title="Cargar categorías" description={totalCategories === 0 ? "Creá la primera categoría para ordenar el catálogo." : `${totalCategories} categorías listas para reutilizar.`} onClick={() => setActiveSection("inventory")} emphasis={totalCategories === 0} /><QuickAction title="Cargar productos" description={totalItems === 0 ? "Sumá el primer producto del local." : `${totalItems} productos disponibles para vender.`} onClick={() => setActiveSection("inventory")} emphasis={totalItems === 0} /><QuickAction title="Configurar ticket" description="Completá el perfil comercial para que cada venta salga con identidad del negocio." onClick={() => document.getElementById("business-profile-name")?.focus()} /></div></Panel> : null}

      <section className="grid gap-6 xl:grid-cols-[1.2fr_0.8fr]">
        <Panel id="tour-home-sales" title="Puesto de venta" description="Abrí caja, buscá productos por nombre o código y armá un carrito completo antes de cobrar.">
          {!cashSummary.current_session ? <div className="warning-box mb-4 rounded-2xl px-4 py-3 text-sm">Primero abrí la caja del día. Después de eso, esta pantalla queda lista para vender.</div> : null}
          <div className="grid gap-4 xl:grid-cols-[1.02fr_0.98fr]">
            <div className="space-y-4">
              <label className="block"><span className="field-label mb-2 block text-sm font-medium">Buscar producto para vender</span><input value={salesSearchTerm} onChange={(event) => setSalesSearchTerm(event.target.value)} placeholder="Escribí nombre, código o categoría" className="field-input w-full rounded-2xl px-4 py-3 text-sm outline-none transition" /></label>
              <div className="grid gap-3 md:grid-cols-2">
                {saleMatches.length === 0 ? <div className="md:col-span-2"><EmptyState>No hay coincidencias todavía. Probá con el nombre o el código del producto.</EmptyState></div> : saleMatches.map((item) => <button key={item.id} type="button" onClick={() => chooseSaleItem(item)} className={`quick-action rounded-2xl p-4 text-left transition ${selectedSaleItem?.id === item.id ? "quick-action-emphasis" : "quick-action-default"}`}><div className="content-strong text-base font-semibold">{item.name}</div><div className="panel-description mt-1 text-xs uppercase tracking-[0.18em]">{item.category} · COD {item.code}</div><div className="mt-3 flex items-center justify-between gap-3 text-sm"><span className="content-default">Stock {item.quantity}</span><span className="content-strong font-semibold">{formatMoney(item.sale_price)}</span></div></button>)}
              </div>
            </div>
            <div className="space-y-4">
              <div className="soft-card rounded-[28px] p-5">
                <div className="panel-description text-xs uppercase tracking-[0.22em]">Producto seleccionado</div>
                {selectedSaleItem ? <div className="mt-3 space-y-3"><div><div className="content-strong text-xl font-semibold">{selectedSaleItem.name}</div><div className="content-muted text-sm">{selectedSaleItem.category} · {selectedSaleItem.code}</div></div><div className="grid gap-3 sm:grid-cols-2"><MetricCard label="Stock actual" value={selectedSaleItem.quantity} emphasis={selectedSaleItem.quantity <= selectedSaleItem.min_quantity} /><MetricCard label="Precio sugerido" value={formatMoney(selectedSaleItem.sale_price)} /></div></div> : <EmptyState>Elegí un producto para cargarlo al carrito.</EmptyState>}
              </div>
              <form className="space-y-4" onSubmit={addSaleLine}>
                <input type="hidden" name="code" value={saleForm.code} readOnly />
                <div className="grid gap-4 sm:grid-cols-2">
                  <label className="block"><span className="field-label mb-2 block text-sm font-medium">Código</span><input value={saleForm.code} readOnly placeholder="Seleccioná un producto" className="field-input w-full rounded-2xl px-4 py-3 text-sm outline-none transition" /></label>
                  <label className="block"><span className="field-label mb-2 block text-sm font-medium">Cantidad</span><input name="amount" type="number" min="1" value={saleForm.amount} onChange={handleText(setSaleForm)} className="field-input w-full rounded-2xl px-4 py-3 text-sm outline-none transition" /></label>
                </div>
                <div className="grid gap-4 sm:grid-cols-2">
                  <label className="block"><span className="field-label mb-2 block text-sm font-medium">Precio unitario opcional</span><input name="unit_price" type="number" min="0" step="0.01" value={saleForm.unit_price} onChange={handleText(setSaleForm)} placeholder={selectedSaleItem ? String(selectedSaleItem.sale_price) : "Precio sugerido"} className="field-input w-full rounded-2xl px-4 py-3 text-sm outline-none transition" /></label>
                  <SelectField label="Medio de pago" name="payment_method" value={saleForm.payment_method} onChange={handleText(setSaleForm)} options={paymentMethodOptions} />
                </div>
                <button type="submit" disabled={addDisabled} className="secondary-button w-full rounded-2xl px-4 py-3 text-sm font-semibold">Agregar al carrito</button>
              </form>
            </div>
          </div>
        </Panel>

        <Panel title="Carrito y caja" description="Concentrá la operación de cobro y emití un solo ticket por toda la venta.">
          <div className="space-y-4">
            <StatusRow label="Estado" value={cashSummary.current_session ? "Caja abierta" : "Caja cerrada"} strong={Boolean(cashSummary.current_session)} />
            <StatusRow label="Caja física esperada" value={formatMoney(cashSummary.expected_cash_now)} />
            <StatusRow label="Ventas en efectivo" value={formatMoney(cashSummary.cash_revenue)} />
            <StatusRow label="Caja virtual" value={formatMoney(cashSummary.non_cash_revenue)} />
            <div className="soft-card rounded-2xl p-4">
              <div className="flex items-center justify-between gap-3"><div><div className="content-strong text-lg font-semibold">Carrito actual</div><div className="content-muted text-sm">{saleCart.length} líneas · {saleCartUnits} unidades</div></div>{saleCart.length > 0 ? <button type="button" onClick={clearSaleCart} className="section-button section-button-idle rounded-full px-3 py-2 text-xs font-semibold transition">Vaciar</button> : null}</div>
              <div className="mt-4 space-y-3">
                {saleCart.length === 0 ? <EmptyState>El carrito está vacío. Seleccioná productos y cargalos antes de cobrar.</EmptyState> : saleCart.map((line) => <div key={line.key} className="card-surface rounded-2xl px-4 py-3"><div className="flex items-start justify-between gap-3"><div><div className="content-strong font-medium">{line.item_name}</div><div className="content-muted text-xs uppercase tracking-[0.18em]">{line.code} · {line.category}</div></div><button type="button" onClick={() => removeSaleLine(line.key)} className="danger-button rounded-full px-3 py-1 text-xs font-medium transition">Quitar</button></div><div className="mt-3 flex items-center justify-between gap-3 text-sm"><span className="content-default">{line.quantity} x {formatMoney(line.unit_price)}</span><span className="content-strong font-semibold">{formatMoney(line.total_amount)}</span></div></div>)}
              </div>
              <div className="mt-4 border-t pt-4" style={{ borderColor: "var(--line)" }}>
                <div className="flex items-center justify-between gap-3 text-sm"><span className="panel-description">Medio de pago</span><span className="content-strong font-semibold">{saleForm.payment_method}</span></div>
                <div className="mt-2 flex items-center justify-between gap-3 text-base"><span className="content-strong font-semibold">Total del carrito</span><span className="content-strong text-xl font-semibold">{formatMoney(saleCartTotal)}</span></div>
              </div>
              <form className="mt-4" onSubmit={submitSale}><button type="submit" disabled={checkoutDisabled} className="primary-button w-full rounded-2xl px-4 py-3 text-sm font-semibold">Cobrar e imprimir ticket</button></form>
            </div>
            {!cashSummary.current_session ? <form className="space-y-3" onSubmit={submitCashOpen}><label className="block"><span className="field-label mb-2 block text-sm font-medium">Monto inicial</span><input name="opening_amount" type="number" min="0" step="0.01" value={cashOpenForm.opening_amount} onChange={handleText(setCashOpenForm)} className="field-input w-full rounded-2xl px-4 py-3 text-sm outline-none transition" /></label><label className="block"><span className="field-label mb-2 block text-sm font-medium">Observaciones</span><input name="notes" value={cashOpenForm.notes} onChange={handleText(setCashOpenForm)} className="field-input w-full rounded-2xl px-4 py-3 text-sm outline-none transition" /></label><button type="submit" disabled={saving} className="primary-button w-full rounded-2xl px-4 py-3 text-sm font-semibold">Abrir caja</button></form> : <form className="space-y-3" onSubmit={submitCashClose}><div className="info-box rounded-2xl px-4 py-3 text-sm">Contá solamente el efectivo físico. Las transferencias y otros cobros virtuales no se cargan en este campo.</div><label className="block"><span className="field-label mb-2 block text-sm font-medium">Efectivo contado al cierre</span><input name="actual_cash_amount" type="number" min="0" step="0.01" value={cashCloseForm.actual_cash_amount} onChange={handleText(setCashCloseForm)} className="field-input w-full rounded-2xl px-4 py-3 text-sm outline-none transition" /></label><label className="block"><span className="field-label mb-2 block text-sm font-medium">Observaciones de cierre</span><input name="notes" value={cashCloseForm.notes} onChange={handleText(setCashCloseForm)} className="field-input w-full rounded-2xl px-4 py-3 text-sm outline-none transition" /></label><button type="submit" disabled={saving} className="section-button section-button-idle w-full rounded-2xl px-4 py-3 text-sm font-semibold transition">Cerrar caja</button></form>}
          </div>
        </Panel>
      </section>

      <section className="grid gap-6 xl:grid-cols-[0.9fr_1.1fr]">
        <Panel title="Lectura operativa" description="Mostrá lo imprescindible del turno sin exponer números sensibles del dueño.">
          <div className="grid gap-4 sm:grid-cols-2">
            <MetricCard label="Ventas del día" value={cashSummary.today_sales_count} />
            <MetricCard label="Unidades vendidas" value={cashSummary.today_units_sold} />
            <MetricCard label="Stock bajo" value={lowStockItems.length} emphasis={lowStockItems.length > 0} />
            <MetricCard label="Productos cargados" value={totalItems} />
          </div>
          <div className="mt-5 grid gap-4 md:grid-cols-2">
            <QuickAction title="Ir a inventario" description="Editar precios, stock y categorías del catálogo." onClick={() => setActiveSection("inventory")} />
            <QuickAction title="Abrir tesorería privada" description="Ingresá a la vista del dueño con reportes, caja y análisis." onClick={() => setActiveSection("treasury")} />
          </div>
        </Panel>
        <Panel title="Últimas ventas" description="Historial corto del turno para validar rápidamente qué se está cobrando.">
          <div className="space-y-3">
            {recentSales.length === 0 ? <EmptyState>Todavía no hay ventas registradas en el período visible.</EmptyState> : recentSales.map((sale) => <RecentSaleCard key={sale.id} sale={sale} formatMoney={formatMoney} formatDateTime={formatDateTime} />)}
          </div>
        </Panel>
      </section>

      <Panel id="tour-home-profile" title="Perfil comercial" description="Estos datos personalizan el ticket, el sidebar y dejan la app lista para cualquier negocio.">
        <form className="grid gap-4 md:grid-cols-2" onSubmit={handleBusinessProfileSave}>
          <label className="block"><span className="field-label mb-2 block text-sm font-medium">Nombre del local</span><input id="business-profile-name" name="businessName" value={businessProfileForm.businessName} onChange={handleText(setBusinessProfileForm)} className="field-input w-full rounded-2xl px-4 py-3 text-sm outline-none transition" /></label>
          <label className="block"><span className="field-label mb-2 block text-sm font-medium">Dirección comercial</span><input name="businessAddress" value={businessProfileForm.businessAddress} onChange={handleText(setBusinessProfileForm)} className="field-input w-full rounded-2xl px-4 py-3 text-sm outline-none transition" /></label>
          <label className="block"><span className="field-label mb-2 block text-sm font-medium">WhatsApp</span><input name="businessWhatsapp" value={businessProfileForm.businessWhatsapp} onChange={handleText(setBusinessProfileForm)} className="field-input w-full rounded-2xl px-4 py-3 text-sm outline-none transition" /></label>
          <label className="block"><span className="field-label mb-2 block text-sm font-medium">CUIT</span><input name="businessTaxId" value={businessProfileForm.businessTaxId} onChange={handleText(setBusinessProfileForm)} className="field-input w-full rounded-2xl px-4 py-3 text-sm outline-none transition" /></label>
          <div className="md:col-span-2">
            <LogoUploadField label="Logo del comercio (opcional)" logoDataUrl={businessProfileForm.businessLogoDataUrl} onSelect={(event) => handleLogoUpload(event, setBusinessProfileForm)} onClear={() => clearLogo(setBusinessProfileForm)} />
          </div>
          <button type="submit" disabled={saving} className="primary-button md:col-span-2 rounded-2xl px-4 py-3 text-sm font-semibold">Guardar perfil comercial</button>
        </form>
      </Panel>

      <Panel id="tour-home-devices" title="Dispositivos del local" description="Dejá lista la balanza para operar por peso. El modo de prueba permite validar la integración sin hardware conectado.">
        <div className="grid gap-6 xl:grid-cols-[0.9fr_1.1fr]">
          <div className="space-y-4">
            <div className="soft-card rounded-2xl p-4">
              <div className="content-strong text-lg font-semibold">Estado actual</div>
              <div className="mt-4 space-y-3">
                <StatusRow label="Proveedor activo" value={scaleStatus.provider} strong />
                <StatusRow label="Tipo de conexión" value={scaleStatus.connection_type} />
                <StatusRow label="Lista para leer" value={scaleStatus.ready ? "Sí" : "No"} strong={scaleStatus.ready} />
                <StatusRow label="Soporte serial en este equipo" value={scaleStatus.serial_supported ? "Disponible" : "No disponible"} strong={scaleStatus.serial_supported} />
              </div>
              <div className="info-box mt-4 rounded-2xl px-4 py-3 text-sm">{scaleStatus.detail}</div>
              {scaleReadResult ? <div className="success-soft mt-4 rounded-2xl px-4 py-3 text-sm">Última lectura: {scaleReadResult.weight} {scaleReadResult.unit} · {scaleReadResult.measured_at}</div> : null}
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <QuickAction title="Probar lectura" description="Ejecutá una lectura inmediata con la configuración actual." onClick={testScaleRead} emphasis />
              <QuickAction title="Actualizar puertos" description="Volvé a consultar los puertos COM detectados en esta PC." onClick={refreshScalePorts} />
              <QuickAction title="Ir a inventario" description="Usá esta base después para vender o ingresar productos por peso." onClick={() => setActiveSection("inventory")} />
            </div>
          </div>

          <form className="grid gap-4 md:grid-cols-2" onSubmit={saveScaleConfig}>
            <label className="soft-card flex items-center justify-between rounded-2xl px-4 py-4 md:col-span-2">
              <div>
                <div className="content-strong text-sm font-semibold">Habilitar balanza</div>
                <div className="panel-description mt-1 text-sm">Activa el servicio local para lecturas de peso.</div>
              </div>
              <input type="checkbox" checked={scaleConfig.enabled} onChange={handleScaleEnabledChange} className="h-5 w-5" />
            </label>
            <SelectField label="Proveedor" name="provider" value={scaleConfig.provider} onChange={handleScaleField} options={scaleProviderOptions} />
            <SelectField label="Conexión prevista" name="connection_type" value={scaleConfig.connection_type} onChange={handleScaleField} options={scaleConnectionOptions} />
            {serialPorts.length > 0 ? <SelectField label="Puerto COM" name="port" value={scaleConfig.port} onChange={handleScaleField} options={serialPorts.map((port) => port.device)} /> : <InputField label="Puerto COM" name="port" value={scaleConfig.port} onChange={handleScaleField} placeholder="Ejemplo: COM3" />}
            <InputField label="Baudrate" name="baudrate" type="number" min="1200" max="115200" value={scaleConfig.baudrate} onChange={handleScaleField} />
            <InputField label="Host / IP" name="host" value={scaleConfig.host} onChange={handleScaleField} placeholder="Ejemplo: 192.168.0.80" />
            <InputField label="Puerto TCP" name="tcp_port" type="number" min="0" max="65535" value={scaleConfig.tcp_port} onChange={handleScaleField} />
            <SelectField label="Unidad" name="unit" value={scaleConfig.unit} onChange={handleScaleField} options={scaleUnitOptions} />
            <InputField label="Timeout (ms)" name="timeout_ms" type="number" min="100" max="10000" value={scaleConfig.timeout_ms} onChange={handleScaleField} />
            <InputField label="Lecturas estables" name="stable_read_count" type="number" min="1" max="10" value={scaleConfig.stable_read_count} onChange={handleScaleField} />
            <InputField label="Peso simulado" name="simulated_weight" type="number" min="0" max="9999" step="0.001" value={scaleConfig.simulated_weight} onChange={handleScaleField} />
            <button type="submit" disabled={saving} className="primary-button rounded-2xl px-4 py-3 text-sm font-semibold md:col-span-2">Guardar configuración de balanza</button>
          </form>
        </div>
      </Panel>
    </div>
  );
}
