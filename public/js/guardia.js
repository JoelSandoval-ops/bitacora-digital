import { supabase } from './supabase.js';
import { protegerVista, cerrarSesion } from './auth-guard.js';

let usuarioActivo = null;

document.addEventListener('DOMContentLoaded', async () => {
  // Proteger vista: solo rol GUARDIA
  usuarioActivo = await protegerVista('GUARDIA');
  if (!usuarioActivo) return;

  document.getElementById('lblUsuario')?.replaceChildren(usuarioActivo.nombre_completo);
  document.getElementById('btnSalir')?.addEventListener('click', cerrarSesion);

  cargarHistorialNovedades();
  cargarHistorialAsistencia();

  // Formulario 1: Registrar Novedad con Imagen
  const formNovedad = document.getElementById('formNovedad');
  if (formNovedad) {
    formNovedad.addEventListener('submit', guardarNovedad);
  }

  // Formulario 2: Registrar Asistencia
  const formAsistencia = document.getElementById('formAsistencia');
  if (formAsistencia) {
    formAsistencia.addEventListener('submit', guardarAsistencia);
  }
});

// --- 1. GUARDAR NOVEDAD ---
async function guardarNovedad(e) {
  e.preventDefault();
  const descripcion = document.getElementById('descNovedad').value.trim();
  const archivoInput = document.getElementById('fotoEvidencia');
  let fotoUrl = null;

  try {
    if (archivoInput && archivoInput.files.length > 0) {
      const foto = archivoInput.files[0];
      const fileName = `evidencia_${Date.now()}_${foto.name}`;

      const { data: uploadData, error: uploadError } = await supabase
        .storage
        .from('evidencias')
        .upload(fileName, foto);

      if (uploadError) throw new Error('Error al subir la imagen: ' + uploadError.message);

      const { data: urlData } = supabase.storage.from('evidencias').getPublicUrl(fileName);
      fotoUrl = urlData.publicUrl;
    }

    const { error: insertError } = await supabase
      .from('bitacora_novedades')
      .insert([{
        guardia_id: usuarioActivo.id,
        guardia_nombre: usuarioActivo.nombre_completo,
        descripcion: descripcion,
        imagen_url: fotoUrl,
        estado: 'PENDIENTE',
        fecha_registro: new Date().toISOString()
      }]);

    if (insertError) throw new Error('Error al guardar reporte de novedad: ' + insertError.message);

    alert('Novedad reportada correctamente.');
    document.getElementById('formNovedad').reset();
    cargarHistorialNovedades();

  } catch (err) {
    alert(err.message);
  }
}

// --- 2. GUARDAR ASISTENCIA ---
async function guardarAsistencia(e) {
  e.preventDefault();
  const nombre = document.getElementById('nombreVisitante')?.value.trim();
  const cedula = document.getElementById('cedulaVisitante')?.value.trim();
  const destino = document.getElementById('destinoVisitante')?.value.trim();
  const observaciones = document.getElementById('obsAsistencia')?.value.trim() || '';

  try {
    const { error: insertError } = await supabase
      .from('bitacora_asistencia')
      .insert([{
        guardia_id: usuarioActivo.id,
        guardia_nombre: usuarioActivo.nombre_completo,
        socio_visitante: nombre,
        cedula: cedula,
        destino: destino,
        observaciones: observaciones,
        estado: 'DENTRO DEL CLUB',
        fecha_hora_entrada: new Date().toISOString()
      }]);

    if (insertError) throw new Error('Error al registrar ingreso: ' + insertError.message);

    alert('Ingreso registrado con éxito.');
    document.getElementById('formAsistencia')?.reset();
    cargarHistorialAsistencia();

  } catch (err) {
    alert(err.message);
  }
}

// --- 3. MARCAR SALIDA (Acción del Botón en la Tabla) ---
async function marcarSalida(id) {
  try {
    const { error } = await supabase
      .from('bitacora_asistencia')
      .update({
        estado: 'Completado',
        fecha_hora_salida: new Date().toISOString()
      })
      .eq('id', id);

    if (error) throw error;

    cargarHistorialAsistencia();
  } catch (err) {
    alert('Error al marcar salida: ' + err.message);
  }
}

// Hacer la función accesible globalmente para los clics en botones HTML dinámicos
window.marcarSalida = marcarSalida;

// --- CARGAR HISTORIALES DEL GUARDIA ---
async function cargarHistorialNovedades() {
  const contenedor = document.getElementById('listaNovedades');
  if (!contenedor) return;

  const { data: registros, error } = await supabase
    .from('bitacora_novedades')
    .select('*')
    .order('fecha_registro', { ascending: false });

  if (error) {
    contenedor.innerHTML = '<p class="text-danger">Error al obtener historial de novedades.</p>';
    return;
  }

  contenedor.innerHTML = registros.map(item => `
    <div class="card mb-2 shadow-sm">
      <div class="card-body">
        <div class="d-flex justify-content-between align-items-center">
          <h6 class="mb-0 fw-bold">${item.guardia_nombre}</h6>
          <span class="badge ${obtenerBadgeEstado(item.estado)}">${item.estado}</span>
        </div>
        <p class="mb-1 mt-2 text-secondary">${item.descripcion}</p>
        ${item.imagen_url ? `<a href="${item.imagen_url}" target="_blank" class="btn btn-sm btn-outline-primary mt-1">Ver Foto Adjunta</a>` : ''}
        <div class="small text-muted mt-2">${new Date(item.fecha_registro).toLocaleString('es-EC')}</div>
      </div>
    </div>
  `).join('');
}

async function cargarHistorialAsistencia() {
  const contenedor = document.getElementById('listaAsistencias') || document.querySelector('#tablaAsistencias tbody');
  if (!contenedor) return;

  const { data: registros, error } = await supabase
    .from('bitacora_asistencia')
    .select('*')
    .order('fecha_hora_entrada', { ascending: false });

  if (error) {
    console.error('Error al obtener asistencias:', error);
    return;
  }

  // Si el contenedor es la tabla completa como en la Foto 1
  contenedor.innerHTML = registros.map(item => {
    const horaEntrada = new Date(item.fecha_hora_entrada).toLocaleString('es-EC');
    const horaSalida = item.fecha_hora_salida 
      ? new Date(item.fecha_hora_salida).toLocaleString('es-EC')
      : '<span class="badge bg-warning text-dark">DENTRO DEL CLUB</span>';

    const accionBoton = item.fecha_hora_salida
      ? '<span class="text-success fw-bold">✓ Completado</span>'
      : `<button onclick="marcarSalida(${item.id})" class="btn btn-sm btn-outline-danger">📍 Marcar Salida</button>`;

    return `
      <tr>
        <td>${horaEntrada}</td>
        <td>${horaSalida}</td>
        <td><strong>${item.socio_visitante}</strong></td>
        <td class="text-danger">${item.cedula || ''}</td>
        <td>${item.destino || ''}</td>
        <td>${item.observaciones || ''}</td>
        <td>${accionBoton}</td>
      </tr>
    `;
  }).join('');
}

function obtenerBadgeEstado(estado) {
  if (estado === 'REVISADO') return 'bg-success';
  if (estado === 'EN_PROCESO') return 'bg-warning text-dark';
  return 'bg-danger';
}