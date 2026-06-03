# 📋 Creación Manual de Documentos - Guía Rápida

## ¿Qué es?
Nueva funcionalidad en el módulo **"Importar Excel"** que permite crear documentos (facturas, gastos, etc.) directamente en el sistema sin necesidad de archivo Excel.

## ¿Cuándo usar?
- ✅ Crear "Otros Documentos" (tipos personalizados)
- ✅ Correcciones de últimos minutos
- ✅ Documentos puntuales (1-10 únicamente)
- ✅ Sin archivo Excel disponible

## ¿Cuándo NO usar?
- ❌ Importar más de 50 documentos (usar Importación Masiva)
- ❌ Si tienes archivo Excel (usar Importación Masiva)

---

## 🚀 Pasos de Uso

### 1. Acceder al módulo
Sidebar izquierdo → **📥 Importar Excel**

### 2. Cambiar a "Creación Manual"
Haz click en el botón **"✏️ Creación Manual"** en la parte superior

### 3. Seleccionar tipo de documento
- **📄 Factura** → Documentos de compra estándar
- **💸 Gasto** → Gastos operacionales
- **📋 Otro tipo de documento** → Tipos personalizados

**Nota:** Si seleccionas "Otro tipo", aparecerá un campo para escribir el nombre (ej: "Nota de Crédito")

### 4. Agregar documentos
Haz click en **"+ Agregar Fila"** para cada documento a crear

### 5. Llenar los campos
Para cada fila, completa:

| Campo | Ejemplo | Obligatorio |
|-------|---------|------------|
| **Folio** | INV-2026-001 | ✅ Sí |
| **Fecha Emisión** | 2026-06-03 | ✅ Sí |
| **Proveedor** | Distribuidora ABC | ✅ Sí |
| **Monto** | 50000 | ✅ Sí |

### 6. Guardar documentos
Haz click en **"💾 Guardar Documentos"**

Verás un mensaje:
- ✅ "X documento(s) creado(s)" → Éxito
- ❌ "Fila X: Completa todos los campos" → Falta información

### 7. (Opcional) Limpiar y empezar de nuevo
Click en **"Limpiar"** para resetear el formulario

---

## 📋 Tabla de Validaciones

| Validación | Mensaje | Solución |
|-----------|---------|----------|
| Campo vacío | "Fila X: Completa todos los campos" | Rellena todos los campos |
| Sin documentos | "Debes agregar al menos un documento" | Click "+ Agregar Fila" |
| Folio duplicado | Se omite silenciosamente | Usa folio diferente |
| Monto = 0 | Se omite | Ingresa monto > 0 |
| Monto = texto | Se convierte a 0 | Usa solo números |

---

## 💡 Tips & Tricks

### Copiar formulario
Si necesitas crear documentos similares:
1. Llena el primer documento
2. Click "+ Agregar Fila"
3. Modifica solo los campos diferentes

### Cambiar tipo de documento
Si empiezas con "Factura" pero quieres "Gasto":
1. Selecciona "Gasto" nuevamente
2. Los documentos que agreges usarán el nuevo tipo

### Eliminar fila
Haz click en **"✕ Eliminar"** en la fila que quieras remover

### Ver los documentos creados
Una vez guardados, ve al módulo **📄 Facturas** para verlos listados

---

## 🎯 Ejemplos Prácticos

### Ejemplo 1: Una factura
```
Folio:          INV-2026-001
Fecha:          2026-06-03
Proveedor:      Distribuidora ABC
Monto:          50,000
Tipo:           Factura
```
Click "Guardar" → ✅ 1 documento creado

### Ejemplo 2: Múltiples documentos de tipos diferentes
```
Fila 1:
  Folio:        INV-2026-001
  Fecha:        2026-06-03
  Proveedor:    Proveedor A
  Monto:        50,000
  Tipo:         Factura

Fila 2:
  Folio:        GASTO-2026-001
  Fecha:        2026-06-02
  Proveedor:    Servicio B
  Monto:        25,000
  Tipo:         Gasto

Fila 3:
  Folio:        NC-2026-001
  Fecha:        2026-06-01
  Proveedor:    Crédito C
  Monto:        5,000
  Tipo:         Otro → "Nota de Crédito"
```
Click "Guardar" → ✅ 3 documentos creados

---

## 🔒 Información Guardada

Cuando haces click en "Guardar", el sistema:
1. **Valida** todos los campos
2. **Verifica** que el folio sea único
3. **Inserta** en la tabla de facturas
4. **Marca** como "pendiente" automáticamente
5. **Retorna** confirmación

Los documentos creados aparecen con estado **"Pendiente"** en el módulo de Facturas.

---

## ❌ Solución de Problemas

### "No hay documentos para crear"
→ Debes hacer click "+ Agregar Fila" al menos una vez

### "Fila X: Completa todos los campos"
→ Verifica que TODOS los campos tengan información

### El documento no aparece en Facturas
→ Actualiza la página (F5)
→ Verifica que el estado sea "Pendiente"

### ¿Puedo editar después?
→ Por ahora, los documentos creados tienen estado "Pendiente"
→ Puedes verlos en el módulo de Facturas

---

## 🔗 Relacionado

- **Módulo Facturas**: Ver y gestionar documentos creados
- **Módulo Pagos**: Agrupar documentos para pagar
- **Importación Masiva**: Para importar de archivos Excel

---

**Última actualización:** 2026-06-03
**Versión:** v4.5+
