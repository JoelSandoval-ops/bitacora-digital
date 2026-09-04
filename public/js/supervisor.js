import { supabase } from './supabase.js';
import { protegerVista, cerrarSesion } from './auth-guard.js';

let usuarioActivo = null;

document.addEventListener('DOMContentLoaded', async () => {
  // Proteger vista: solo SUPERVISOR o ADMIN
  usuarioActivo = await protegerVista('SUPERVISOR');
  if (!usuarioActivo) return;

  document.getElementById('btnSalir')?.addEventListener('click', cerrarSesion);

  // Cargar datos iniciales en la tabla del supervisor
  cargarAsistenciasSupervisor();
  cargarNovedadesSupervisor();

  // Escuchar CAMBIOS EN TIEMPO REAL desde Supabase
  escucharCambiosEnTiempoReal();
});

// 1. Cargar la Asistencia (Pestaña Asistencia en la imagen que me enviaste)
async function cargarAsistenciasSupervisor() {
  const tbody = document.getElementById('tbodyAsistencias'); // Asigna este ID a tu <tbody> en supervisor.html
  if (!tbody) return;

  const { data: registros, error } = await supabase
    .from('bitacora_asistencia')
    .select('*')
    .order('fecha_hora_entrada', { ascending: false });

  if (error) {
    console.error("Error al cargar asistencias:", error);
    return;
  }

  if (!registros || registros.length === 0) {
    tbody.innerHTML = `<tr><td colspan="7" class="text-center">No hay registros de asistencia.</td></tr>`;
    return;
  }

  tbody.innerHTML = registros.map(item => `
    <tr>
      <td>${new Date(item.fecha_hora_entrada).toLocaleString('es-EC')}</td>
      <td>${item.fecha_hora_salida ? new Date(item.fecha_hora_salida).toLocaleString('es-EC') : '---'}</td>
      <td><strong>${item.socio_visitante}</strong></td>
      <td>${item.cedula}</td>
      <td>${item.destino}</td>
      <td>${item.observaciones || 'Sin observaciones'}</td>
      <td><span class="badge ${item.estado === 'DENTRO' ? 'bg-success' : 'bg-secondary'}">${item.estado}</span></td>
    </tr>
  `).join('');
}

// 2. Cargar Novedades (Pestaña Bitácora de Novedades)
async function cargarNovedadesSupervisor() {
  const tbody = document.getElementById('tbodyNovedades');
  if (!tbody) return;

  const { data: registros, error } = await supabase
    .from('bitacora_novedades')
    .select('*')
    .order('fecha_registro', { ascending: false });

  if (error) return;

  tbody.innerHTML = registros.map(item => `
    <tr>
      <td>${new Date(item.fecha_registro).toLocaleString('es-EC')}</td>
      <td>${item.guardia_nombre}</td>
      <td>${item.descripcion}</td>
      <td>${item.imagen_url ? `<a href="${item.imagen_url}" target="_blank" class="btn btn-sm btn-info">Ver Foto</a>` : 'Sin foto'}</td>
      <td><span class="badge bg-warning">${item.estado}</span></td>
    </tr>
  `).join('');
}

// 3. SUSCRIPCIÓN EN TIEMPO REAL (Reflejo inmediato)
function escucharCambiosEnTiempoReal() {
  supabase
    .channel('cambios-bitacora')
    .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'bitacora_asistencia' }, payload => {
      console.log('Nuevo registro de asistencia detectado:', payload);
      cargarAsistenciasSupervisor(); // Recarga la tabla automáticamente sin refrescar la página
    })
    .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'bitacora_novedades' }, payload => {
      console.log('Nueva novedad detectada:', payload);
      cargarNovedadesSupervisor();
    })
    .subscribe();
}
