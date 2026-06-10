// v4.5.1 — 2026-06-09
import express    from 'express';
import cors       from 'cors';
import pg         from 'pg';
import bcrypt     from 'bcryptjs';
import multer     from 'multer';
import XLSX       from 'xlsx';
import fs         from 'fs';
import path       from 'path';
import { fileURLToPath } from 'url';
import { createRequire } from 'module';

const require   = createRequire(import.meta.url);
const pdfParse  = require('pdf-parse');

// ─── Entorno ────────────────────────────────────────────────────────────────
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const envFile   = path.join(__dirname, '.env');
if (fs.existsSync(envFile)) {
    fs.readFileSync(envFile, 'utf-8').split('\n').forEach(line => {
        const m = line.match(/^([^=]+)=(.*)$/);
        if (m && m[1].trim()) process.env[m[1].trim()] = m[2]?.trim() ?? '';
    });
}

// ─── DB ─────────────────────────────────────────────────────────────────────
const { Pool } = pg;
// Fallback al pooler IPv4 de Supabase si DATABASE_URL no está configurado o apunta a IPv6 directo
const POOLER_URL = 'postgresql://postgres.lmathqteohlpkefnzjze:Facturas_930@aws-0-sa-east-1.pooler.supabase.com:6543/postgres';
const rawDbUrl = process.env.DATABASE_URL || POOLER_URL;
// Si la URL es la directa (IPv6), forzar el pooler
const dbUrl = (rawDbUrl.includes('db.lmathqteohlpkefnzjze.supabase.co') || rawDbUrl.includes('db.PROJECT'))
    ? POOLER_URL : rawDbUrl;
const pool = new Pool({
    connectionString: dbUrl,
    ssl: { rejectUnauthorized: false },
});

// ─── App ────────────────────────────────────────────────────────────────────
const app    = express();
const upload = multer({ storage: multer.memoryStorage() });

app.use(cors());
app.use(express.json());
app.use(express.static(__dirname));

// ─── Init DB ─────────────────────────────────────────────────────────────────
async function initDB() {
    // Facturas — schema completo desde el inicio
    await pool.query(`
        CREATE TABLE IF NOT EXISTS facturas (
            id            SERIAL PRIMARY KEY,
            folio         TEXT,
            fecha         TEXT,
            proveedor     TEXT,
            rut           TEXT,
            tipo_doc      TEXT DEFAULT 'Factura',
            monto         INTEGER DEFAULT 0,
            estado        TEXT DEFAULT 'pendiente',
            medio_pago    TEXT,
            fecha_pago    TEXT,
            categoria     TEXT,
            pago_grupo_id TEXT,
            created_at    TIMESTAMPTZ DEFAULT NOW()
        )
    `);
    // Columnas que podrían faltar en tablas antiguas
    const colsFacturas = ['rut','tipo_doc','medio_pago','fecha_pago','categoria','pago_grupo_id'];
    for (const c of colsFacturas)
        await pool.query(`ALTER TABLE facturas ADD COLUMN IF NOT EXISTS ${c} TEXT`).catch(() => {});

    // Cheques
    await pool.query(`
        CREATE TABLE IF NOT EXISTS cheques (
            id             SERIAL PRIMARY KEY,
            factura_id     INTEGER REFERENCES facturas(id) ON DELETE CASCADE,
            pago_grupo_id  TEXT,
            numero_cheque  TEXT,
            fecha_cheque   TEXT,
            monto_cheque   INTEGER DEFAULT 0,
            created_at     TIMESTAMPTZ DEFAULT NOW()
        )
    `);
    await pool.query(`ALTER TABLE cheques ADD COLUMN IF NOT EXISTS pago_grupo_id TEXT`).catch(() => {});

    // Productos (inventario)
    await pool.query(`
        CREATE TABLE IF NOT EXISTS productos (
            id            SERIAL PRIMARY KEY,
            folio         TEXT,
            nombre        TEXT,
            cantidad      REAL DEFAULT 0,
            valor         REAL DEFAULT 0,
            unidad        TEXT,
            categoria     TEXT DEFAULT 'Sin categoría',
            proveedor     TEXT,
            rut_proveedor TEXT,
            fecha_factura TEXT,
            created_at    TIMESTAMPTZ DEFAULT NOW()
        )
    `);
    const colsProductos = ['proveedor','rut_proveedor','unidad','categoria','fecha_factura'];
    for (const c of colsProductos)
        await pool.query(`ALTER TABLE productos ADD COLUMN IF NOT EXISTS ${c} TEXT`).catch(() => {});

    // Usuarios
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

    // Seed admin por defecto
    const { rows } = await pool.query('SELECT COUNT(*) FROM usuarios');
    if (parseInt(rows[0].count) === 0) {
        const hash = await bcrypt.hash('admin123', 10);
        await pool.query(
            'INSERT INTO usuarios (nombre, email, password_hash, rol) VALUES ($1,$2,$3,$4)',
            ['Administrador', 'usuario1@empresa.com', hash, 'admin']
        );
        console.log('✅ Admin por defecto creado');
    }
    console.log('✅ Base de datos lista');
}

