/**
 * UTE Escobedo – API Backend Segura (Node.js + Express)
 * ══════════════════════════════════════════════════════
 * Este archivo conecta el frontend con la base de datos de
 * forma segura en producción.
 *
 * Para usar en producción:
 *   npm install express mysql2 bcrypt jsonwebtoken helmet cors express-rate-limit dotenv
 */

'use strict';
require('dotenv').config();
if (!process.env.NODE_ENV) process.env.NODE_ENV = 'production';       // Variables de entorno (NUNCA hardcodear credenciales)

const express    = require('express');
const mysql      = require('mysql2/promise');
const bcrypt     = require('bcrypt');
const jwt        = require('jsonwebtoken');
const helmet     = require('helmet');
const cors       = require('cors');
const rateLimit  = require('express-rate-limit');

const app = express();
app.set("trust proxy", 1);

/* ──────────────────────────────────────────────────
   MIDDLEWARES DE SEGURIDAD
────────────────────────────────────────────────── */
app.use(helmet());                           // Headers HTTP seguros
app.use(express.json({ limit: '50kb' }));   // Limitar tamaño de body

// Logger simple: muestra cada petición entrante en consola
app.use((req, res, next) => {
  console.log(`📥 ${new Date().toLocaleTimeString()} - ${req.method} ${req.originalUrl}`);
  next();
});
app.use(cors({
  origin: process.env.ALLOWED_ORIGIN || 'http://127.0.0.1:5500',
  methods: ['GET','POST','PUT','PATCH','DELETE'],
  allowedHeaders: ['Content-Type','Authorization']
}));

// Rate limiting general (100 req/15min por IP)
app.use(rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 100,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Demasiadas solicitudes. Intenta más tarde.' }
}));

// Rate limiting estricto para login (5 intentos/15min)
const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 5,
  message: { error: 'Demasiados intentos de inicio de sesión. Espera 15 minutos.' }
});

/* ──────────────────────────────────────────────────
   CONEXIÓN A BD (pool con credenciales de .env)
────────────────────────────────────────────────── */
const pool = mysql.createPool({
  host:             process.env.DB_HOST     || 'localhost',
  user:             process.env.DB_USER     || 'ute_app',   // Usuario con mínimos privilegios
  password:         process.env.DB_PASSWORD,                // Desde .env
  database:         process.env.DB_NAME     || 'ute_mapa',
  waitForConnections: true,
  connectionLimit:  10,
  charset:          'utf8mb4'
});

/* ──────────────────────────────────────────────────
   MIDDLEWARE DE AUTENTICACIÓN JWT
────────────────────────────────────────────────── */
const crypto = require('crypto');

async function autenticar(req, res, next) {
  try {
    const header = req.headers.authorization;
    if (!header?.startsWith('Bearer ')) return res.status(401).json({ error: 'Token requerido' });
    const token = header.slice(7);
    try {
      req.user = jwt.verify(token, process.env.JWT_SECRET);
    } catch {
      return res.status(401).json({ error: 'Token inválido o expirado' });
    }
    const tokenHash = crypto.createHash('sha256').update(token).digest('hex');
    const [rows] = await pool.execute(
      'SELECT id FROM sesiones WHERE id=? AND revocada=0 AND expira_en>NOW()', [tokenHash]
    );
    if (!rows.length) return res.status(401).json({ error: 'Sesión revocada o expirada' });
    next();
  } catch {
    res.status(500).json({ error: 'Error al validar sesión' });
  }
}

// Middleware de rol admin
function soloAdmin(req, res, next) {
  if (req.user?.rol !== 'admin') return res.status(403).json({ error: 'Acceso denegado' });
  next();
}

