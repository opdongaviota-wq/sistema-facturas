import express from 'express';
import cors from 'cors';
import pg from 'pg';
import multer from 'multer';
import XLSX from 'xlsx';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const { Pool } = pg;
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const app = express();
const upload = multer({ storage: multer.memoryStorage() });

// Conexión PostgreSQL (Neon en producción, local en desarrollo)
const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: process.env.DATABASE_URL ? { rejectUnauthorized: false } : false
});

app.use(cors());
app.use(express.json());
app.use(express.static(__dirname));

if (!process.env.NETLIFY && !fs.existsSync('uploads')) fs.mkdirSync('uploads');

// ========== CREAR TABLAS ==========
async function initDB() {
    await pool.query(`
        CREATE TABLE IF NOT EXISTS facturas (
            id        SERIAL PRIMARY KEY,
            folio     TEXT,
            fecha     TEXT,
            proveedor TEXT,
            monto     INTEGER,
            estado    TEXT,
            medio_pago  TEXT,
            fecha_pago  TEXT,
            created_at  TIMESTAMPTZ DEFAULT NOW()
        )
    `);

    await pool.query(`
        CREATE TABLE IF NOT EXISTS productos (
            id         SERIAL PRIMARY KEY,
            folio      TEXT,
            nombre     TEXT,
            cantidad   REAL,
            valor      REAL,
            created_at TIMESTAMPTZ DEFAULT NOW()
        )
    `);

    await pool.query(`
        CREATE TABLE IF NOT EXISTS cheques (
            id             SERIAL PRIMARY KEY,
            factura_id     INTEGER REFERENCES facturas(id) ON DELETE CASCADE,
            numero_cheque  TEXT,
            fecha_cheque   TEXT,
            monto_cheque   INTEGER,
            created_at     TIMESTAMPTZ DEFAULT NOW()
        )
    `);

    // Migraciones (agrega columnas si no existen, ignora error si ya existen)
    const migraciones = [
        `ALTER TABLE facturas ADD COLUMN IF NOT EXISTS medio_pago TEXT`,
        `ALTER TABLE facturas ADD COLUMN IF NOT EXISTS fecha_pago TEXT`,
    ];
    for (const sql of migraciones) {
        await pool.query(sql).catch(() => {});
    }

    console.log('✅ Tablas listas');
}

initDB().catch(err => console.error('❌ Error iniciando DB:', err.message));

// ========== RUTAS ==========

// LOGIN
app.post('/api/auth/login', (req, res) => {
    const { email, password } = req.body;
    if (email === 'usuario1@empresa.com' && password === 'admin123') {
        res.json({
            success: true,
            token: 'token_' + Date.now(),
            user: { email, nombre: 'Usuario 1' }
        });
    } else {
        res.json({ success: false, message: 'Credenciales incorrectas' });
    }
});

// GET FACTURAS
app.get('/api/facturas', async (req, res) => {
    try {
        const result = await pool.query('SELECT * FROM facturas ORDER BY created_at DESC');
        res.json({ success: true, facturas: result.rows });
    } catch (err) {
        res.json({ success: false, error: err.message });
    }
});

// POST FACTURA
app.post('/api/facturas', async (req, res) => {
    const { folio, fecha, proveedor, monto, estado } = req.body;
    if (!folio || !monto) {
        return res.json({ success: false, message: 'Folio y monto son requeridos' });
    }
    try {
        const result = await pool.query(
            'INSERT INTO facturas (folio, fecha, proveedor, monto, estado) VALUES ($1,$2,$3,$4,$5) RETURNING id',
            [folio, fecha, proveedor, monto, estado || 'pendiente']
        );
        res.json({ success: true, id: result.rows[0].id });
    } catch (err) {
        res.json({ success: false, error: err.message });
    }
});

// UPDATE FACTURA
app.put('/api/facturas/:id', async (req, res) => {
    const { estado, medio_pago, fecha_pago } = req.body;
    const medioPago = estado === 'pagada' ? (medio_pago || null) : null;
    const fechaPago = estado === 'pagada' ? (fecha_pago || null) : null;
    try {
        await pool.query(
            'UPDATE facturas SET estado=$1, medio_pago=$2, fecha_pago=$3 WHERE id=$4',
            [estado, medioPago, fechaPago, req.params.id]
        );
        res.json({ success: true });
    } catch (err) {
        res.json({ success: false, error: err.message });
    }
});

// DELETE FACTURA
app.delete('/api/facturas/:id', async (req, res) => {
    try {
        await pool.query('DELETE FROM facturas WHERE id=$1', [req.params.id]);
        res.json({ success: true });
    } catch (err) {
        res.json({ success: false, error: err.message });
    }
});

// GET PRODUCTOS
app.get('/api/productos', async (req, res) => {
    try {
        const result = await pool.query('SELECT * FROM productos ORDER BY created_at DESC');
        res.json({ success: true, productos: result.rows });
    } catch (err) {
        res.json({ success: false, error: err.message });
    }
});