initDB().catch(err => {
    console.error('❌ Error initDB:', err.message);
    process.exit(1);   // Falla rápido si la DB no está disponible
});

// ═══════════════════════════════════════════════════════════════════════════════
//  HEALTH CHECK
// ═══════════════════════════════════════════════════════════════════════════════
app.get('/api/health', async (_req, res) => {
    try {
        const { rows } = await pool.query('SELECT COUNT(*) as total FROM facturas');
        res.json({ status: 'ok', facturas: parseInt(rows[0].total), timestamp: new Date().toISOString() });
    } catch (e) {
        res.status(500).json({ status: 'error', message: e.message });
    }
});

// ═══════════════════════════════════════════════════════════════════════════════
//  AUTH
// ═══════════════════════════════════════════════════════════════════════════════
app.post('/api/auth/login', async (req, res) => {
    const { email, password } = req.body;
    try {
        const { rows } = await pool.query(
            'SELECT * FROM usuarios WHERE email=$1 AND activo=true',
            [email.toLowerCase().trim()]
        );
        if (!rows.length)
            return res.json({ success: false, message: 'Email o contraseña incorrectos' });
        const ok = await bcrypt.compare(password, rows[0].password_hash);
        if (!ok)
            return res.json({ success: false, message: 'Email o contraseña incorrectos' });
        const u = rows[0];
        res.json({ success: true, token: 'token_' + Date.now(),
            user: { id: u.id, email: u.email, nombre: u.nombre, rol: u.rol } });
    } catch (e) { res.json({ success: false, error: e.message }); }
});

// ═══════════════════════════════════════════════════════════════════════════════
//  FACTURAS
// ═══════════════════════════════════════════════════════════════════════════════

// GET — lista con filtros opcionales
app.get('/api/facturas', async (req, res) => {
    const { estado, proveedor, tipo_doc, fecha_desde, fecha_hasta, rut } = req.query;
    let sql    = 'SELECT * FROM facturas WHERE 1=1';
    const params = [];
    let i = 1;

    // estado 'pagada' está en DB; los demás (pendiente/por_vencer/vencida) son calculados
    // → solo filtramos por estado si es 'pagada' o 'pendiente' (no pagada)
    if (estado === 'pagada')
        { sql += ` AND estado='pagada'`; }
    else if (estado === 'pendiente' || estado === 'por_vencer' || estado === 'vencida')
        { sql += ` AND (estado IS NULL OR estado!='pagada')`; }

    if (proveedor)   { sql += ` AND proveedor  ILIKE $${i++}`; params.push(`%${proveedor}%`); }
    if (tipo_doc)    { sql += ` AND tipo_doc   ILIKE $${i++}`; params.push(`%${tipo_doc}%`); }
    if (rut)         { sql += ` AND rut        ILIKE $${i++}`; params.push(`%${rut}%`); }
    if (fecha_desde) { sql += ` AND fecha      >= $${i++}`;    params.push(fecha_desde); }
    if (fecha_hasta) { sql += ` AND fecha      <= $${i++}`;    params.push(fecha_hasta); }

    sql += ' ORDER BY created_at DESC';

    try {
        const { rows } = await pool.query(sql, params);
        res.json({ success: true, facturas: rows });
    } catch (e) { res.json({ success: false, error: e.message }); }
});

