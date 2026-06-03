# 📁 Sistema de Categorización de Facturas - Guía Completa

## 🎯 Descripción General

Se ha implementado un **sistema completo de categorización de facturas** que permite:

- ✅ **Categorizar** facturas existentes en 8 categorías predefinidas
- ✅ **Filtrar y agrupar** facturas por categoría
- ✅ **Auto-categorizar** folios conocidos al importar Excel
- ✅ **Asignar manualmente** categoría a nuevas facturas
- ✅ **Visualizar** categoría en la tabla con emojis

---

## 📋 Categorías Disponibles

| Emoji | Categoría | Descripción |
|-------|-----------|------------|
| 🔧 | Servicios | Servicios profesionales, mantenimiento, consultoría |
| 🦞 | Mariscos y Pescados | Productos del mar, pescaderías |
| 🛒 | Abarrotes | Productos de almacén, genéricos |
| ❄️ | Congelados | Productos congelados en general |
| 📦 | Envases | Cajas, empaques, materiales de empaque |
| 🧹 | Aseo y Limpieza | Productos de limpieza, desinfectantes |
| 🍷 | Líquidos | Bebidas, aceites, líquidos en general |
| ⚙️ | Equipos | Maquinaria, herramientas, equipos |

---

## 🚀 Cómo Usar

### Opción 1: Asignar Categoría a Una Factura

#### Paso 1: Ir al módulo Facturas
- Click en **📄 Facturas** en el menú lateral

#### Paso 2: Encontrar la factura
- Usa filtros de período/proveedor si es necesario
- Busca la factura en la tabla

#### Paso 3: Asignar categoría
1. Click en botón **"Categoría"** en la fila
2. Se abre un modal con la factura
3. Selecciona la categoría deseada
4. Click **"Guardar"**

#### Paso 4: Confirmación
- La tabla se actualiza automáticamente
- La categoría aparece con su emoji

### Opción 2: Filtrar por Categoría

#### Paso 1: Modo Personalizado
- Click en botón **"🔧 Personalizado"** en período

#### Paso 2: Seleccionar categoría
- Dropdown **"Categoría"** aparece
- Elige la categoría que deseas ver

#### Paso 3: Ver resultados
- La tabla muestra solo facturas de esa categoría
- Info resumen actualiza con filtro aplicado

#### Paso 4: Limpiar filtro
- Click en **"Limpiar"** para resetear
- O selecciona **"— Todas —"** en categoría

---

## 📊 Vista de Tabla

La tabla de facturas ahora incluye:

```
┌─────────────────────────────────────────────────────────────────┐
│ Tipo │ Folio    │ Proveedor │ RUT    │ Fecha │ Monto │ Categoría │
├─────────────────────────────────────────────────────────────────┤
│ Fact │ INV-001  │ ABC Corp  │ 12345 │ 2026  │ $100k │ 🔧 Servic │
│ Fact │ INV-002  │ Pescados  │ 54321 │ 2026  │ $50k  │ 🦞 Marisco│
│ Fact │ INV-003  │ Distribuid│ 99999 │ 2026  │ $75k  │ Sin asign  │
└─────────────────────────────────────────────────────────────────┘
```

### Columnas
- **Tipo**: Tipo de documento
- **Folio**: Número de factura
- **Proveedor**: Nombre del proveedor
- **RUT**: RUT del proveedor
- **Fecha**: Fecha de emisión
- **Monto**: Cantidad en pesos
- **Categoría**: 🎨 Categoría asignada (con emoji)
- **Estado**: Pendiente/Pagada/Vencida
- **Acciones**: Botón para asignar categoría

---

## 💡 Casos de Uso

### Caso 1: Categorizar Facturas Importadas
```
Escenario: Acabas de importar un Excel con 50 facturas
Problema: No tienen categoría asignada
Solución:
1. Abre módulo Facturas
2. Para cada factura, click "Categoría"
3. Selecciona según el proveedor
4. Guarda

Ventaja: Ahora puedes filtrar por tipo de compra
```

### Caso 2: Análisis de Gastos por Categoría
```
Escenario: Quiero ver cuánto gasté en "Aseo y Limpieza"
Problema: Las facturas están todas mezcladas
Solución:
1. Abre módulo Facturas
2. Click "Personalizado"
3. Selecciona "🧹 Aseo y Limpieza"
4. Ve solo las facturas de esa categoría

Resultado: Puedo calcular gastos por categoría
```

### Caso 3: Control de Compras por Tipo
```
Escenario: Tu jefe quiere saber cuánto gastaste en Equipos
Problema: No tienes un desglose rápido
Solución:
1. Filtra por "⚙️ Equipos"
2. Ves todas las facturas de equipos
3. Calcula monto total
4. Reporta a tu jefe

Resultado: Análisis rápido sin buscar manualmente
```

---

## ⚙️ Información Técnica

### Base de Datos

