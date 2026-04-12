# AppStock

Aplicación local de control de stock, ventas y tesorería para comercios.

Incluye:

- Backend en FastAPI
- Frontend en React + Vite + Tailwind
- Persistencia local con SQLite
- Flujo para lector de código de barras
- Base para balanza digital local
- Modo de uso orientado a PC de negocio

## Estructura

```text
backend/
  app/
  run_local.py
frontend/
  src/
scripts/
  build_local.ps1
  build_pyinstaller.ps1
  prepare_release.ps1
  reset_local_data.ps1
  start_local.ps1
  update_local.ps1
  update_portable_release.ps1
AppStock Local.bat
Actualizar AppStock.bat
Actualizador Base Local.bat
Reiniciar AppStock.bat
```

## Modo desarrollo

Backend:

```powershell
cd backend
.\.venv\Scripts\python.exe -m uvicorn app.main:app --host 127.0.0.1 --port 8001 --reload
```

Frontend:

```powershell
cd frontend
npm run dev
```

Frontend de desarrollo:

```text
http://127.0.0.1:5173
```

Healthcheck del backend:

```text
http://127.0.0.1:8001/health
```

## Modo local para negocio

El frontend compilado queda servido por FastAPI. El negocio usa una sola URL local y un único lanzador.

### Preparar la versión local

```powershell
powershell -ExecutionPolicy Bypass -File .\scripts\build_local.ps1
```

Esto:

- compila el frontend en `frontend/dist`
- valida la compilación del backend
- deja la app lista para ejecutarse en modo local

### Abrir la app con doble click

Usá:

```text
AppStock Local.bat
```

Ese lanzador:

- usa el `.exe` de PyInstaller si ya existe
- si no existe, usa el arranque local con Python
- abre el navegador en `http://127.0.0.1:8001`

## Empaquetado con PyInstaller

### Generar el ejecutable

```powershell
powershell -ExecutionPolicy Bypass -File .\scripts\build_pyinstaller.ps1
```

Salida:

```text
backend\dist\AppStockLocal\
```

Dentro de esa carpeta queda:

- `AppStockLocal.exe`
- `data\`
- `logs\`
- `_internal\`

### Preparar una carpeta para pendrive

```powershell
powershell -ExecutionPolicy Bypass -File .\scripts\prepare_release.ps1
```

Salida:

```text
release\AppStockLocal\
```

Esa carpeta está pensada para copiar completa al pendrive o al disco de la PC del negocio. Para ejecutar la app en la otra PC, basta con abrir:

```text
release\AppStockLocal\AppStockLocal.exe
```

## Actualización portable sin perder datos

La base local no necesita borrarse para sumar campos nuevos. El backend aplica migraciones incrementales al arrancar, por ejemplo agregando columnas nuevas con `ALTER TABLE` cuando hacen falta.

Eso permite:

- conservar productos, ventas, caja y configuraciones ya cargadas
- actualizar el programa sin perder datos
- dejar que la base se adapte sola al abrir la versión nueva

### Actualizar desde pendrive en la PC del negocio

1. Cerrá `AppStockLocal.exe`
2. Copiá al pendrive la carpeta nueva `release\AppStockLocal`
3. En la instalación actual del cliente, ejecutá:

```text
Actualizador Base Local.bat
```

4. Indicá como origen la carpeta `AppStockLocal` del pendrive

Ese actualizador:

- reemplaza los archivos del programa
- preserva `data\`
- preserva `logs\`

No sobrescribas manualmente la carpeta `data` del cliente.

## Reinicio limpio para prueba de negocio

Para arrancar desde cero:

```text
Reiniciar AppStock.bat
```

Eso elimina la base local para que la próxima apertura muestre `Primer acceso`.

## Actualizaciones para entorno de desarrollo

### Desde internet / repositorio

Usá:

```text
Actualizar AppStock.bat
```

Y elegí la opción `1`.

Eso ejecuta:

```powershell
.\scripts\update_local.ps1 -UseGit
```

### Desde pendrive o carpeta local

Usá:

```text
Actualizar AppStock.bat
```

Y elegí la opción `2`.

Eso permite apuntar a una carpeta con la nueva versión del código.

Luego conviene reconstruir la versión local:

```powershell
powershell -ExecutionPolicy Bypass -File .\scripts\build_local.ps1
```