// POST — crear factura individual
app.post('/api/facturas', async (req, res) => {
    const { folio, fecha, proveedor, rut, tipo_doc, monto, estado } = req.body;
    if (!folio || !monto)
        return res.json({ success: false, message: 'Folio y monto son requeridos' });
    try {
        const { rows } = await pool.query(
            'INSERT INTO facturas (folio,fecha,proveedor,rut,tipo_doc,monto,estado) VALUES ($1,$2,$3,$4,$5,$6,$7) RETURNING id',
            [folio, fecha, proveedor, rut||null, tipo_doc||'Factura', monto, estado||'pendiente']
        );
        res.json({ success: true, id: rows[0].id });
    } catch (e) { res.json({ success: false, error: e.message }); }
});

// PUT — actualizar factura (estado, pago, categoría)
app.put('/api/facturas/:id', async (req, res) => {
    const { estado, medio_pago, fecha_pago, categoria } = req.body;
    const sets   = ['estado=$1'];
    const params = [estado];
    let   idx    = 2;

    sets.push(`medio_pago=$${idx++}`);
    params.push(estado === 'pagada' ? (medio_pago || null) : null);

    sets.push(`fecha_pago=$${idx++}`);
    params.push(estado === 'pagada' ? (fecha_pago || null) : null);

    if (categoria !== undefined) { sets.push(`categoria=$${idx++}`); params.push(categoria||null); }

    params.push(req.params.id);
    try {
        await pool.query(`UPDATE facturas SET ${sets.join(',')} WHERE id=$${idx}`, params);
        res.json({ success: true });
    } catch (e) { res.json({ success: false, error: e.message }); }
});

// DELETE — una factura
app.delete('/api/facturas/:id', async (req, res) => {
    try {
        await pool.query('DELETE FROM facturas WHERE id=$1', [req.params.id]);
        res.json({ success: true });
    } catch (e) { res.json({ success: false, error: e.message }); }
});

// DELETE ALL — limpiar tabla (requiere header de confirmación)
app.delete('/api/facturas', async (req, res) => {
    if (req.headers['x-confirm-delete'] !== 'BORRAR-TODO')
        return res.status(403).json({ success: false, message: 'Header de confirmación requerido' });
    try {
        const { rowCount } = await pool.query('DELETE FROM facturas');
        await pool.query('DELETE FROM cheques');
        res.json({ success: true, eliminadas: rowCount });
    } catch (e) { res.json({ success: false, error: e.message }); }
});

// ═══════════════════════════════════════════════════════════════════════════════
//  PAGOS
// ═══════════════════════════════════════════════════════════════════════════════

// POST — registrar pago (individual o agrupado, con cheques opcionales)
app.post('/api/pagos/grupo', async (req, res) => {
    const { factura_ids, medio_pago, fecha_pago, cheques } = req.body;
    if (!factura_ids?.length) return res.json({ success: false, error: 'Selecciona al menos una factura' });
    if (!fecha_pago)          return res.json({ success: false, error: 'Fecha de pago requerida' });

    const grupoId = `G-${Date.now()}-${Math.random().toString(36).slice(2,7)}`;
    try {
        for (const id of factura_ids) {
            await pool.query(
                `UPDATE facturas SET estado='pagada', medio_pago=$1, fecha_pago=$2, pago_grupo_id=$3 WHERE id=$4`,
                [medio_pago || 'transferencia', fecha_pago, grupoId, id]
            );
        }
        if (medio_pago === 'cheque' && cheques?.length) {
            for (const c of cheques) {
                await pool.query(
                    `INSERT INTO cheques (factura_id, pago_grupo_id, numero_cheque, fecha_cheque, monto_cheque)
                     VALUES ($1,$2,$3,$4,$5)`,
                    [factura_ids[0], grupoId, c.numero_cheque||'', c.fecha_cheque||'', c.monto_cheque||0]
                );
            }
        }
        res.json({ success: true, pago_grupo_id: grupoId });
    } catch (e) { res.json({ success: false, error: e.message }); }
});

