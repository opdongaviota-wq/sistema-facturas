import express from 'express';
import cors from 'cors';
import pg from 'pg';
import bcrypt from 'bcryptjs';
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

if (!fs.existsSync('uploads')) fs.mkdirSync('uploads');

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

    await pool.query(`
        CREATE TABLE IF NOT EXISTS usuarios (
            id            SERIAL PRIMARY KEY,
            nombre        TEXT NOT NULL,
            email         TEXT UNIQUE NOT NULL,
            password_hash TEXT NOT NULL,
            rol           TEXT DEFAULT 'usuario',
            activo        BOOLEAN DEFAULT true,
            created_at    TIMESTAMPTZ DEFAULT NOW()
        )
    `);

    // Migraciones (agrega columnas si no existen, ignora error si ya existen)
    const migraciones = [
        `ALTER TABLE facturas ADD COLUMN IF NOT EXISTS medio_pago TEXT`,
        `ALTER TABLE facturas ADD COLUMN IF NOT EXISTS fecha_pago TEXT`,
        `ALTER TABLE facturas ADD COLUMN IF NOT EXISTS rut TEXT`,
    ];
    for (const sql of migraciones) {
        await pool.query(sql).catch(() => {});
    }

    // Seed: crear admin por defecto si no hay usuarios
    const count = await pool.query('SELECT COUNT(*) FROM usuarios');
    if (parseInt(count.rows[0].count) === 0) {
        const hash = await bcrypt.hash('admin123', 10);
        await pool.query(
            'INSERT INTO usuarios (nombre, email, password_hash, rol) VALUES ($1,$2,$3,$4)',
            ['Administrador', 'usuario1@empresa.com', hash, 'admin']
        );
        console.log('✅ Usuario admin creado por defecto');
    }

    console.log('✅ Tablas listas');
}

initDB().catch(err => console.error('❌ Error iniciando DB:', err.message));

// ========== RUTAS ==========

// LOGIN
app.post('/api/auth/login', async (req, res) => {
    const { email, password } = req.body;
    try {
        const result = await pool.query(
            'SELECT * FROM usuarios WHERE email=$1 AND activo=true',
            [email.toLowerCase().trim()]
        );
        if (!result.rows.length)
            return res.json({ success: false, message: 'Email o contraseña incorrectos' });

        const user = result.rows[0];
        const match = await bcrypt.compare(password, user.password_hash);
        if (!match)
            return res.json({ success: false, message: 'Email o contraseña incorrectos' });

        res.json({
            success: true,
            token: 'token_' + Date.now(),
            user: { id: user.id, email: user.email, nombre: user.nombre, rol: user.rol }
        });
    } catch (err) {
        res.json({ success: false, error: err.message });
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
    const { folio, fecha, proveedor, rut, monto, estado } = req.body;
    if (!folio || !monto) {
        return res.json({ success: false, message: 'Folio y monto son requeridos' });
    }
    try {
        const result = await pool.query(
            'INSERT INTO facturas (folio, fecha, proveedor, rut, monto, estado) VALUES ($1,$2,$3,$4,$5,$6) RETURNING id',
            [folio, fecha, proveedor, rut || null, monto, estado || 'pendiente']
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

// DELETE ALL FACTURAS (limpiar base — debe estar ANTES de /:id)
app.delete('/api/facturas/all', async (req, res) => {
    try {
        const result = await pool.query('DELETE FROM facturas');
        res.json({ success: true, eliminadas: result.rowCount });
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
            // Extraer RUT — prueba múltiples nombres de columna del SII
            const rut = String(
                row['Rut'] || row['RUT'] || row['R.U.T.'] || row['R.U.T'] ||
                row['Rut Proveedor'] || row['RUT Proveedor'] || row['rut'] || ''
            ).trim();
            return {
                folio:     String(row['Folio'] || '').trim(),
                fecha:     fecha.trim(),
                proveedor: String(row['Nombre'] || '').trim(),
                rut:       rut,
                monto:     parseInt(String(row['Total'] || 0).replace(/[^0-9]/g, '')) || 0,
            };
        }).filter(f => f.folio && f.monto > 0);

        // Obtener folios existentes para evitar duplicados (conserva versión anterior)
        const existingResult = await pool.query('SELECT folio FROM facturas');
        const existingFolios = new Set(existingResult.rows.map(r => r.folio));

        let insertadas = 0, omitidas = 0;
        for (const f of facturas) {
            if (existingFolios.has(f.folio)) {
                omitidas++;
                continue;
            }
            try {
                await pool.query(
                    'INSERT INTO facturas (folio, fecha, proveedor, rut, monto, estado) VALUES ($1,$2,$3,$4,$5,$6)',
                    [f.folio, f.fecha, f.proveedor, f.rut || null, f.monto, 'pendiente']
                );
                existingFolios.add(f.folio); // evita duplicados dentro del mismo archivo
                insertadas++;
            } catch (e) { omitidas++; }
        }

        if (req.file.path) fs.unlinkSync(req.file.path);
        res.json({
            success: true,
            insertadas,
            omitidas,
            total: facturas.length,
            message: `${insertadas}/${facturas.length} facturas importadas${omitidas > 0 ? ` · ${omitidas} duplicadas omitidas` : ''}`
        });
    } catch (error) {
        res.json({ success: false, error: error.message });
    }
});

// ========== USUARIOS ==========

// GET usuarios
app.get('/api/usuarios', async (req, res) => {
    try {
        const result = await pool.query(
            'SELECT id, nombre, email, rol, activo, created_at FROM usuarios ORDER BY created_at'
        );
        res.json({ success: true, usuarios: result.rows });
    } catch (err) {
        res.json({ success: false, error: err.message });
    }
});

// POST usuario (crear)
app.post('/api/usuarios', async (req, res) => {
    const { nombre, email, password, rol } = req.body;
    if (!nombre || !email || !password)
        return res.json({ success: false, message: 'Nombre, email y contraseña son requeridos' });
    try {
        const hash = await bcrypt.hash(password, 10);
        const result = await pool.query(
            'INSERT INTO usuarios (nombre, email, password_hash, rol) VALUES ($1,$2,$3,$4) RETURNING id',
            [nombre, email.toLowerCase().trim(), hash, rol || 'usuario']
        );
        res.json({ success: true, id: result.rows[0].id });
    } catch (err) {
        if (err.code === '23505')
            return res.json({ success: false, message: 'Ya existe un usuario con ese email' });
        res.json({ success: false, error: err.message });
    }
});

// DELETE usuario
app.delete('/api/usuarios/:id', async (req, res) => {
    try {
        const user = await pool.query('SELECT rol FROM usuarios WHERE id=$1', [req.params.id]);
        if (!user.rows.length) return res.json({ success: false, message: 'Usuario no encontrado' });

        if (user.rows[0].rol === 'admin') {
            const admins = await pool.query("SELECT COUNT(*) FROM usuarios WHERE rol='admin' AND activo=true");
            if (parseInt(admins.rows[0].count) <= 1)
                return res.json({ success: false, message: 'No se puede eliminar el único administrador' });
        }
        await pool.query('DELETE FROM usuarios WHERE id=$1', [req.params.id]);
        res.json({ success: true });
    } catch (err) {
        res.json({ success: false, error: err.message });
    }
});

// FRONTEND
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'index.html'));
});

// INICIAR SERVIDOR (solo en local, no en Netlify)
const PORT = process.env.PORT || 3001;
app.listen(PORT, () => {
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
