import { supabase } from './supabase.js';

document.addEventListener('DOMContentLoaded', async () => {
  console.log("Iniciando panel de supervisión...");

  await cargarAsistencias();
  await cargarNovedades();
  activarTiempoReal();

  // Botones de actualización manual
  document.querySelectorAll('.btn-actualizar').forEach(btn => {
    btn.addEventListener('click', () => {
      cargarAsistencias();
      cargarNovedades();
    });
  });
});

// Cargar asistencias en vivo
async function cargarAsistencias() {
  const tbody = document.getElementById('tbodyAsistencia') || document.getElementById('tbodyAsistencias');
  if (!tbody) return;

  tbody.innerHTML = `<tr><td colspan="7" class="text-center text-muted">Cargando datos...</td></tr>`;

  const { data, error } = await supabase
    .from('bitacora_asistencia')
    .select('*')
    .order('fecha_hora_entrada', { ascending: false });

  if (error) {
    console.error("Error al cargar asistencias:", error);
    tbody.innerHTML = `<tr><td colspan="7" class="text-center text-danger">Error: ${error.message}</td></tr>`;
    return;
  }

  if (!data || data.length === 0) {
    tbody.innerHTML = `<tr><td colspan="7" class="text-center text-muted">No hay registros de asistencia.</td></tr>`;
    return;
  }

  tbody.innerHTML = data.map(item => {
    const fEntrada = item.fecha_hora_entrada || item.created_at;
    const hEntrada = fEntrada ? new Date(fEntrada).toLocaleString('es-EC') : '---';

    const fSalida = item.fecha_hora_salida;
    const hSalida = fSalida 
      ? new Date(fSalida).toLocaleString('es-EC') 
      : '<span class="badge bg-warning text-dark">DENTRO DEL CLUB</span>';

    const nombre = item.socio_visitante || item.nombre || 'Sin registrar';
    const cedula = item.cedula || '---';
    const destino = item.destino || 'Instalaciones';
    const obs = item.observaciones || 'Sin observaciones';
    const estado = fSalida 
      ? '<span class="badge bg-secondary">COMPLETADO</span>' 
      : '<span class="badge bg-warning text-dark">ACTIVO</span>';

    return `
      <tr>
        <td>${hEntrada}</td>
        <td>${hSalida}</td>
        <td><strong>${nombre}</strong></td>
        <td class="text-danger fw-bold">${cedula}</td>
        <td>${destino}</td>
        <td class="small text-muted">${obs}</td>
        <td>${estado}</td>
      </tr>
    `;
  }).join('');
}

// Cargar novedades registradas
async function cargarNovedades() {
  const tbody = document.getElementById('tbodyNovedades');
  if (!tbody) return;

  const { data, error } = await supabase
    .from('bitacora_novedades')
    .select('*')
    .order('fecha_registro', { ascending: false });

  if (error) {
    console.error("Error al cargar novedades:", error);
    return;
  }

  if (!data || data.length === 0) {
    tbody.innerHTML = `<tr><td colspan="5" class="text-center text-muted">No hay novedades registradas.</td></tr>`;
    return;
  }

  tbody.innerHTML = data.map(item => {
    const fecha = item.fecha_registro || item.fecha_hora || item.created_at;
    const hFecha = fecha ? new Date(fecha).toLocaleString('es-EC') : '---';
    const guardia = item.guardia_nombre || item.guardia_registro || 'Guardia';
    const detalle = item.descripcion || item.observacion_guardia || item.asunto || 'Sin detalle';
    const foto = item.imagen_url || item.foto_url;

    return `
      <tr>
        <td>${hFecha}</td>
        <td><strong>${guardia}</strong></td>
        <td>${detalle}</td>
        <td>
          ${foto 
            ? `<a href="${foto}" target="_blank" class="btn btn-sm btn-outline-success"><i class="fa-solid fa-image me-1"></i>Ver Foto</a>` 
            : '<span class="text-muted">Sin Foto</span>'}
        </td>
        <td><span class="badge bg-warning text-dark">${item.estado || 'PENDIENTE'}</span></td>
      </tr>
    `;
  }).join('');
}

// Escuchar cambios en tiempo real desde Supabase
function activarTiempoReal() {
  supabase
    .channel('realtime-supervisor-global')
    .on('postgres_changes', { event: '*', schema: 'public', table: 'bitacora_asistencia' }, () => cargarAsistencias())
    .on('postgres_changes', { event: '*', schema: 'public', table: 'bitacora_novedades' }, () => cargarNovedades())
    .subscribe();
}