**Columna agregada a tabla `facturas`:**
```sql
ALTER TABLE facturas ADD COLUMN categoria TEXT;
```

**Valores permitidos:**
- `NULL` (sin categoría)
- `'Servicios'`
- `'Mariscos y Pescados'`
- `'Abarrotes'`
- `'Congelados'`
- `'Envases'`
- `'Aseo y Limpieza'`
- `'Líquidos'`
- `'Equipos'`

### Endpoint Actualizado

**PUT `/api/facturas/:id`**

Request:
```json
{
  "estado": "pendiente",
  "categoria": "Servicios"
}
```

Response:
```json
{
  "success": true
}
```

### Emojis Mapeados

```javascript
{
  'Servicios': '🔧',
  'Mariscos y Pescados': '🦞',
  'Abarrotes': '🛒',
  'Congelados': '❄️',
  'Envases': '📦',
  'Aseo y Limpieza': '🧹',
  'Líquidos': '🍷',
  'Equipos': '⚙️'
}
```

---

## 🎨 Interfaz

### Modal de Categoría

```
┌────────────────────────────────┐
│ 📋 Asignar Categoría           │
├────────────────────────────────┤
│                                │
│ Folio: INV-001                 │
│                                │
│ Selecciona una categoría:      │
│ [▼ — Sin categoría —        ] │
│   🔧 Servicios                 │
│   🦞 Mariscos y Pescados      │
│   🛒 Abarrotes                 │
│   ❄️ Congelados               │
│   📦 Envases                   │
│   🧹 Aseo y Limpieza          │
│   🍷 Líquidos                  │
│   ⚙️ Equipos                   │
│                                │
│ [Cancelar]  [Guardar]         │
└────────────────────────────────┘
```

### Filtro de Categoría

```
Período: [Todos] [Semana Actual] [...]
             ↓ al seleccionar "Personalizado"
Proveedor: [buscar...]
Categoría: [▼ — Todas —]
  🔧 Servicios
  🦞 Mariscos y Pescados
  ...
```

---

## 📈 Flujo de Trabajo Recomendado

### 1️⃣ Importación
```
Importar Excel → Facturas sin categoría
```

### 2️⃣ Categorización Inmediata
```
Para cada factura nueva:
  1. Identificar proveedor
  2. Click "Categoría"
  3. Seleccionar según tipo
  4. Guardar
```

### 3️⃣ Análisis
```
Filtrar por categoría:
  1. Click "Personalizado"
  2. Seleccionar categoría
  3. Ver resultados
  4. Analizar gastos
```

### 4️⃣ Reportes
```
Para reportar:
  1. Filtrar cada categoría
  2. Anotar monto total
  3. Compilar resumen
  4. Enviar a junta
```

---

## ✅ Checklist de Categorización

Usa este checklist para asegurar que todas las facturas están categorizadas:

- [ ] **Semana 1**: Categorizar todas las facturas existentes
- [ ] **Cada importación**: Asignar categoría mientras importas
- [ ] **Fin de mes**: Revisar categorías pendientes
- [ ] **Análisis**: Usar filtros para reportes

---

## 🔍 Solución de Problemas

### "¿Puedo cambiar la categoría después?"
**Sí**, puedes cambiar en cualquier momento:
1. Click "Categoría" en la factura
2. Selecciona nueva categoría
3. Guarda

### "¿Qué si selecciono '— Sin categoría —'?"
Se elimina la categoría asignada y la factura vuelve a "Sin asignar"

### "¿Puedo agregar más categorías?"
Actualmente están predefinidas 8 categorías. 
Si necesitas más, contacta al equipo técnico.

### "¿Dónde aparecen las categorías?"
- **Tabla de Facturas**: Columna visible
- **Filtros**: Disponible en modo Personalizado
- **Reportes**: (próximamente para análisis)

### "¿Se pierden datos si cambiome de período?"
**No**, las categorías se guardan en la base de datos
permanentemente.

---

## 🎯 Mejores Prácticas

✅ **DO's**
- Categorizar todas las facturas al importar
- Usar filtros para análisis rápidos
- Revisar regularmente facturas sin categoría
- Mantener consistencia en categorización

❌ **DON'Ts**
- Dejar todas las facturas sin categoría
- Crear categorías informales (usar las 8 predefinidas)
- Olvidar categorizar facturas nuevas
- Cambiar categoría sin motivo válido

---

## 📞 Información de Contacto

Si necesitas:
- ➕ **Agregar categorías**: Contacta al equipo técnico
- 🐛 **Reportar error**: Abre un issue
- 💡 **Sugerir mejora**: Propón a tu administrador
- 📊 **Capacitación**: Solicita demostración

---

**Última actualización**: 2026-06-03  
**Versión**: v4.5+ Categorización  
**Estado**: ✅ Producción

¡Comienza a categorizar tus facturas para mejor control de gastos! 📊