// GET — pagos registrados con filtros + cheques embebidos
app.get('/api/pagos', async (req, res) => {
    const { proveedor, medio_pago, fecha_desde, fecha_hasta } = req.query;
    let sql    = `SELECT * FROM facturas WHERE estado='pagada'`;
    const params = [];
    let i = 1;

    if (proveedor)   { sql += ` AND proveedor ILIKE $${i++}`;  params.push(`%${proveedor}%`); }
    if (medio_pago)  { sql += ` AND medio_pago = $${i++}`;     params.push(medio_pago); }
    if (fecha_desde) { sql += ` AND fecha_pago >= $${i++}`;    params.push(fecha_desde); }
    if (fecha_hasta) { sql += ` AND fecha_pago <= $${i++}`;    params.push(fecha_hasta); }
    sql += ' ORDER BY fecha_pago DESC, created_at DESC';

    try {
        const { rows: facturas } = await pool.query(sql, params);
        if (!facturas.length) return res.json({ success: true, pagos: [] });

        // Traer cheques de todas las facturas encontradas (por factura_id o pago_grupo_id)
        const ids   = facturas.map(f => f.id);
        const ph1   = ids.map((_,k)       => `$${k+1}`).join(',');
        const ph2   = ids.map((_,k)       => `$${ids.length+k+1}`).join(',');
        const { rows: cheques } = await pool.query(
            `SELECT * FROM cheques
             WHERE factura_id IN (${ph1})
                OR pago_grupo_id IN (
                    SELECT DISTINCT pago_grupo_id FROM facturas
                    WHERE id IN (${ph2}) AND pago_grupo_id IS NOT NULL
                )
             ORDER BY created_at`,
            [...ids, ...ids]
        );

        // Agrupar por pago_grupo_id
        const grupos   = {};
        const sinGrupo = [];
        for (const f of facturas) {
            f.pago_grupo_id
                ? (grupos[f.pago_grupo_id] ??= []).push(f)
                : sinGrupo.push(f);
        }

        const pagos = [];

        for (const [gid, gFacturas] of Object.entries(grupos)) {
            const chequesGrupo = cheques.filter(c => c.pago_grupo_id === gid);
            pagos.push({
                pago_grupo_id:      gid,
                folio:              gFacturas.map(f => f.folio).join(', '),
                proveedor:          [...new Set(gFacturas.map(f => f.proveedor))].join(', '),
                monto:              gFacturas.reduce((s,f) => s+(f.monto||0), 0),
                medio_pago:         gFacturas[0].medio_pago,
                fecha_pago:         gFacturas[0].fecha_pago,
                cheques:            chequesGrupo,
                facturas:           gFacturas.map(f => ({ id:f.id, folio:f.folio, proveedor:f.proveedor, monto:f.monto })),
                es_grupo:           true,
                cantidad_facturas:  gFacturas.length,
            });
        }

        for (const f of sinGrupo) {
            pagos.push({
                ...f,
                cheques:           cheques.filter(c => c.factura_id === f.id && !c.pago_grupo_id),
                es_grupo:          false,
                cantidad_facturas: 1,
            });
        }

        pagos.sort((a,b) => (b.fecha_pago||'').localeCompare(a.fecha_pago||''));
        res.json({ success: true, pagos });
    } catch (e) { res.json({ success: false, error: e.message }); }
});

// ═══════════════════════════════════════════════════════════════════════════════
//  CHEQUES
// ═══════════════════════════════════════════════════════════════════════════════

