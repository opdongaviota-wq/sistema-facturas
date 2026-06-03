# 💳 Reportes de Flujo de Cheques - Guía Completa

## 📊 Descripción General

Se han agregado **dos nuevos reportes** al módulo de Reportes para ayudarte a gestionar el flujo de caja relacionado con cheques emitidos:

### 1️⃣ **Reporte Flujo de Cheques Emitidos**
Tabla detallada de todos los cheques que has emitido, mostrando estado de vencimiento y días restantes.

### 2️⃣ **Reporte Resumen de Vencimientos**
Consolidado de cheques agrupados por fecha de vencimiento, con KPIs de flujo de caja para planificación.

---

## 🎯 ¿Para Qué Sirve?

### Problema que Resuelve
> "Necesito saber con anticipación cuánto flujo hay que tener disponible para cumplir con los compromisos de cheques"

### Solución Proporcionada
✅ **Visibilidad del flujo**: Ves todos los cheques emitidos en un solo lugar  
✅ **Alertas tempranas**: Identificas cheques a punto de vencer (próximos 7 días)  
✅ **Planificación de caja**: Proyectas necesidad de liquidez a 30 días  
✅ **Gestión de riesgo**: Ves cheques vencidos pendientes de acción  
✅ **Reportes exportables**: Descarga en Excel para análisis adicional  

---

## 🚀 Cómo Acceder

### Paso 1: Ir al Módulo Reportes
1. Haz click en **📊 Reportes** en el menú lateral

### Paso 2: Esperar Carga
- Los reportes se cargan automáticamente
- Verás los datos de cheques después de los reportes de facturas

### Paso 3: Explorar Reportes
- **Sección 1**: "💳 Flujo de Cheques Emitidos" (tabla detallada)
- **Sección 2**: "📅 Resumen de Vencimientos" (consolidado + KPIs)

---

## 📋 REPORTE 1: Flujo de Cheques Emitidos

### Vista General
Tabla con **todos los cheques emitidos** ordenados por fecha de vencimiento.

### Columnas
| Columna | Descripción |
|---------|------------|
| **N° Cheque** | Número identificador del cheque |
| **Proveedor** | Nombre del proveedor asociado |
| **Monto** | Cantidad de dinero del cheque ($) |
| **Fecha Vencimiento** | Cuándo se puede cobrar el cheque |
| **Estado** | Pendiente / Por Vencer / Vencida |
| **Días** | Cuántos días faltan/han pasado |

### Estados Explicados
- 🔵 **Pendiente**: Más de 5 días para vencer (tiempo suficiente)
- 🟠 **Por Vencer**: Entre 0-5 días (requiere atención)
- 🔴 **Vencida**: Ya pasó la fecha (requiere acción inmediata)

### Información Resumen
Encima de la tabla ves un resumen rápido:
```
X cheques · Monto total: $X.XXX.XXX
⏳ 10 pendientes · 🟠 3 por vencer · 🔴 2 vencidos
```

### Filtros Disponibles

#### Estado Cheque
- **— Todos —**: Ver todos los cheques
- **⏳ Pendiente**: Solo cheques sin urgencia
- **🟠 Por Vencer**: Cheques venciendo pronto
- **🔴 Vencida**: Cheques que ya pasaron

#### Rango de Fechas
- **Desde**: Fecha inicial (ej: 2026-06-01)
- **Hasta**: Fecha final (ej: 2026-06-30)

### Cómo Filtrar

#### Paso 1: Seleccionar Criterios
```
Estado Cheque: [🟠 Por Vencer]
Desde:         [2026-06-01]
Hasta:         [2026-06-30]
```

#### Paso 2: Aplicar Filtros
Haz click en **"🔍 Filtrar"**

#### Paso 3: Ver Resultados
La tabla se actualiza mostrando solo los cheques que cumplen criterios

#### Limpiar Filtros
Haz click en **"✕"** para volver a ver todos los cheques

### Exportar a Excel

Haz click en **"📥 Exportar Excel"**
- Genera archivo `Reporte_Cheques_[FECHA].xlsx`
- Contiene tabla completa filtrada
- Listo para análisis en Excel o correo

---

## 📅 REPORTE 2: Resumen de Vencimientos

