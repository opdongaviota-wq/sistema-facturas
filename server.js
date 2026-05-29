import express from 'express';
import cors from 'cors';
import pg from 'pg';
import bcrypt from 'bcryptjs';
import multer from 'multer';
import XLSX from 'xlsx';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { getDocument } from 'pdfjs-dist/legacy/build/pdf.mjs';

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
            id              SERIAL PRIMARY KEY,
            folio           TEXT,
            nombre          TEXT,
            cantidad        REAL,
            valor           REAL,
            proveedor       TEXT,
            rut_proveedor   TEXT,
            unidad          TEXT,
            categoria       TEXT DEFAULT 'Sin categoría',
            fecha_factura   TEXT,
            created_at      TIMESTAMPTZ DEFAULT NOW()
        )
    `);
    // Migrar columnas si la tabla ya existía sin ellas
    const cols = ['proveedor','rut_proveedor','unidad','categoria','fecha_factura'];
    for (const col of cols) {
        await pool.query(`ALTER TABLE productos ADD COLUMN IF NOT EXISTS ${col} TEXT`).catch(()=>{});
    }

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
        `ALTER TABLE facturas ADD COLUMN IF NOT EXISTS tipo_doc TEXT`,
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
    const { folio, fecha, proveedor, rut, tipo_doc, monto, estado } = req.body;
    if (!folio || !monto) {
        return res.json({ success: false, message: 'Folio y monto son requeridos' });
    }
    try {
        const result = await pool.query(
            'INSERT INTO facturas (folio, fecha, proveedor, rut, tipo_doc, monto, estado) VALUES ($1,$2,$3,$4,$5,$6,$7) RETURNING id',
            [folio, fecha, proveedor, rut || null, tipo_doc || null, monto, estado || 'pendiente']
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

// ========== PARSEAR PDF FACTURA ==========
function categorizarProducto(nombre) {
    const n = nombre.toLowerCase();
    if (/ostra|salmón|salmon|merluza|mariscos?|calamar|camarón|camaron|congrio|atun|atún|pescado|pulpo|jaiba|centolla|erizo|cholga|almeja|navajuela|reineta|lenguado|trucha/.test(n)) return 'Pescados y Mariscos';
    if (/cerveza|vino|bebida|jugo|agua|pisco|ron|vodka|whisky|champagne|espumante|refresco|licor|cóctel|coctel/.test(n)) return 'Líquidos';
    if (/congelad|frozen/.test(n)) return 'Congelados';
    if (/tomate|lechuga|cebolla|papa|zanahoria|manzana|palta|limón|limon|naranja|pera|uva|berr|fruta|verdura|vegetal|brocoli|espinaca|pepino|ajo|pimiento|coliflor/.test(n)) return 'Frutas y Verduras';
    if (/cloro|detergente|esponja|escoba|trapo|limpiador|jabón|jabon|desinfect|papel higiénico|papel higienico|servilleta|toalla|basura|bolsa/.test(n)) return 'Aseo';
    if (/servicio|mantención|manten|arriendo|instalación|instalacion|reparación|reparacion|asesoría|asesoria|consultora|mano de obra/.test(n)) return 'Servicios';
    return 'Abarrotes';
}

function parsearTextoPDF(text) {
    const lines = text.split(/\n/).map(l => l.trim()).filter(Boolean);
    const fullText = lines.join(' ');

    // Extraer proveedor: primera cadena de MAYÚSCULAS antes de doble espacio o giro/dirección
    const provMatch = fullText.match(/^([A-ZÁÉÍÓÚÑ][A-ZÁÉÍÓÚÑ\s\.\,]{4,80}?)\s{2,}/);
    const proveedor = provMatch ? provMatch[1].trim() : fullText.substring(0, 60).trim();

    // RUT proveedor
    const rutMatch = fullText.match(/R\.?U\.?T\.?\s*[:\s]*(\d{7,8}-[\dkK])/i);
    const rutProveedor = rutMatch ? rutMatch[1] : '';

    // Folio
    const folioMatch = fullText.match(/N[°º]\s*([\d\.]+)/i);
    const folio = folioMatch ? folioMatch[1].replace(/\./g, '') : '';

    // Fecha
    const fechaMatch = fullText.match(/(\d{1,2})\s+de\s+(\w+)\s+de\s+(\d{4})/i);
    let fecha = '';
    if (fechaMatch) {
        const meses = {enero:'01',febrero:'02',marzo:'03',abril:'04',mayo:'05',junio:'06',julio:'07',agosto:'08',septiembre:'09',octubre:'10',noviembre:'11',diciembre:'12'};
        const mes = meses[fechaMatch[2].toLowerCase()] || '01';
        fecha = `${fechaMatch[3]}-${mes}-${fechaMatch[1].padStart(2,'0')}`;
    }

    // Ítems: buscar el bloque entre "DETALLE" y "REFERENCIAS"/"Sub-Total"
    const itemsRaw = [];
    const detBloque = fullText.match(/CODIGO\s+CANTIDAD\s+DETALLE\s+UNIDAD\s+P\.\s*UNITARIO\s+TOTAL(.+?)(?:REFERENCIAS|Sub-Total)/is);
    if (detBloque) {
        const bloque = detBloque[1];
        // Patrón: (cantidad) (descripción) (unidad) $ precio $ total
        const lineaRegex = /([\d.,]+)\s+([A-ZÁÉÍÓÚÑ][^$]+?)\s+(UNID|KG|LT|UN|MT|CAJA|BOLSA|SACO|DOC|PAQ)\s+\$\s*([\d.,]+)\s+\$\s*([\d.,]+)/gi;
        let m;
        while ((m = lineaRegex.exec(bloque)) !== null) {
            const cant = parseFloat(m[1].replace(/\./g,'').replace(',','.'));
            const nombre = m[2].trim();
            const unidad = m[3].trim();
            const valorUnit = parseFloat(m[4].replace(/\./g,'').replace(',','.'));
            const total = parseFloat(m[5].replace(/\./g,'').replace(',','.'));
            itemsRaw.push({ nombre, cantidad: cant, unidad, valor_unitario: valorUnit, total, categoria: categorizarProducto(nombre) });
        }
        // Fallback: líneas sin unidad explícita
        if (!itemsRaw.length) {
            const fallback = /([\d.,]+)\s+([A-ZÁÉÍÓÚÑ][^$]+?)\s+\$\s*([\d.,]+)\s+\$\s*([\d.,]+)/gi;
            let fm;
            while ((fm = fallback.exec(bloque)) !== null) {
                const cant = parseFloat(fm[1].replace(/\./g,'').replace(',','.'));
                const nombre = fm[2].trim();
                const valorUnit = parseFloat(fm[3].replace(/\./g,'').replace(',','.'));
                itemsRaw.push({ nombre, cantidad: cant, unidad: 'UNID', valor_unitario: valorUnit, total: parseFloat(fm[4].replace(/\./g,'').replace(',','.')), categoria: categorizarProducto(nombre) });
            }
        }
    }

    // Monto total
    const montoMatch = fullText.match(/Monto Total\s+\$\s*([\d.,]+)/i);
    const montoTotal = montoMatch ? parseFloat(montoMatch[1].replace(/\./g,'').replace(',','.')) : 0;

    return { proveedor, rut_proveedor: rutProveedor, folio, fecha, items: itemsRaw, monto_total: montoTotal };
}

app.post('/api/inventario/parsear-pdf', upload.single('pdf'), async (req, res) => {
    try {
        if (!req.file) return res.json({ success: false, error: 'No se recibió archivo PDF' });
        const data = new Uint8Array(req.file.buffer);
        const pdfDoc = await getDocument({ data }).promise;
        let text = '';
        for (let i = 1; i <= pdfDoc.numPages; i++) {
            const page = await pdfDoc.getPage(i);
            const content = await page.getTextContent();
            text += content.items.map(x => x.str).join(' ') + '\n';
        }
        const resultado = parsearTextoPDF(text);
        res.json({ success: true, ...resultado, texto_raw: text });
    } catch (err) {
        res.json({ success: false, error: err.message });
    }
});

// GUARDAR ITEMS DE INVENTARIO DESDE PDF
app.post('/api/inventario/guardar-items', async (req, res) => {
    const { items } = req.body;
    try {
        let insertados = 0;
        for (const item of items) {
            await pool.query(
                `INSERT INTO productos (folio, nombre, cantidad, valor, proveedor, rut_proveedor, unidad, categoria, fecha_factura)
                 VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)`,
                [item.folio, item.nombre, item.cantidad, item.valor_unitario, item.proveedor, item.rut_proveedor, item.unidad, item.categoria, item.fecha_factura]
            );
            insertados++;
        }
        res.json({ success: true, insertados });
    } catch (err) {
        res.json({ success: false, error: err.message });
    }
});

// DELETE PRODUCTO
app.delete('/api/productos/:id', async (req, res) => {
    try {
        await pool.query('DELETE FROM productos WHERE id=$1', [req.params.id]);
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

// Búsqueda flexible de columna en una fila de Excel
// Ignora mayúsculas/minúsculas, tildes, espacios extra y no-breaking spaces
function getCol(row, ...keys) {
    // 1) Match exacto
    for (const k of keys) {
        const v = row[k];
        if (v !== undefined && v !== null && String(v).trim() !== '') return v;
    }
    // 2) Match normalizado (sin tildes, todo minúscula, espacios simples)
    const norm = s => s.normalize('NFD').replace(/[̀-ͯ]/g, '')
                        .toLowerCase().replace(/[ \s]+/g, ' ').trim();
    const normKeys = keys.map(norm);
    for (const rowKey of Object.keys(row)) {
        if (normKeys.includes(norm(rowKey))) return row[rowKey];
    }
    return undefined;
}

// UPLOAD EXCEL
app.post('/api/upload/excel', upload.single('file'), async (req, res) => {
    try {
        const workbook = XLSX.read(req.file.buffer || fs.readFileSync(req.file.path), { type: 'buffer' });
        const worksheet = workbook.Sheets[workbook.SheetNames[0]];
        const data = XLSX.utils.sheet_to_json(worksheet);

        const facturas = data.map(row => {
            // Fecha de emisión — acepta variantes con/sin tilde, con/sin espacio
            const fechaRaw = getCol(row,
                'F. Emision', 'F. Emisión', 'F.Emision', 'F.Emisión',
                'Fecha Emision', 'Fecha Emisión', 'fecha_emision', 'FechaEmision'
            ) || '';
            let fecha = fechaRaw;
            if (typeof fecha === 'number') {
                const d = new Date((fecha - 25569) * 86400 * 1000);
                fecha = d.toISOString().split('T')[0];
            } else {
                fecha = String(fecha).split(' ')[0];
            }
            // RUT — acepta variantes de capitalización
            const rut = String(getCol(row,
                'Rut', 'RUT', 'rut', 'R.U.T.', 'R.U.T',
                'Rut Proveedor', 'RUT Proveedor'
            ) || '').trim();
            return {
                tipo_doc:  String(getCol(row, 'Tipo Doc', 'Tipo Doc.', 'tipo_doc', 'TipoDoc', 'Tipo de Documento', 'Tipo') || '').trim(),
                folio:     String(getCol(row, 'Folio', 'folio', 'FOLIO', 'N° Folio', 'Nro. Folio') || '').trim(),
                fecha:     fecha.trim(),
                proveedor: String(getCol(row, 'Nombre', 'nombre', 'NOMBRE', 'Razón Social', 'Razon Social') || '').trim(),
                rut:       rut,
                monto:     parseInt(String(getCol(row, 'Total', 'total', 'TOTAL', 'Monto', 'Monto Total') || 0).replace(/[^0-9]/g, '')) || 0,
            };
        }).filter(f => f.folio && f.monto > 0);

        // Obtener folios existentes para evitar duplicados (conserva datos anteriores)
        const existingResult = await pool.query('SELECT folio FROM facturas');
        const existingFolios = new Set(existingResult.rows.map(r => r.folio));

        let insertadas = 0, omitidas = 0, rutActualizadas = 0;
        for (const f of facturas) {
            if (existingFolios.has(f.folio)) {
                // Folio ya existe: completar campos vacíos (rut, proveedor, fecha)
                const setClauses = [];
                const params     = [];
                let   pi         = 1;
                if (f.rut)       { setClauses.push(`rut=$${pi++}`);       params.push(f.rut); }
                if (f.tipo_doc)  { setClauses.push(`tipo_doc=$${pi++}`);  params.push(f.tipo_doc); }
                if (f.proveedor) { setClauses.push(`proveedor=$${pi++}`); params.push(f.proveedor); }
                if (f.fecha)     { setClauses.push(`fecha=$${pi++}`);     params.push(f.fecha); }
                if (setClauses.length) {
                    params.push(f.folio);
                    // Solo actualiza si el campo correspondiente está vacío
                    const whereRut  = f.rut       ? "(rut IS NULL OR rut='')"              : null;
                    const whereTipo = f.tipo_doc  ? "(tipo_doc IS NULL OR tipo_doc='')"    : null;
                    const whereProv = f.proveedor ? "(proveedor IS NULL OR proveedor='')"  : null;
                    const whereFech = f.fecha     ? "(fecha IS NULL OR fecha='')"          : null;
                    const whereCond = [whereRut, whereTipo, whereProv, whereFech].filter(Boolean).join(' OR ');
                    const upd = await pool.query(
                        `UPDATE facturas SET ${setClauses.join(',')} WHERE folio=$${pi} AND (${whereCond})`,
                        params
                    ).catch(() => ({ rowCount: 0 }));
                    if (upd.rowCount > 0) rutActualizadas++;
                }
                omitidas++;
                continue;
            }
            try {
                await pool.query(
                    'INSERT INTO facturas (folio, fecha, proveedor, rut, tipo_doc, monto, estado) VALUES ($1,$2,$3,$4,$5,$6,$7)',
                    [f.folio, f.fecha, f.proveedor, f.rut || null, f.tipo_doc || null, f.monto, 'pendiente']
                );
                existingFolios.add(f.folio); // evita duplicados dentro del mismo archivo
                insertadas++;
            } catch (e) { omitidas++; }
        }

        if (req.file.path) fs.unlinkSync(req.file.path);
        const partes = [
            insertadas > 0          ? `${insertadas} nuevas importadas`              : '',
            rutActualizadas > 0     ? `${rutActualizadas} RUTs actualizados`         : '',
            omitidas - rutActualizadas > 0 ? `${omitidas - rutActualizadas} sin cambios` : '',
        ].filter(Boolean);
        res.json({
            success: true,
            insertadas,
            omitidas,
            rutActualizadas,
            total: facturas.length,
            message: partes.length ? partes.join(' · ') : 'Sin cambios'
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
