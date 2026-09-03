require('dotenv').config();
const express = require('express');
const cors = require('cors');
const { Pool } = require('pg');
const XLSX = require('xlsx');

const app = express();
const PORT = process.env.PORT || 3000;

// Configuración de Middlewares
app.use(cors());
app.use(express.json({ limit: '10mb' }));
app.use(express.static('public'));

// Conexión a PostgreSQL (Supabase Transaction Pooler - Puerto 6543)
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.DATABASE_URL && !process.env.DATABASE_URL.includes('localhost') 
    ? { rejectUnauthorized: false } 
    : false
});

// ==========================================
// 1. CRUD DE SEDES / CLUBES
// ==========================================

app.get('/api/clubes', async (req, res) => {
  try {
    const result = await pool.query('SELECT * FROM clubes ORDER BY id ASC');
    res.json(result.rows);
  } catch (err) {
    res.status(500).json({ error: 'Error al obtener sedes: ' + err.message });
  }
});

app.post('/api/clubes', async (req, res) => {
  const { nombre, direccion } = req.body;
  try {
    const result = await pool.query(
      'INSERT INTO clubes (nombre, direccion) VALUES ($1, $2) RETURNING *',
      [nombre, direccion]
    );
    res.status(201).json(result.rows[0]);
  } catch (err) {
    res.status(500).json({ error: 'Error al crear sede: ' + err.message });
  }
});

// ==========================================
// 2. CRUD DE USUARIOS (ADMINISTRACIÓN)
// ==========================================

app.get('/api/usuarios', async (req, res) => {
  try {
    const result = await pool.query(`
      SELECT u.id, u.nombre, u.correo, u.rol, u.club_id, c.nombre AS club_nombre 
      FROM usuarios u 
      LEFT JOIN clubes c ON u.club_id = c.id 
      ORDER BY u.id DESC
    `);
    res.json(result.rows);
  } catch (err) {
    res.status(500).json({ error: 'Error al obtener usuarios: ' + err.message });
  }
});

app.post('/api/usuarios', async (req, res) => {
  const { nombre, correo, password, rol, club_id } = req.body;
  try {
    const existe = await pool.query('SELECT id FROM usuarios WHERE correo = $1', [correo]);
    if (existe.rows.length > 0) {
      return res.status(400).json({ error: 'El correo ya se encuentra registrado.' });
    }

    const result = await pool.query(
      'INSERT INTO usuarios (nombre, correo, password, rol, club_id) VALUES ($1, $2, $3, $4, $5) RETURNING *',
      [nombre, correo, password, rol, club_id || null]
    );
    res.status(201).json(result.rows[0]);
  } catch (err) {
    res.status(500).json({ error: 'Error al registrar usuario: ' + err.message });
  }
});

app.delete('/api/usuarios/:id', async (req, res) => {
  const { id } = req.params;
  try {
    await pool.query('UPDATE bitacora SET registrado_por = $1 WHERE registrado_por = $2', ['Usuario Eliminado', id]);
    await pool.query('DELETE FROM usuarios WHERE id = $1', [id]);
    res.json({ exito: true, mensaje: 'Usuario eliminado correctamente.' });
  } catch (err) {
    res.status(500).json({ error: 'Error al eliminar usuario: ' + err.message });
  }
});

// ==========================================
// 3. BITÁCORA Y EVIDENCIAS
// ==========================================

app.get('/api/bitacora', async (req, res) => {
  try {
    const result = await pool.query(`
      SELECT b.*, c.nombre AS club_nombre 
      FROM bitacora b 
      LEFT JOIN clubes c ON b.club_id = c.id 
      ORDER BY b.hora_ingreso DESC
    `);
    res.json(result.rows);
  } catch (err) {
    res.status(500).json({ error: 'Error al consultar bitácora: ' + err.message });
  }
});

app.post('/api/bitacora', async (req, res) => {
  const { club_id, tipo_visita, nombre, cedula, placa, destino, hora_ingreso, novedades, foto_url, registrado_por } = req.body;
  try {
    const result = await pool.query(`
      INSERT INTO bitacora (club_id, tipo_visita, nombre, cedula, placa, destino, hora_ingreso, novedades, foto_url, registrado_por) 
      VALUES ($1, $2, $3, $4, $5, $6, COALESCE($7, NOW()), $8, $9, $10) RETURNING *
    `, [
      club_id, 
      tipo_visita || 'Socio', 
      nombre, 
      cedula, 
      placa || 'Peatonal', 
      destino, 
      hora_ingreso, 
      novedades || 'Sin novedades', 
      foto_url || null, 
      registrado_por
    ]);
    
    res.status(201).json(result.rows[0]);
  } catch (err) {
    res.status(500).json({ error: 'Error al registrar en bitácora: ' + err.message });
  }
});

app.put('/api/bitacora/:id', async (req, res) => {
  const { id } = req.params;
  try {
    const result = await pool.query(
      'UPDATE bitacora SET hora_salida = NOW() WHERE id = $1 RETURNING *',
      [id]
    );
    res.json(result.rows[0]);
  } catch (err) {
    res.status(500).json({ error: 'Error al marcar salida: ' + err.message });
  }
});

app.delete('/api/bitacora/:id', async (req, res) => {
  const { id } = req.params;
  try {
    await pool.query('DELETE FROM bitacora WHERE id = $1', [id]);
    res.json({ exito: true, mensaje: 'Registro eliminado con éxito.' });
  } catch (err) {
    res.status(500).json({ error: 'Error al borrar registro: ' + err.message });
  }
});

// ==========================================
// 4. REPORTES A EXCEL
// ==========================================

app.get('/api/exportar-excel', async (req, res) => {
  const { tipo } = req.query;

  try {
    let query = '';
    if (tipo === 'novedades') {
      query = `
        SELECT b.hora_ingreso AS "Fecha/Hora", c.nombre AS "Sede", b.novedades AS "Novedad", 
               b.foto_url AS "Link Foto Evidencia", b.registrado_por AS "Guardia"
        FROM bitacora b
        LEFT JOIN clubes c ON b.club_id = c.id
        WHERE b.novedades IS NOT NULL AND b.novedades != 'Sin novedades'
        ORDER BY b.hora_ingreso DESC
      `;
    } else {
      query = `
        SELECT c.nombre AS "Sede", b.hora_ingreso AS "Ingreso", b.hora_salida AS "Salida", 
               b.tipo_visita AS "Tipo", b.nombre AS "Cliente/Socio", b.cedula AS "Cedula", 
               b.placa AS "Placa", b.destino AS "Destino", b.registrado_por AS "Guardia"
        FROM bitacora b
        LEFT JOIN clubes c ON b.club_id = c.id
        WHERE b.novedades IS NULL OR b.novedades = 'Sin novedades'
        ORDER BY b.hora_ingreso DESC
      `;
    }

    const result = await pool.query(query);
    const worksheet = XLSX.utils.json_to_sheet(result.rows);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, tipo === 'novedades' ? 'Novedades' : 'Asistencias');

    const buffer = XLSX.write(workbook, { type: 'buffer', bookType: 'xlsx' });

    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', `attachment; filename=Reporte_${tipo}_${Date.now()}.xlsx`);
    res.send(buffer);

  } catch (err) {
    res.status(500).json({ error: 'Error al generar Excel: ' + err.message });
  }
});

// Si se ejecuta en local, levantamos el servidor tradicional; en Vercel exportamos la app
if (process.env.VERCEL !== '1') {
  app.listen(PORT, () => console.log(`🚀 Servidor en puerto ${PORT}`));
}

module.exports = app;