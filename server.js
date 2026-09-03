const express = require('express');
const cors = require('cors');
const { Pool } = require('pg');
const XLSX = require('xlsx');
require('dotenv').config();

const app = express();
app.use(cors());
app.use(express.json());
app.use(express.static('public'));

// Conexión a Base de Datos PostgreSQL
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.DATABASE_URL ? { rejectUnauthorized: false } : false
});

// Endpoint de prueba
app.get('/api/estado', (req, res) => {
  res.json({ mensaje: "Servidor del Club Buena Vista activo" });
});

// Endpoint para descargar reporte en Excel
app.get('/api/exportar-excel', async (req, res) => {
  try {
    const result = await pool.query('SELECT tipo_visita, nombre, cedula, placa, destino, estado, hora_ingreso, hora_salida FROM bitacora');
    const worksheet = XLSX.utils.json_to_sheet(result.rows);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, "Bitacora");

    const buffer = XLSX.write(workbook, { type: 'buffer', bookType: 'xlsx' });
    
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', 'attachment; filename=Reporte_Bitacora.xlsx');
    res.send(buffer);
  } catch (err) {
    res.status(500).json({ error: "Error generando Excel: " + err.message });
  }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Servidor activo en el puerto ${PORT}`));