// GET — reporte flujo de cheques (para módulo reportes)
app.get('/api/cheques/reporte/flujo', async (_req, res) => {
    try {
        const { rows } = await pool.query(`
            SELECT ch.id, ch.numero_cheque, ch.fecha_cheque, ch.monto_cheque,
                   ch.pago_grupo_id, f.proveedor, f.rut, f.id AS factura_id, f.folio
            FROM cheques ch
            LEFT JOIN facturas f ON ch.factura_id = f.id
            WHERE ch.numero_cheque IS NOT NULL AND ch.numero_cheque != ''
            ORDER BY ch.fecha_cheque ASC, ch.numero_cheque ASC
        `);
        const hoy = new Date();
        const cheques = rows.map(c => {
            let estado = 'pendiente', dias = 0;
            if (c.fecha_cheque) {
                dias   = Math.floor((new Date(c.fecha_cheque+'T00:00:00') - hoy) / 86400000);
                estado = dias < 0 ? 'vencida' : dias <= 5 ? 'por_vencer' : 'pendiente';
            }
            return { ...c, estado, dias };
        });
        res.json({ success: true, cheques });
    } catch (e) { res.json({ success: false, error: e.message }); }
});

// GET — cheques de una factura específica
app.get('/api/cheques/:facturaId', async (req, res) => {
    try {
        const { rows } = await pool.query(
            'SELECT * FROM cheques WHERE factura_id=$1 ORDER BY created_at',
            [req.params.facturaId]
        );
        res.json({ success: true, cheques: rows });
    } catch (e) { res.json({ success: false, error: e.message }); }
});

// ═══════════════════════════════════════════════════════════════════════════════
//  EXCEL IMPORT
// ═══════════════════════════════════════════════════════════════════════════════

function norm(s) {
    return String(s).normalize('NFD').replace(/[̀-ͯ]/g,'')
                    .toLowerCase().replace(/\s+/g,' ').trim();
}
function getCol(row, ...keys) {
    for (const k of keys) {
        const v = row[k];
        if (v !== undefined && v !== null && String(v).trim() !== '') return v;
    }
    const normKeys = keys.map(norm);
    for (const rk of Object.keys(row)) {
        if (normKeys.includes(norm(rk))) return row[rk];
    }
    return undefined;
}

