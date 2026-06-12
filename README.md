# Sistema de Gestión de Facturas y Pagos 📊

Sistema moderno de control de facturas, proveedores y pagos construido con **JAMstack** y **Supabase**.

## ✨ Características

- **Dashboard Ejecutivo**: KPIs en tiempo real (facturas pendientes, montos, cheques)
- **Gestión de Facturas**: Registrar, clasificar y seguimiento de facturas
- **Control de Proveedores**: Base de datos centralizada de proveedores
- **Módulo de Pagos**: Registrar pagos individuales o por lotes
- **Gestión de Cheques**: Control de cheques con fechas de canje
- **Reportes Avanzados**: Análisis de flujos de pago y tendencias

## 🚀 Acceso

La aplicación está disponible en GitHub Pages:
- [https://opdongaviota-wq.github.io/sistema-facturas](https://opdongaviota-wq.github.io/sistema-facturas)

## 🏗️ Arquitectura

### Frontend
- HTML5, CSS3, JavaScript vanilla
- Sin dependencias externas (excepto Supabase SDK)
- Interfaz responsiva y moderna

### Backend
- **Supabase** (PostgreSQL + API REST)
- Proyecto: `Control-facturas`
- Autenticación: Anonymous (RLS habilitado)

### Base de Datos
Tablas principales:
- `invoices` - Facturas
- `providers` - Proveedores
- `payments` - Registros de pago
- `checks` - Cheques
- `categories` - Categorías de factura
- `payment_methods` - Medios de pago
- `check_invoices` - Relación cheque-factura

## 📋 Requisitos

Ninguno para usar. El sistema funciona completamente en el navegador.

Para desarrollar:
- Git
- Cuenta Supabase (las credenciales están en `index.html`)

## 🔧 Configuración Local

1. **Clonar repositorio**
```bash
git clone https://github.com/opdongaviota-wq/sistema-facturas.git
cd sistema-facturas
```

2. **Servir localmente**
```bash
# Python
python -m http.server 8000

# O Node.js
npx http-server
```

3. **Abrir en navegador**
```
http://localhost:8000
```

## 📱 Funcionalidades Detalladas

### Dashboard
- Vista rápida de KPIs principales
- Listado de facturas recientes
- Estado de pagos y cheques

### Facturas
- Crear nueva factura
- Asignar categoría y proveedor
- Establecer fecha de vencimiento
- Seguimiento de estado (pendiente, parcial, pagado, vencido)

### Pagos
- Registrar pago de factura
- Múltiples medios de pago (cheque, transferencia, webpay, efectivo, depósito)
- Actualización automática de estado de factura
- Historial de pagos

### Cheques
- Registrar cheques recibidos
- Seguimiento de fechas de canje
- Estados: pendiente, cobrado, rechazado

### Reportes
- Filtrar por proveedor y período
- Análisis de monto facturado vs pagado
- Identificación de pendientes

## 🔐 Seguridad

- Las credenciales de Supabase son públicas (solo lectura y escritura controlada)
- Row Level Security (RLS) configurado en Supabase
- Sin almacenamiento de datos sensibles

## 📊 Estados de Factura

- **Pendiente**: Sin pagos registrados
- **Parcial**: Pagos registrados pero no cubre el total
- **Pagado**: Monto completo pagado
- **Vencido**: Pasó la fecha de vencimiento sin pagar

## 🛠️ Desarrollo

### Modificar interfaz
Editar `index.html` directamente

### Cambiar conexión Supabase
Actualizar en `<script>`:
```javascript
const SUPABASE_URL = 'tu-url';
const SUPABASE_ANON_KEY = 'tu-clave';
```

### Agregar tablas nuevas
1. Crear en Supabase
2. Agregar funciones en `index.html`
3. Conectar en UI

## 📞 Soporte

Para issues o mejoras, contacta al equipo.

## 📄 Licencia

Privado - Uso interno

---

**Construido con ❤️ usando JAMstack + Supabase**
