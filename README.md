# AppStock

Base inicial para una aplicación de control de stock con:

- Backend en FastAPI
- Frontend en React + Vite + Tailwind
- Diseño responsive orientado a uso local en PC
- Flujo inicial compatible con lector de código de barras que actúa como teclado
- Persistencia local con SQLite

## Estructura

```text
backend/
  app/
    main.py
    models.py
    repository.py
    routers/
  pyproject.toml
frontend/
  src/
    App.jsx
```

## Backend con uv

```bash
cd backend
uv venv
.venv\Scripts\activate
uv sync
uv run uvicorn app.main:app --reload
```

API disponible en `http://127.0.0.1:8000`.

La base de datos local se crea automáticamente en `backend/data/appstock.db`.

## Frontend

```bash
cd frontend
npm install
npm run dev
```

Frontend disponible en `http://127.0.0.1:5173`.

Si el backend corre en un puerto distinto de `8001`, creá `frontend/.env` con:

```bash
VITE_API_URL=http://127.0.0.1:PUERTO/api
```

## Primera funcionalidad incluida

- Listado de productos
- Alta manual de producto
- Registro de ingreso por código escaneado
- Alertas visuales de stock bajo
- Persistencia local en SQLite

## Siguiente evolución recomendada

1. Movimientos de entrada y salida con historial
2. Edición y baja de productos
3. Búsqueda y filtros
4. Reportes de stock crítico
5. Impresión de etiquetas y códigos