### Vista General
**KPIs + Tabla consolidada** mostrando cuánto dinero vence cada fecha.

### KPIs de Flujo de Caja

#### 🔴 Vencidos
```
Monto total de cheques que ya pasaron la fecha
⚠️ Requiere acción inmediata
```
**Acción**: Contacta proveedores, gestiona recuperación

#### 🟠 Próximos 7 Días
```
Monto total de cheques que vencen en la próxima semana
Flujo urgente
```
**Acción**: Asegura disponibilidad de fondos

#### 🟡 Próximos 30 Días
```
Monto total de cheques que vencen en el próximo mes
Planificación de caja
```
**Acción**: Proyecta necesidades de liquidez

#### 🔵 Total Cheques
```
Monto total de TODOS los cheques emitidos
Flujo total a cubrir
```

### Tabla de Resumen

#### Columnas
| Columna | Descripción |
|---------|------------|
| **Fecha Vencimiento** | Fecha en que vence el grupo |
| **Cantidad Cheques** | Cuántos cheques vencen ese día |
| **Monto Total** | Dinero total de esos cheques |
| **Estado** | Pendiente / Por Vencer / Vencida |
| **Días Restantes** | Cuántos días faltan/pasaron |

#### Interpretación
```
Fecha: 2026-06-15 | Cheques: 3 | Monto: $150.000 | 🟠 Por Vencer | 12 días
```
Significa: El 15 de junio vencen 3 cheques por $150.000 total, en 12 días

### Casos de Uso

#### Caso 1: Gestión Diaria
**Problema**: "¿Qué cheques vencen hoy/esta semana?"
**Solución**: 
1. Abre Reportes → Resumen de Vencimientos
2. Ve tabla consolidada por fecha
3. Identifica fechas próximas
4. Asegura disponibilidad de fondos

#### Caso 2: Planificación Mensual
**Problema**: "¿Cuánto flujo necesitaré en los próximos 30 días?"
**Solución**:
1. Abre Reportes → Resumen de Vencimientos
2. Mira KPI "Próximos 30 Días"
3. Suma ese monto + otros compromisos
4. Proyecta necesidades con CFO/Tesorería

#### Caso 3: Análisis de Riesgo
**Problema**: "¿Tengo cheques vencidos sin pagar?"
**Solución**:
1. Abre Reportes → Resumen de Vencimientos
2. Mira KPI "Vencidos"
3. Si hay monto > 0, tienes cheques atrasados
4. Acciona para regularizar

#### Caso 4: Reportar a Directiva
**Problema**: "Necesito reportar flujo de cheques a la junta"
**Solución**:
1. Abre Reportes → Resumen de Vencimientos
2. Haz click "📥 Exportar Excel"
3. Abre en Excel
4. Comparte o integra en presentación

---

## 💡 Tips & Trucos

### Tip 1: Combina Ambos Reportes
1. Abre **Flujo de Cheques** → Filtra por "Por Vencer"
2. Abre **Resumen de Vencimientos** → Identifica fechas críticas
3. Combina info para tomar decisiones

### Tip 2: Monitoreo Periódico
- **Diario**: Revisa cheques venciendo hoy/mañana
- **Semanal**: Analiza próximos 7 días
- **Mensual**: Proyecta próximos 30 días

### Tip 3: Alertas Visuales
Los colores te ayudan rápidamente:
- 🔵 Azul = Tiempo suficiente
- 🟠 Naranja = Atención requerida
- 🔴 Rojo = Acción inmediata

### Tip 4: Exporta Regularmente
- Descarga reportes en Excel
- Crea histórico para análisis
- Comparte con equipo financiero

### Tip 5: Integración con Pagos
Los cheques aquí son los que:
- ✅ Ya fueron emitidos
- ✅ Están en manos del proveedor
- ✅ Falta que cobre (fecha de vencimiento)

---

## 🔍 Solución de Problemas

### "No veo ningún cheque en los reportes"
**Causas posibles**:
- ✅ No hay cheques registrados (registra pagos con cheque primero)
- ✅ Los cheques solo se ven si están vinculados a facturas pagadas