app.post('/api/upload/excel', upload.single('file'), async (req, res) => {
    if (!req.file) return res.json({ success: false, error: 'No se recibió archivo' });
    try {
        const tipoDocFormulario = req.body.tipo_doc || '';
        const wb   = XLSX.read(req.file.buffer, { type: 'buffer' });
        const data = XLSX.utils.sheet_to_json(wb.Sheets[wb.SheetNames[0]]);

        const filas = data.map(row => {
            const fechaRaw = getCol(row,'F. Emision','F. Emisión','F.Emision','F.Emisión',
                                        'Fecha Emision','Fecha Emisión','fecha_emision') || '';
            let fecha = fechaRaw;
            if (typeof fecha === 'number')
                fecha = new Date((fecha-25569)*86400*1000).toISOString().split('T')[0];
            else
                fecha = String(fecha).split(' ')[0].trim();

            const tipoDocExcel = String(getCol(row,'Tipo Doc','Tipo Doc.','tipo_doc','Tipo') || '').trim();
            return {
                tipo_doc:  tipoDocFormulario || tipoDocExcel || 'Factura',
                folio:     String(getCol(row,'Folio','folio','FOLIO','N° Folio') || '').trim(),
                fecha,
                proveedor: String(getCol(row,'Nombre','nombre','NOMBRE','Razón Social','Razon Social') || '').trim(),
                rut:       String(getCol(row,'Rut','RUT','rut','R.U.T.') || '').trim(),
                monto:     parseInt(String(getCol(row,'Total','total','TOTAL','Monto') || 0).replace(/[^0-9]/g,'')) || 0,
            };
        }).filter(f => f.folio && f.monto > 0);

        const { rows: exist } = await pool.query('SELECT folio FROM facturas');
        const foliosExist     = new Set(exist.map(r => r.folio));

        let insertadas = 0, omitidas = 0, actualizadas = 0;
        for (const f of filas) {
            if (foliosExist.has(f.folio)) {
                // Completar campos vacíos en registro existente
                const sets = []; const prms = []; let pi = 1;
                if (f.rut)       { sets.push(`rut=$${pi++}`);       prms.push(f.rut); }
                if (f.tipo_doc)  { sets.push(`tipo_doc=$${pi++}`);  prms.push(f.tipo_doc); }
                if (f.proveedor) { sets.push(`proveedor=$${pi++}`); prms.push(f.proveedor); }
                if (f.fecha)     { sets.push(`fecha=$${pi++}`);     prms.push(f.fecha); }
                if (sets.length) {
                    prms.push(f.folio);
                    const cond = sets.map((s,k) => {
                        const col = s.split('=')[0];
                        return `(${col} IS NULL OR ${col}='')`;
                    }).join(' OR ');
                    const { rowCount } = await pool.query(
                        `UPDATE facturas SET ${sets.join(',')} WHERE folio=$${pi} AND (${cond})`,
                        prms
                    ).catch(() => ({ rowCount:0 }));
                    if (rowCount > 0) actualizadas++;
                }
                omitidas++;
            } else {
                await pool.query(
                    'INSERT INTO facturas (folio,fecha,proveedor,rut,tipo_doc,monto,estado) VALUES ($1,$2,$3,$4,$5,$6,$7)',
                    [f.folio, f.fecha, f.proveedor, f.rut||null, f.tipo_doc, f.monto, 'pendiente']
                ).catch(() => { omitidas++; return null; });
                foliosExist.add(f.folio);
                insertadas++;
            }
        }

        const partes = [
            insertadas   > 0 ? `${insertadas} importadas`          : '',
            actualizadas > 0 ? `${actualizadas} RUTs actualizados` : '',
            (omitidas - actualizadas) > 0
                ? `${omitidas - actualizadas} sin cambios` : '',
        ].filter(Boolean);

        res.json({ success: true, insertadas, omitidas, actualizadas,
                   total: filas.length, message: partes.join(' · ') || 'Sin cambios' });
    } catch (e) { res.json({ success: false, error: e.message }); }
});

// ═══════════════════════════════════════════════════════════════════════════════
//  DOCUMENTOS MANUAL
// ═══════════════════════════════════════════════════════════════════════════════
app.post('/api/documentos/crear-manual', async (req, res) => {
    const { documentos } = req.body;
    if (!Array.isArray(documentos) || !documentos.length)
        return res.json({ success: false, error: 'No hay documentos para crear' });

    try {
        const { rows } = await pool.query('SELECT folio FROM facturas');
        const foliosExist = new Set(rows.map(r => r.folio));

        let creados = 0, omitidos = 0;
        for (const doc of documentos) {
            if (!doc.folio || !doc.fecha_factura || !doc.nombre_proveedor || !doc.monto)
                { omitidos++; continue; }
            if (foliosExist.has(doc.folio))
                { omitidos++; continue; }
            await pool.query(
                'INSERT INTO facturas (folio,fecha,proveedor,tipo_doc,monto,estado) VALUES ($1,$2,$3,$4,$5,$6)',
                [doc.folio, doc.fecha_factura, doc.nombre_proveedor,
                 doc.tipo_doc||'Factura', parseInt(doc.monto)||0, 'pendiente']
            ).catch(() => { omitidos++; });
            foliosExist.add(doc.folio);
            creados++;
        }
        res.json({ success: true, documentos_creados: creados, documentos_omitidos: omitidos,
                   message: `${creados} documento${creados!==1?'s':''} creado${creados!==1?'s':''}` });
    } catch (e) { res.json({ success: false, error: e.message }); }
});