// Sanitizar inputs (evitar XSS e inyección)
function sanitize(str) {
  if (typeof str !== 'string') return str;
  return str.replace(/[<>"'`]/g, '').trim().slice(0, 500);
}

/* ──────────────────────────────────────────────────
   AUTH – LOGIN
────────────────────────────────────────────────── */
app.post('/api/auth/login', loginLimiter, async (req, res) => {
  const { email, password } = req.body;
  const ip = req.ip;

  if (!email || !password)
    return res.status(400).json({ error: 'Email y contraseña requeridos' });

  // Usar una sola conexión para evitar race condition con @bloqueado
  const conn = await pool.getConnection();
  try {
    // Verificar rate-limit en BD (procedimiento almacenado)
    await conn.execute('CALL sp_verificar_intentos_login(?, ?, @bloqueado)', [email, ip]);
    const [[bloqueadoRow]] = await conn.execute('SELECT @bloqueado AS bloqueado');
    if (bloqueadoRow?.bloqueado) {
      conn.release();
      return res.status(429).json({ error: 'Cuenta bloqueada temporalmente por múltiples intentos fallidos' });
    }

    // Buscar usuario (query parametrizada – inmune a SQL Injection)
    const [[user]] = await conn.execute(
      'SELECT u.id, u.nombre, u.email, u.password_hash, r.nombre AS rol, u.avatar FROM usuarios u JOIN roles r ON u.rol_id=r.id WHERE u.email=? AND u.activo=1',
      [email]
    );

    const hashToCheck = user ? user.password_hash : '$2b$12$00000000000000000000000000000000000000000000000000000';
    const exitoso = await bcrypt.compare(password, hashToCheck) && !!user;

    // Registrar intento
    await conn.execute(
      'INSERT INTO login_intentos (email, ip_origen, exitoso) VALUES (?,?,?)',
      [email, ip, exitoso ? 1 : 0]
    );

    if (!exitoso) { conn.release(); return res.status(401).json({ error: 'Credenciales incorrectas' }); }

    // Generar JWT con expiración corta
    const token = jwt.sign(
      { id: user.id, nombre: user.nombre, rol: user.rol, avatar: user.avatar },
      process.env.JWT_SECRET,
      { expiresIn: '8h' }
    );

    // Guardar sesión en BD
    const tokenHash = crypto.createHash('sha256').update(token).digest('hex');
    await conn.execute(
      'INSERT INTO sesiones (id, usuario_id, ip_origen, expira_en) VALUES (?,?,?, DATE_ADD(NOW(), INTERVAL 8 HOUR))',
      [tokenHash, user.id, ip]
    );

    // Actualizar último login
    await conn.execute('UPDATE usuarios SET ultimo_login=NOW() WHERE id=?', [user.id]);

    conn.release();
    res.json({ token, nombre: user.nombre, rol: user.rol, avatar: user.avatar });
  } catch (err) {
    console.error(err);
    try { conn.release(); } catch (_) {}
    res.status(500).json({ error: 'Error interno del servidor' });
  }
});

/* ──────────────────────────────────────────────────
   LOGOUT – Revocar sesión
────────────────────────────────────────────────── */
app.post('/api/auth/logout', autenticar, async (req, res) => {
  const header = req.headers.authorization;
  const token  = header.slice(7);
  const hash   = crypto.createHash('sha256').update(token).digest('hex');
  await pool.execute('UPDATE sesiones SET revocada=1 WHERE id=?', [hash]);
  res.json({ ok: true });
});

/* ──────────────────────────────────────────────────
   EDIFICIOS – Público (sin auth)
────────────────────────────────────────────────── */
app.get('/api/edificios', async (req, res) => {
  try {
    const [rows] = await pool.execute(
      'SELECT id,nombre,tipo,latitud,longitud,color_hex,horario,salones_total,labs,aulas,salas FROM v_edificios_publico'
    );
    res.json(rows);
  } catch { res.status(500).json({ error: 'Error al obtener edificios' }); }
});

/* ──────────────────────────────────────────────────
   EDIFICIOS – POST – Registrar (Solo Admin + JWT)
────────────────────────────────────────────────── */
app.post('/api/edificios', autenticar, soloAdmin, async (req, res) => { 
  const { id, nombre, tipo_id, latitud, longitud, horario } = req.body; 
  
  if (!id || !nombre || !tipo_id || !latitud || !longitud) { 
    return res.status(400).json({ error: 'Required fields are missing' }); 
  } 
  if (!/^[A-Z0-9]{1,5}$/.test(id)) { 
    return res.status(400).json({ error: 'Invalid building ID' }); 
  } 
  
  try { 
    await pool.execute( 
      `INSERT INTO edificios (id, nombre, tipo_id, latitud, longitud, horario) 
       VALUES (?, ?, ?, ?, ?, ?)`, 
      [id, sanitize(nombre), tipo_id, latitud, longitud, horario ? sanitize(horario) : null] 
    ); 

    await pool.execute(
      'INSERT INTO auditoria (usuario_id, accion, tabla, registro_id, ip_origen) VALUES (?,?,?,?,?)',
      [req.user.id, 'ADD_EDIFICIO', 'edificios', id, req.ip]
    );

    res.status(201).json({ ok: true, message: `Building ${id} created` }); 
  } catch (err) { 
    if (err.code === 'ER_DUP_ENTRY') {
      return res.status(409).json({ error: 'Building ID already exists' });
    }
    console.error(err);
    res.status(500).json({ error: 'Error creating the building' }); 
  } 
});

/* ──────────────────────────────────────────────────
   EDIFICIOS – Editar (solo admin)
────────────────────────────────────────────────── */
app.patch('/api/edificios/:id', autenticar, soloAdmin, async (req, res) => {
  const { id }    = req.params;
  const { nombre, horario, salones, lat, lng } = req.body;

  // Validar ID
  if (!/^[A-Z0-9]{1,5}$/.test(id))
    return res.status(400).json({ error: 'ID de edificio inválido' });

  try {
    // Query parametrizada – protegida contra SQL Injection
    await pool.execute(
      `UPDATE edificios SET
         nombre           = COALESCE(?, nombre),
         horario          = COALESCE(?, horario),
         capacidad_total  = COALESCE(?, capacidad_total),
         latitud          = COALESCE(?, latitud),
         longitud         = COALESCE(?, longitud)
       WHERE id = ?`,
      [
        nombre ? sanitize(nombre) : null,
        horario ? sanitize(horario) : null,
        salones ?? null,
        lat ?? null,
        lng ?? null,
        id
      ]
    );

    // Auditoría
    await pool.execute(
      'INSERT INTO auditoria (usuario_id, accion, tabla, registro_id, ip_origen) VALUES (?,?,?,?,?)',
      [req.user.id, 'EDIT_EDIFICIO', 'edificios', id, req.ip]
    );

    res.json({ ok: true, message: `Edificio ${id} actualizado` });
  } catch { res.status(500).json({ error: 'Error al actualizar edificio' }); }
});

/* ──────────────────────────────────────────────────
   EDIFICIOS – PUT – Reemplazo completo (solo admin)
   (Requiere TODOS los campos, a diferencia de PATCH
   que solo actualiza los campos enviados)
────────────────────────────────────────────────── */
app.put('/api/edificios/:id', autenticar, soloAdmin, async (req, res) => {
  const { id } = req.params;
  const { nombre, tipo_id, latitud, longitud, horario, salones_total } = req.body;

  if (!/^[A-Z0-9]{1,5}$/.test(id))
    return res.status(400).json({ error: 'ID de edificio inválido' });

  if (!nombre || !tipo_id || !latitud || !longitud)
    return res.status(400).json({ error: 'Faltan campos requeridos (nombre, tipo_id, latitud, longitud)' });

  try {
    const [result] = await pool.execute(
      `UPDATE edificios SET
         nombre          = ?,
         tipo_id         = ?,
         latitud         = ?,
         longitud        = ?,
         horario         = ?,
         capacidad_total = ?
       WHERE id = ?`,
      [sanitize(nombre), tipo_id, latitud, longitud, horario ? sanitize(horario) : null, salones_total || 0, id]
    );

    if (result.affectedRows === 0)
      return res.status(404).json({ error: `Edificio ${id} no encontrado` });

    await pool.execute(
      'INSERT INTO auditoria (usuario_id, accion, tabla, registro_id, ip_origen) VALUES (?,?,?,?,?)',
      [req.user.id, 'PUT_EDIFICIO', 'edificios', id, req.ip]
    );

    res.json({ ok: true, message: `Edificio ${id} reemplazado correctamente` });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Error al reemplazar edificio' });
  }
});

/* ──────────────────────────────────────────────────
   EDIFICIOS – DELETE – Baja lógica (solo admin)
   (No se borra el renglón físicamente; se marca
   activo = 0 para no romper llaves foráneas / auditoría)
────────────────────────────────────────────────── */
app.delete('/api/edificios/:id', autenticar, soloAdmin, async (req, res) => {
  const { id } = req.params;

  if (!/^[A-Z0-9]{1,5}$/.test(id))
    return res.status(400).json({ error: 'ID de edificio inválido' });

  try {
    const [result] = await pool.execute(
      'UPDATE edificios SET activo = 0 WHERE id = ?',
      [id]
    );

    if (result.affectedRows === 0)
      return res.status(404).json({ error: `Edificio ${id} no encontrado` });

    await pool.execute(
      'INSERT INTO auditoria (usuario_id, accion, tabla, registro_id, ip_origen) VALUES (?,?,?,?,?)',
      [req.user.id, 'DELETE_EDIFICIO', 'edificios', id, req.ip]
    );

    res.json({ ok: true, message: `Edificio ${id} eliminado (baja lógica)` });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Error al eliminar edificio' });
  }
});

/* ──────────────────────────────────────────────────
   COORDENADAS – Actualizar (dragend del mapa)
────────────────────────────────────────────────── */
app.patch('/api/edificios/:id/coordenadas', autenticar, soloAdmin, async (req, res) => {
  const { id }  = req.params;
  const { lat, lng } = req.body;

  if (!lat || !lng || isNaN(lat) || isNaN(lng))
    return res.status(400).json({ error: 'Coordenadas inválidas' });

  if (lat < 25.7 || lat > 26.0 || lng < -100.5 || lng > -100.0)
    return res.status(400).json({ error: 'Coordenadas fuera del rango de Escobedo, N.L.' });

  try {
    await pool.execute('CALL sp_actualizar_coordenadas(?,?,?,?,?)',
      [id, parseFloat(lat), parseFloat(lng), req.user.id, req.ip]);
    res.json({ ok: true, lat, lng });
  } catch { res.status(500).json({ error: 'Error al actualizar coordenadas' }); }
});

/* ──────────────────────────────────────────────────
   RUTAS DE TRANSPORTE – Público
────────────────────────────────────────────────── */
app.get('/api/rutas', async (req, res) => {
  try {
    const [rutas] = await pool.execute('SELECT * FROM v_rutas_publico');
    // Para cada ruta obtener coords y paradas
    for (const r of rutas) {
      const [coords]  = await pool.execute(
        'SELECT sentido, orden, latitud, longitud FROM coordenadas_ruta WHERE ruta_id=? ORDER BY sentido, orden', [r.id]);
      const [paradas] = await pool.execute(
        'SELECT sentido, orden, nombre FROM paradas WHERE ruta_id=? ORDER BY sentido, orden', [r.id]);
      const [horarios]= await pool.execute(
        'SELECT tipo, hora FROM horarios_ruta WHERE ruta_id=?', [r.id]);
      r.coords  = coords;
      r.paradas = paradas;
      r.horarios= horarios;
    }
    res.json(rutas);
  } catch { res.status(500).json({ error: 'Error al obtener rutas' }); }
});

/* ──────────────────────────────────────────────────
   SERVER
────────────────────────────────────────────────── */
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`✅ API UTE corriendo en http://localhost:${PORT}`));