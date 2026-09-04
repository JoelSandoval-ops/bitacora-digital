import { supabase } from './supabase.js';

document.addEventListener('DOMContentLoaded', async () => {
  console.log("🔍 [SUPERVISOR] Iniciando script...");
  
  await cargarAsistencias();
  await cargarNovedades();
  activarTiempoReal();

  document.querySelectorAll('.btn-actualizar').forEach(btn => {
    btn.addEventListener('click', () => {
      cargarAsistencias();
      cargarNovedades();
    });
  });
});

async function cargarAsistencias() {
  const tbody = document.getElementById('tbodyAsistencia');
  if (!tbody) return;

  console.log("📡 [SUPERVISOR] Consultando asistencias en Supabase...");

  // Intenta consultar la tabla bitacora_asistencia o bitacora como respaldo
  let { data, error } = await supabase
    .from('bitacora_asistencia')
    .select('*')
    .order('id', { ascending: false });

  if (error) {
    console.error("❌ Error en bitacora_asistencia, intentando tabla bitacora:", error);
    const resp = await supabase.from('bitacora').select('*').order('id', { ascending: false });
    data = resp.data;
    error = resp.error;
  }

  console.log("📊 [SUPERVISOR] Datos recibidos de Asistencia:", data);

  if (error) {
    tbody.innerHTML = `<tr><td colspan="7" class="text-center text-danger">Error de lectura: ${error.message}</td></tr>`;
    return;
  }

  if (!data || data.length === 0) {
    tbody.innerHTML = `<tr><td colspan="7" class="text-center text-warning fw-bold">No hay registros guardados en la base de datos.</td></tr>`;
    return;
  }

  tbody.innerHTML = data.map(item => {
    const fEntrada = item.fecha_hora_entrada || item.hora_ingreso || item.created_at;
    const hEntrada = fEntrada ? new Date(fEntrada).toLocaleString('es-EC') : '---';

    const fSalida = item.fecha_hora_salida || item.hora_salida;
    const hSalida = fSalida 
      ? new Date(fSalida).toLocaleString('es-EC') 
      : '<span class="badge bg-warning text-dark">DENTRO DEL CLUB</span>';

    const nombre = item.socio_visitante || item.nombre || 'Sin registrar';
    const cedula = item.cedula || '---';
    const destino = item.destino || 'Instalaciones';
    const obs = item.observaciones || item.novedades || 'Sin observaciones';
    const estado = (fSalida || item.estado === 'FINALIZADO') 
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

async function cargarNovedades() {
  const tbody = document.getElementById('tbodyNovedades');
  if (!tbody) return;

  console.log("📡 [SUPERVISOR] Consultando novedades...");

  let { data, error } = await supabase
    .from('bitacora_novedades')
    .select('*')
    .order('id', { ascending: false });

  if (error) {
    const resp = await supabase.from('novedades').select('*').order('id', { ascending: false });
    data = resp.data;
  }

  console.log("📊 [SUPERVISOR] Datos recibidos de Novedades:", data);

  if (!data || data.length === 0) {
    tbody.innerHTML = `<tr><td colspan="5" class="text-center text-muted">No hay novedades registradas.</td></tr>`;
    return;
  }

  tbody.innerHTML = data.map(item => {
    const fecha = item.fecha_registro || item.fecha_hora || item.created_at;
    const hFecha = fecha ? new Date(fecha).toLocaleString('es-EC') : '---';
    const guardia = item.guardia_nombre || item.guardia_registro || item.reportado_por || 'Guardia';
    const detalle = item.descripcion || item.observacion_guardia || item.titulo || 'Sin detalle';
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

function activarTiempoReal() {
  supabase
    .channel('realtime-supervisor-v2')
    .on('postgres_changes', { event: '*', schema: 'public', table: 'bitacora_asistencia' }, () => cargarAsistencias())
    .on('postgres_changes', { event: '*', schema: 'public', table: 'bitacora_novedades' }, () => cargarNovedades())
    .on('postgres_changes', { event: '*', schema: 'public', table: 'bitacora' }, () => cargarAsistencias())
    .subscribe();
}