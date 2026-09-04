import { supabase } from './supabase.js';
import { protegerVista, cerrarSesion } from './auth-guard.js';

let usuarioActivo = null;

document.addEventListener('DOMContentLoaded', async () => {
  // Proteger vista: solo SUPERVISOR o ADMIN
  usuarioActivo = await protegerVista('SUPERVISOR');
  if (!usuarioActivo) return;

  document.getElementById('btnSalir')?.addEventListener('click', cerrarSesion);

  // Cargar datos iniciales en las tablas
  cargarAsistenciasSupervisor();
  cargarNovedadesSupervisor();

  // Escuchar CAMBIOS EN TIEMPO REAL desde Supabase
  escucharCambiosEnTiempoReal();

  // Botón manual de Actualizar
  document.querySelectorAll('.btn-actualizar, #btnActualizar').forEach(btn => {
    btn.addEventListener('click', () => {
      cargarAsistenciasSupervisor();
      cargarNovedadesSupervisor();
    });
  });
});

// 1. Cargar la Bitácora de Asistencia
async function cargarAsistenciasSupervisor() {
  // Busca el tbody por ID o toma el primer tbody disponible dentro de la tabla de asistencia
  const tbody = document.getElementById('tbodyAsistencias') || document.querySelector('table tbody');
  if (!tbody) return;

  const { data: registros, error } = await supabase
    .from('bitacora_asistencia')
    .select('*')
    .order('fecha_hora_entrada', { ascending: false });

  if (error) {
    console.error("Error al cargar asistencias:", error);
    tbody.innerHTML = `<tr><td colspan="7" class="text-center text-danger">Error al cargar datos desde Supabase.</td></tr>`;
    return;
  }

  if (!registros || registros.length === 0) {
    tbody.innerHTML = `<tr><td colspan="7" class="text-center">No hay registros de asistencia.</td></tr>`;
    return;
  }

  tbody.innerHTML = registros.map(item => {
    const horaEntrada = item.fecha_hora_entrada 
      ? new Date(item.fecha_hora_entrada).toLocaleString('es-EC') 
      : '---';

    const horaSalida = item.fecha_hora_salida 
      ? `<span class="badge bg-secondary p-2">${new Date(item.fecha_hora_salida).toLocaleString('es-EC')}</span>`
      : `<span class="badge bg-warning text-dark p-2">DENTRO DEL CLUB</span>`;

    const estadoAccion = item.fecha_hora_salida 
      ? '<span class="text-success fw-bold">✓ Completado</span>'
      : '<span class="badge bg-warning text-dark">DENTRO DEL CLUB</span>';

    return `
      <tr>
        <td>${horaEntrada}</td>
        <td>${horaSalida}</td>
        <td><strong>${item.socio_visitante || 'Sin Nombre'}</strong></td>
        <td class="text-danger fw-bold">${item.cedula || '---'}</td>
        <td>${item.destino || '---'}</td>
        <td>${item.observaciones || 'Sin observaciones'}</td>
        <td>${estadoAccion}</td>
      </tr>
    `;
  }).join('');
}

// 2. Cargar Novedades / Reportes
async function cargarNovedadesSupervisor() {
  const tbody = document.getElementById('tbodyNovedades');
  if (!tbody) return;

  const { data: registros, error } = await supabase
    .from('bitacora_novedades')
    .select('*')
    .order('fecha_registro', { ascending: false });

  if (error) {
    console.error("Error al cargar novedades:", error);
    return;
  }

  if (!registros || registros.length === 0) {
    tbody.innerHTML = `<tr><td colspan="5" class="text-center">No hay novedades registradas.</td></tr>`;
    return;
  }

  tbody.innerHTML = registros.map(item => `
    <tr>
      <td>${new Date(item.fecha_registro).toLocaleString('es-EC')}</td>
      <td>${item.guardia_nombre || 'Guardia'}</td>
      <td>${item.descripcion}</td>
      <td>
        ${item.imagen_url 
          ? `<a href="${item.imagen_url}" target="_blank" class="btn btn-sm btn-outline-primary">Ver Foto</a>` 
          : '<span class="text-muted">Sin evidencia</span>'}
      </td>
      <td><span class="badge bg-warning text-dark">${item.estado}</span></td>
    </tr>
  `).join('');
}

// 3. SUSCRIPCIÓN EN TIEMPO REAL (Escucha INSERT y UPDATE)
function escucharCambiosEnTiempoReal() {
  supabase
    .channel('cambios-bitacora-supervisor')
    .on('postgres_changes', { event: '*', schema: 'public', table: 'bitacora_asistencia' }, payload => {
      console.log('Cambio en Asistencia detectado:', payload);
      cargarAsistenciasSupervisor();
    })
    .on('postgres_changes', { event: '*', schema: 'public', table: 'bitacora_novedades' }, payload => {
      console.log('Cambio en Novedades detectado:', payload);
      cargarNovedadesSupervisor();
    })
    .subscribe();
}