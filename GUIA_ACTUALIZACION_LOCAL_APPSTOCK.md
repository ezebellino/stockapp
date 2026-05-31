# Guia de actualizacion local de AppStock

Documento para actualizar la aplicacion instalada en el comercio sin perder datos.

## Estado del paquete actual

Segun la terminal revisada, la preparacion ya quedo correcta:

- La venv del backend ya funciona con Python 3.13.5.
- Las dependencias estan instaladas: FastAPI, Uvicorn, Pydantic, pyserial y PyInstaller.
- `scripts\build_pyinstaller.ps1` termino y genero `backend\dist\AppStockLocal`.
- `scripts\prepare_release.ps1` termino y dejo listo `release\AppStockLocal`.

Carpeta que se debe copiar al pendrive o disco externo:

```text
C:\ProjectsZeqe\AppStock\release\AppStockLocal
```

Esa carpeta debe contener, como minimo:

```text
AppStockLocal.exe
_internal\
scripts\
Actualizador Base Local.bat
LEEME.txt
```

## Antes de salir hacia el local

1. Conectar el pendrive o disco externo.
2. Copiar completa esta carpeta:

```text
C:\ProjectsZeqe\AppStock\release\AppStockLocal
```

3. Pegarla en el pendrive. Ejemplo:

```text
E:\AppStockLocal
```

4. Verificar que en el pendrive exista:

```text
E:\AppStockLocal\AppStockLocal.exe
E:\AppStockLocal\Actualizador Base Local.bat
E:\AppStockLocal\scripts\update_portable_release.ps1
```

5. No copiar solamente el `.exe`. Llevar la carpeta completa `AppStockLocal`.

## En la PC del comercio

### 1. Cerrar la aplicacion

1. Cerrar AppStock desde la ventana o navegador.
2. Si quedo abierto en segundo plano, abrir el Administrador de tareas.
3. Buscar `AppStockLocal.exe`.
4. Finalizarlo si sigue ejecutandose.

El actualizador no avanza si detecta `AppStockLocal.exe` abierto.

### 2. Hacer backup manual antes de tocar nada

Antes de actualizar, copiar la carpeta instalada actual completa.

Ejemplo: si la app actual esta en:

```text
C:\AppStockLocal
```

crear una copia al lado:

```text
C:\AppStockLocal_BACKUP_antes_actualizacion
```

Esto permite volver atras si algo sale mal.

Importante: no borrar la carpeta original hasta verificar que la actualizacion funciona.

### 3. Ejecutar el actualizador correcto

En la carpeta instalada del comercio, abrir:

```text
C:\AppStockLocal\Actualizador Base Local.bat
```

Cuando pregunte:

```text
Ruta de la carpeta AppStockLocal del pendrive:
```

pegar la ruta de la carpeta nueva del pendrive. Ejemplo:

```text
E:\AppStockLocal
```

No poner:

```text
E:\
C:\AppStockLocal
C:\AppStockLocal\AppStockLocal.exe
```

Debe apuntar a la carpeta nueva que contiene `AppStockLocal.exe`.

### 4. Que hace el actualizador

El actualizador:

- copia el programa nuevo desde el pendrive hacia la instalacion del comercio;
- preserva `data\`;
- preserva `logs\`;
- crea un respaldo temporal `_backup_update` de `data` y `logs`;
- evita actualizar si el origen y destino son la misma carpeta.

No reemplaza los datos del cliente si se usa correctamente.

## Despues de actualizar

1. Abrir:

```text
C:\AppStockLocal\AppStockLocal.exe
```

2. Esperar unos segundos a que abra el navegador.
3. Verificar que aparecen los productos, ventas y datos del comercio.
4. Ir a la pantalla de ventas/dispositivos.
5. En `Impresora de tickets`, usar:

```text
GADNIC IT1050 - termica 80 mm
```

6. Presionar:

```text
Usar GADNIC IT1050
Guardar impresora de ticket
```

7. Hacer una venta de prueba o reimprimir un ticket si el flujo lo permite.
8. En la ventana de impresion de Windows/navegador:

- elegir la impresora termica GADNIC;
- usar papel de 80 mm si Windows lo permite;
- desactivar encabezados y pies del navegador si aparecen;
- dejar escala en 100% o "Predeterminado";
- revisar que el ticket no salga cortado.

## Cosas que NO hay que hacer

- No ejecutar `Reiniciar AppStock.bat` en la PC del comercio: eso es para limpiar datos en pruebas.
- No borrar `data\`.
- No borrar `logs\` salvo que ya no se necesiten.
- No copiar la carpeta nueva encima manualmente si no estas seguro de preservar `data\`.
- No elegir como origen la misma carpeta instalada.
- No actualizar con `AppStockLocal.exe` abierto.

## Si algo falla

### El actualizador dice que AppStock esta abierto

1. Abrir Administrador de tareas.
2. Finalizar `AppStockLocal.exe`.
3. Ejecutar de nuevo `Actualizador Base Local.bat`.

### El actualizador dice que no encuentra AppStockLocal.exe

La ruta elegida esta mal.

Corregirla para que apunte a:

```text
E:\AppStockLocal
```

y no a:

```text
E:\
E:\AppStockLocal\AppStockLocal.exe
```

### La app actualizada no abre

1. Cerrar cualquier `AppStockLocal.exe`.
2. Revisar si existe la carpeta backup manual:

```text
C:\AppStockLocal_BACKUP_antes_actualizacion
```

3. Renombrar la carpeta fallida, por ejemplo:

```text
C:\AppStockLocal_FALLIDA
```

4. Restaurar el backup:

```text
C:\AppStockLocal_BACKUP_antes_actualizacion
```

a:

```text
C:\AppStockLocal
```

5. Abrir nuevamente `C:\AppStockLocal\AppStockLocal.exe`.

## Checklist final antes de irte del local

- La app abre sin errores.
- Se ven los productos existentes.
- Se ven ventas o reportes anteriores.
- La caja/datos del comercio siguen cargados.
- La configuracion de ticket quedo en GADNIC IT1050 o 80 mm.
- Se hizo una impresion de prueba.
- El ticket sale dentro del ancho del papel.
- El backup manual sigue guardado por seguridad.

## Comandos utiles para regenerar el paquete en tu PC

Estos comandos son para usar en tu PC de desarrollo, no en la PC del comercio.

```powershell
cd C:\ProjectsZeqe\AppStock
npm.cmd run build --prefix frontend
powershell -ExecutionPolicy Bypass -File .\scripts\build_pyinstaller.ps1
powershell -ExecutionPolicy Bypass -File .\scripts\prepare_release.ps1
```

Si alguna vez se rompe la venv de nuevo:

```powershell
cd C:\ProjectsZeqe\AppStock\backend
py -3 -m venv .venv
.\.venv\Scripts\python.exe -m pip install -U pip
.\.venv\Scripts\python.exe -m pip install fastapi==0.116.1 "uvicorn[standard]==0.35.0" pydantic==2.11.7 pyserial==3.5 pyinstaller
cd C:\ProjectsZeqe\AppStock
powershell -ExecutionPolicy Bypass -File .\scripts\build_pyinstaller.ps1
powershell -ExecutionPolicy Bypass -File .\scripts\prepare_release.ps1
```