// POST PRODUCTO
app.post('/api/productos', async (req, res) => {
    const { folio, nombre, cantidad, valor } = req.body;
    try {
        const result = await pool.query(
            'INSERT INTO productos (folio, nombre, cantidad, valor) VALUES ($1,$2,$3,$4) RETURNING id',
            [folio, nombre, cantidad, valor]
        );
        res.json({ success: true, id: result.rows[0].id });
    } catch (err) {
        res.json({ success: false, error: err.message });
    }
});

// GET PAGOS con filtros (facturas pagadas + cheques embebidos)
app.get('/api/pagos', async (req, res) => {
    const { medio_pago, fecha_desde, fecha_hasta } = req.query;
    let query = "SELECT * FROM facturas WHERE estado='pagada'";
    const params = [];
    let i = 1;

    if (medio_pago)  { query += ` AND medio_pago=$${i++}`;   params.push(medio_pago); }
    if (fecha_desde) { query += ` AND fecha_pago>=$${i++}`;  params.push(fecha_desde); }
    if (fecha_hasta) { query += ` AND fecha_pago<=$${i++}`;  params.push(fecha_hasta); }
    query += ' ORDER BY fecha_pago DESC, created_at DESC';

    try {
        const facturasResult = await pool.query(query, params);
        const facturas = facturasResult.rows;
        if (!facturas.length) return res.json({ success: true, pagos: [] });

        const ids = facturas.map(f => f.id);
        const placeholders = ids.map((_, idx) => `$${idx + 1}`).join(',');
        const chequesResult = await pool.query(
            `SELECT * FROM cheques WHERE factura_id IN (${placeholders}) ORDER BY created_at`,
            ids
        );
        const cheques = chequesResult.rows;

        const pagos = facturas.map(f => ({
            ...f,
            cheques: cheques.filter(c => c.factura_id === f.id)
        }));
        res.json({ success: true, pagos });
    } catch (err) {
        res.json({ success: false, error: err.message });
    }
});

// GET CHEQUES por factura
app.get('/api/cheques/:facturaId', async (req, res) => {
    try {
        const result = await pool.query(
            'SELECT * FROM cheques WHERE factura_id=$1 ORDER BY created_at',
            [req.params.facturaId]
        );
        res.json({ success: true, cheques: result.rows });
    } catch (err) {
        res.json({ success: false, error: err.message });
    }
});

// POST CHEQUES (reemplaza todos los cheques de una factura)
app.post('/api/cheques/:facturaId', async (req, res) => {
    const { cheques } = req.body;
    const facturaId = req.params.facturaId;
    try {
        await pool.query('DELETE FROM cheques WHERE factura_id=$1', [facturaId]);
        for (const c of (cheques || [])) {
            await pool.query(
                'INSERT INTO cheques (factura_id, numero_cheque, fecha_cheque, monto_cheque) VALUES ($1,$2,$3,$4)',
                [facturaId, c.numero_cheque || '', c.fecha_cheque || '', c.monto_cheque || 0]
            );
        }
        res.json({ success: true });
    } catch (err) {
        res.json({ success: false, error: err.message });
    }
});

// UPLOAD EXCEL
app.post('/api/upload/excel', upload.single('file'), async (req, res) => {
    try {
        const workbook = XLSX.read(req.file.buffer || fs.readFileSync(req.file.path), { type: 'buffer' });
        const worksheet = workbook.Sheets[workbook.SheetNames[0]];
        const data = XLSX.utils.sheet_to_json(worksheet);

        const facturas = data.map(row => {
            let fecha = row['F. Emision'] || '';
            if (typeof fecha === 'number') {
                const d = new Date((fecha - 25569) * 86400 * 1000);
                fecha = d.toISOString().split('T')[0];
            } else {
                fecha = String(fecha).split(' ')[0];
            }
            return {
                folio:     String(row['Folio'] || '').trim(),
                fecha:     fecha.trim(),
                proveedor: String(row['Nombre'] || '').trim(),
                monto:     parseInt(String(row['Total'] || 0).replace(/[^0-9]/g, '')) || 0,
            };
        }).filter(f => f.folio && f.monto > 0);

        let insertadas = 0;
        for (const f of facturas) {
            await pool.query(
                'INSERT INTO facturas (folio, fecha, proveedor, monto, estado) VALUES ($1,$2,$3,$4,$5)',
                [f.folio, f.fecha, f.proveedor, f.monto, 'pendiente']
            ).catch(() => {}); // ignora duplicados
            insertadas++;
        }

        if (req.file.path) fs.unlinkSync(req.file.path);
        res.json({
            success: true,
            insertadas,
            total: facturas.length,
            message: `${insertadas}/${facturas.length} facturas importadas`
        });
    } catch (error) {
        res.json({ success: false, error: error.message });
    }
});

// FRONTEND
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'index.html'));
});

// INICIAR SERVIDOR (solo en local, no en Netlify)
const PORT = process.env.PORT || 3001;
if (!process.env.NETLIFY) app.listen(PORT, () => {
    console.log(`
╔════════════════════════════════════════╗
║   ✅ Facturas Cloud — PostgreSQL      ║
║   🚀 http://localhost:${PORT}            ║
║   📊 Excel: FUNCIONAL                  ║
║   💳 Pagos: FUNCIONAL                  ║
║   📦 Inventario: FUNCIONAL             ║
╚════════════════════════════════════════╝
    `);
});

export default app;