**Solución**:
1. Ve a módulo **💳 Pagos**
2. Crea un pago con medio = "Cheque"
3. Agrega número de cheque y fecha de vencimiento
4. Vuelve a Reportes y actualiza (F5)

### "¿Por qué cambian los estados?"
**Motivo**: Los estados se calculan dinámicamente basados en la fecha actual.

Ejemplo:
- Hoy: 2026-06-03
- Cheque vence: 2026-06-08 → Estado: "Por Vencer" (5 días)
- Mañana: 2026-06-04 → Estado: "Por Vencer" (4 días)
- Después: 2026-06-09 → Estado: "Vencida" (ya pasó)

### "¿Puedo editar o eliminar cheques?"
**No directamente** desde Reportes. Los cheques se gestionan desde:
- **Módulo Pagos**: Crear cheques asociados a pagos
- **Módulo Cheques**: Actualizar cheques existentes

### "¿Cuál es la diferencia entre fecha cheque y fecha pago?"
- **Fecha Cheque** (Vencimiento): Cuándo se puede cobrar
- **Fecha Pago**: Cuándo se pagó la factura

Los reportes usan **Fecha Cheque** para el vencimiento.

---

## 📊 Formatos de Exportación

### Archivo Excel Generado

#### Flujo de Cheques
```
N° Cheque | Proveedor    | Monto    | Fecha Vto | Estado      | Días
001234    | Distribuidor | 50000    | 2026-06-15| Por Vencer | 12
001235    | Servicios    | 100000   | 2026-06-20| Pendiente  | 17
```

#### Resumen Vencimientos
```
Fecha         | Cantidad | Monto    | Estado      | Días
2026-06-15    | 2        | 150000   | Por Vencer | 12
2026-06-20    | 1        | 100000   | Pendiente  | 17
```

---

## 🔗 Relación con Otros Módulos

### Módulo Pagos
- Es donde **crean cheques**
- Los reportes **muestran** esos cheques

### Módulo Facturas
- Los cheques están asociados a facturas
- Un cheque = pago de una factura

### Módulo Reportes
- **Reportes de Facturas**: Estado de documentos
- **Reportes de Cheques**: Estado de pagos (lo nuevo)

---

## 📈 Casos de Uso Avanzados

### Análisis 1: Flujo de Caja Proyectado
```
Hoy: 2026-06-03

Próximos 7 días:
- 2026-06-10: $50.000 (Distribuidor A)
- 2026-06-12: $75.000 (Servicio B)
Total: $125.000

Decisión: Asegura $125.000 disponibles en caja
```

### Análisis 2: Concentración de Riesgo
```
Pregunta: ¿Cuánto flujo concentrado en un solo día?

Resumen muestra:
- 2026-06-20: $500.000 (10 cheques)

Conclusión: Alto riesgo, diversificar pagos
```

### Análisis 3: Histórico de Vencimiento
```
Exporta Excel cada semana
Compara Próximos 30 días en diferentes fechas
Identifica patrones de flujo estacional
```

---

## 🎯 Checklist de Flujo de Caja

Usar estos reportes para tu checklist:

- [ ] **Diariamente**: ¿Hay cheques venciendo hoy?
- [ ] **Semanalmente**: ¿Tengo $ para próximos 7 días?
- [ ] **Mensualmente**: ¿Cubro próximos 30 días?
- [ ] **Trimestralmente**: ¿Cuál es la tendencia de flujo?
- [ ] **Anualmente**: ¿Cómo fue la proyección vs realidad?

---

## 📞 Información Técnica

**Endpoint Backend**:
```
GET /api/cheques/reporte/flujo
```

**Retorna**:
```json
{
  "success": true,
  "cheques": [
    {
      "numero_cheque": "001234",
      "proveedor": "ABC Corp",
      "monto_cheque": 50000,
      "fecha_cheque": "2026-06-15",
      "estado": "por_vencer",
      "dias": 12
    }
  ]
}
```

**Cálculo de Estado**:
- `dias < 0` → "vencida"
- `dias <= 5` → "por_vencer"
- `dias > 5` → "pendiente"

---

**Última actualización**: 2026-06-03  
**Versión**: v4.5+  
**Estado**: ✅ Producción

¡Comienza a usar estos reportes para optimizar tu flujo de caja! 🚀