// ═══════════════════════════════════════════════════════════════════════════════
//  INVENTARIO / PDF
// ═══════════════════════════════════════════════════════════════════════════════
function categorizarProducto(n) {
    n = n.toLowerCase();
    if (/ostra|salmón|salmon|merluza|mariscos?|calamar|camarón|camaron|congrio|atun|atún|pescado|pulpo|jaiba|centolla|erizo|cholga|almeja|navajuela|reineta|lenguado|trucha/.test(n))
        return 'Pescados y Mariscos';
    if (/cerveza|vino|bebida|jugo|agua|pisco|ron|vodka|whisky|espumante|refresco|licor/.test(n))
        return 'Líquidos';
    if (/congelad|frozen/.test(n)) return 'Congelados';
    if (/tomate|lechuga|cebolla|papa|zanahoria|manzana|palta|limón|limon|naranja|pera|uva|fruta|verdura|vegetal|brocoli|espinaca|pepino|ajo|pimiento/.test(n))
        return 'Frutas y Verduras';
    if (/cloro|detergente|esponja|escoba|limpiador|jabón|jabon|desinfect|papel higién/.test(n))
        return 'Aseo';
    if (/servicio|mantención|manten|arriendo|instalación|instalacion|reparación|reparacion|asesoría/.test(n))
        return 'Servicios';
    return 'Abarrotes';
}

function parsearTextoPDF(text) {
    const full = text.split('\n').map(l=>l.trim()).filter(Boolean).join(' ');

    const provMatch = full.match(/^([A-ZÁÉÍÓÚÑ][A-ZÁÉÍÓÚÑ\s\.,]{4,80}?)\s{2,}/);
    const proveedor = provMatch ? provMatch[1].trim() : full.substring(0,60).trim();

    const rutMatch      = full.match(/R\.?U\.?T\.?\s*[:\s]*(\d{7,8}-[\dkK])/i);
    const folioMatch    = full.match(/N[°º]\s*([\d\.]+)/i);
    const fechaMatch    = full.match(/(\d{1,2})\s+de\s+(\w+)\s+de\s+(\d{4})/i);
    const montoMatch    = full.match(/Monto Total\s+\$\s*([\d.,]+)/i);

    let fecha = '';
    if (fechaMatch) {
        const meses = {enero:'01',febrero:'02',marzo:'03',abril:'04',mayo:'05',junio:'06',
                       julio:'07',agosto:'08',septiembre:'09',octubre:'10',noviembre:'11',diciembre:'12'};
        const mes = meses[fechaMatch[2].toLowerCase()] || '01';
        fecha = `${fechaMatch[3]}-${mes}-${fechaMatch[1].padStart(2,'0')}`;
    }

    const items = [];
    const bloque = full.match(/CODIGO\s+CANTIDAD\s+DETALLE\s+UNIDAD\s+P\.\s*UNITARIO\s+TOTAL(.+?)(?:REFERENCIAS|Sub-Total)/is);
    if (bloque) {
        const re = /([\d.,]+)\s+([A-ZÁÉÍÓÚÑ][^$]+?)\s+(UNID|KG|LT|UN|MT|CAJA|BOLSA|SACO|DOC|PAQ)\s+\$\s*([\d.,]+)\s+\$\s*([\d.,]+)/gi;
        let m;
        while ((m = re.exec(bloque[1])) !== null) {
            const n = m[2].trim();
            items.push({
                nombre:         n,
                cantidad:       parseFloat(m[1].replace(/\./g,'').replace(',','.')),
                unidad:         m[3],
                valor_unitario: parseFloat(m[4].replace(/\./g,'').replace(',','.')),
                total:          parseFloat(m[5].replace(/\./g,'').replace(',','.')),
                categoria:      categorizarProducto(n),
            });
        }
    }

    return {
        proveedor,
        rut_proveedor: rutMatch?.[1] || '',
        folio:         folioMatch?.[1].replace(/\./g,'') || '',
        fecha,
        items,
        monto_total: montoMatch ? parseFloat(montoMatch[1].replace(/\./g,'').replace(',','.')) : 0,
    };
}

app.post('/api/inventario/parsear-pdf', upload.single('pdf'), async (req, res) => {
    if (!req.file) return res.json({ success: false, error: 'No se recibió PDF' });
    try {
        const { text } = await pdfParse(req.file.buffer);
        res.json({ success: true, ...parsearTextoPDF(text), texto_raw: text });
    } catch (e) { res.json({ success: false, error: e.message }); }
});

app.post('/api/inventario/guardar-items', async (req, res) => {
    const { items } = req.body;
    if (!items?.length) return res.json({ success: false, error: 'Sin ítems' });
    try {
        let insertados = 0;
        for (const it of items) {
            await pool.query(
                `INSERT INTO productos (folio,nombre,cantidad,valor,proveedor,rut_proveedor,unidad,categoria,fecha_factura)
                 VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)`,
                [it.folio, it.nombre, it.cantidad, it.valor_unitario,
                 it.proveedor, it.rut_proveedor, it.unidad, it.categoria, it.fecha_factura]
            );
            insertados++;
        }
        res.json({ success: true, insertados });
    } catch (e) { res.json({ success: false, error: e.message }); }
});

// ═══════════════════════════════════════════════════════════════════════════════
//  PRODUCTOS
// ═══════════════════════════════════════════════════════════════════════════════
app.get('/api/productos', async (_req, res) => {
    try {
        const { rows } = await pool.query('SELECT * FROM productos ORDER BY created_at DESC');
        res.json({ success: true, productos: rows });
    } catch (e) { res.json({ success: false, error: e.message }); }
});

app.delete('/api/productos/:id', async (req, res) => {
    try {
        await pool.query('DELETE FROM productos WHERE id=$1', [req.params.id]);
        res.json({ success: true });
    } catch (e) { res.json({ success: false, error: e.message }); }
});

// ═══════════════════════════════════════════════════════════════════════════════
//  USUARIOS
// ═══════════════════════════════════════════════════════════════════════════════
app.get('/api/usuarios', async (_req, res) => {
    try {
        const { rows } = await pool.query(
            'SELECT id,nombre,email,rol,activo,created_at FROM usuarios ORDER BY created_at'
        );
        res.json({ success: true, usuarios: rows });
    } catch (e) { res.json({ success: false, error: e.message }); }
});

app.post('/api/usuarios', async (req, res) => {
    const { nombre, email, password, rol } = req.body;
    if (!nombre || !email || !password)
        return res.json({ success: false, message: 'Nombre, email y contraseña requeridos' });
    try {
        const hash = await bcrypt.hash(password, 10);
        const { rows } = await pool.query(
            'INSERT INTO usuarios (nombre,email,password_hash,rol) VALUES ($1,$2,$3,$4) RETURNING id',
            [nombre, email.toLowerCase().trim(), hash, rol||'usuario']
        );
        res.json({ success: true, id: rows[0].id });
    } catch (e) {
        if (e.code === '23505') return res.json({ success: false, message: 'Email ya existe' });
        res.json({ success: false, error: e.message });
    }
});

app.delete('/api/usuarios/:id', async (req, res) => {
    try {
        const { rows } = await pool.query('SELECT rol FROM usuarios WHERE id=$1', [req.params.id]);
        if (!rows.length) return res.json({ success: false, message: 'Usuario no encontrado' });
        if (rows[0].rol === 'admin') {
            const { rows: admins } = await pool.query(
                "SELECT COUNT(*) FROM usuarios WHERE rol='admin' AND activo=true"
            );
            if (parseInt(admins[0].count) <= 1)
                return res.json({ success: false, message: 'No se puede eliminar el único admin' });
        }
        await pool.query('DELETE FROM usuarios WHERE id=$1', [req.params.id]);
        res.json({ success: true });
    } catch (e) { res.json({ success: false, error: e.message }); }
});

// ─── Start ───────────────────────────────────────────────────────────────────
const PORT = process.env.PORT || 3001;
app.listen(PORT, () => console.log(`
╔════════════════════════════════════════╗
║   ✅ Facturas Cloud v4.5              ║
║   🚀 Puerto ${PORT}                      ║
║   📊 Excel Import  : ✅               ║
║   💳 Pagos/Cheques : ✅               ║
║   📦 Inventario PDF: ✅               ║
║   🔍 Health Check  : /api/health      ║
╚════════════════════════════════════════╝
`));

export default app;
