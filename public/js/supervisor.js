import './supabase.js';

let listaAsistencias = [];
let listaNovedades = [];

// Función para esperar a que el cliente global de Supabase esté disponible
async function obtenerClienteSupabase() {
  let intentos = 0;
  while (!window.supabaseClient && intentos < 50) {
    await new Promise(resolve => setTimeout(resolve, 100));
    intentos++;
  }
  return window.supabaseClient;
}

document.addEventListener('DOMContentLoaded', async () => {
  console.log("🔍 [SUPERVISOR] Iniciando script...");

  await cargarAsistencias();
  await cargarNovedades();
  await activarTiempoReal();
  configurarEventos();
});

function configurarEventos() {
  // Botones de actualización manual
  document.querySelectorAll('.btn-actualizar').forEach(btn => {
    btn.addEventListener('click', () => {
      cargarAsistencias();
      cargarNovedades();
    });
  });

  // Filtros de Asistencia
  const inputFechaAsis = document.getElementById('filtroFechaAsistencia');
  const inputTextoAsis = document.getElementById('filtroTextoAsistencia');
  const btnVerTodoAsis = document.getElementById('btnVerTodoAsistencia');

  if (inputFechaAsis) inputFechaAsis.addEventListener('change', aplicarFiltrosAsistencia);
  if (inputTextoAsis) inputTextoAsis.addEventListener('input', aplicarFiltrosAsistencia);
  if (btnVerTodoAsis) {
    btnVerTodoAsis.addEventListener('click', () => {
      if (inputFechaAsis) inputFechaAsis.value = '';
      if (inputTextoAsis) inputTextoAsis.value = '';
      renderTablaAsistencias(listaAsistencias);
    });
  }

  // Filtros de Novedades
  const inputFechaNov = document.getElementById('filtroFechaNovedades');
  const btnVerTodoNov = document.getElementById('btnVerTodoNovedades');

  if (inputFechaNov) inputFechaNov.addEventListener('change', aplicarFiltrosNovedades);
  if (btnVerTodoNov) {
    btnVerTodoNov.addEventListener('click', () => {
      if (inputFechaNov) inputFechaNov.value = '';
      renderTablaNovedades(listaNovedades);
    });
  }

  // Botones Exportación Excel / PDF Asistencia
  const btnExcelAsis = document.getElementById('btnExcelAsistencia');
  const btnPDFAsis = document.getElementById('btnPDFAsistencia');

  if (btnExcelAsis) btnExcelAsis.addEventListener('click', () => exportarExcel('areaPDFAsistencia', 'Asistencia_Club_Buena_Vista'));
  if (btnPDFAsis) btnPDFAsis.addEventListener('click', () => exportarPDF('areaPDFAsistencia', 'Asistencia_Club_Buena_Vista.pdf'));

  // Botones Exportación Excel / PDF Novedades
  const btnExcelNov = document.getElementById('btnExcelNovedades');
  const btnPDFNov = document.getElementById('btnPDFNovedades');

  if (btnExcelNov) btnExcelNov.addEventListener('click', () => exportarExcel('areaPDFNovedades', 'Novedades_Club_Buena_Vista'));
  if (btnPDFNov) btnPDFNov.addEventListener('click', () => exportarPDF('areaPDFNovedades', 'Novedades_Club_Buena_Vista.pdf'));

  // Cerrar sesión
  const btnSalir = document.getElementById('btnSalir');
  if (btnSalir) {
    btnSalir.addEventListener('click', async () => {
      const supabase = await obtenerClienteSupabase();
      if (supabase && supabase.auth) {
        await supabase.auth.signOut();
      }
      window.location.href = './login.html';
    });
  }
}

// ==========================================
// CONSULTA Y RENDERIZADO: ASISTENCIA
// ==========================================

async function cargarAsistencias() {
  const tbody = document.getElementById('tbodyAsistencia');
  if (!tbody) return;

  console.log("📡 [SUPERVISOR] Consultando asistencias en Supabase...");

  const supabase = await obtenerClienteSupabase();

  if (!supabase) {
    console.error("❌ Cliente de Supabase no encontrado.");
    tbody.innerHTML = `<tr><td colspan="7" class="text-center text-danger py-3">Error: Cliente de Supabase no inicializado.</td></tr>`;
    return;
  }

  let { data, error } = await supabase
    .from('bitacora_asistencia')
    .select('*')
    .order('id', { ascending: false });

  if (error) {
    console.warn("⚠️ Falló bitacora_asistencia, intentando tabla 'bitacora':", error);
    const resp = await supabase.from('bitacora').select('*').order('id', { ascending: false });
    data = resp.data;
    error = resp.error;
  }

  if (error) {
    console.error("❌ Error de lectura en Supabase:", error);
    tbody.innerHTML = `<tr><td colspan="7" class="text-center text-danger py-3">Error de lectura: ${error.message}</td></tr>`;
    return;
  }

  listaAsistencias = data || [];
  renderTablaAsistencias(listaAsistencias);
}

function renderTablaAsistencias(datos) {
  const tbody = document.getElementById('tbodyAsistencia');
  if (!tbody) return;

  if (!datos || datos.length === 0) {
    tbody.innerHTML = `<tr><td colspan="7" class="text-center text-warning fw-bold py-4">No hay registros guardados en la base de datos.</td></tr>`;
    return;
  }

  tbody.innerHTML = datos.map(item => {
    const fEntrada = item.fecha_hora_entrada || item.hora_ingreso || item.created_at;
    const hEntrada = fEntrada ? new Date(fEntrada).toLocaleString('es-EC') : '---';

    const fSalida = item.fecha_hora_salida || item.hora_salida;
    const hSalida = fSalida 
      ? new Date(fSalida).toLocaleString('es-EC') 
      : '<span class="badge badge-estado-dentro">DENTRO DEL CLUB</span>';

    const nombre = item.socio_visitante || item.nombre || 'Sin registrar';
    const cedula = item.cedula || '---';
    const destino = item.destino || 'Instalaciones';
    const obs = item.observaciones || item.novedades || 'Sin observaciones';
    const estado = (fSalida || item.estado === 'FINALIZADO') 
      ? '<span class="badge badge-estado-salida">COMPLETADO</span>' 
      : '<span class="badge badge-estado-dentro">ACTIVO</span>';

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

function aplicarFiltrosAsistencia() {
  const fechaVal = document.getElementById('filtroFechaAsistencia')?.value;
  const textoVal = document.getElementById('filtroTextoAsistencia')?.value?.toLowerCase().trim();

  let resultado = [...listaAsistencias];

  if (fechaVal) {
    resultado = resultado.filter(item => {
      const fechaItem = item.fecha_hora_entrada || item.hora_ingreso || item.created_at;
      return fechaItem && fechaItem.startsWith(fechaVal);
    });
  }

  if (textoVal) {
    resultado = resultado.filter(item => {
      const nombre = (item.socio_visitante || item.nombre || '').toLowerCase();
      const cedula = (item.cedula || '').toLowerCase();
      return nombre.includes(textoVal) || cedula.includes(textoVal);
    });
  }

  renderTablaAsistencias(resultado);
}

// ==========================================
// CONSULTA Y RENDERIZADO: NOVEDADES
// ==========================================

async function cargarNovedades() {
  const tbody = document.getElementById('tbodyNovedades');
  if (!tbody) return;

  console.log("📡 [SUPERVISOR] Consultando novedades...");

  const supabase = await obtenerClienteSupabase();

  if (!supabase) {
    tbody.innerHTML = `<tr><td colspan="5" class="text-center text-danger py-3">Error: Cliente de Supabase no inicializado.</td></tr>`;
    return;
  }

  let { data, error } = await supabase
    .from('bitacora_novedades')
    .select('*')
    .order('id', { ascending: false });

  if (error) {
    console.warn("⚠️ Falló bitacora_novedades, intentando tabla 'novedades':", error);
    const resp = await supabase.from('novedades').select('*').order('id', { ascending: false });
    data = resp.data;
    error = resp.error;
  }

  if (error) {
    tbody.innerHTML = `<tr><td colspan="5" class="text-center text-danger py-3">Error al cargar novedades.</td></tr>`;
    return;
  }

  listaNovedades = data || [];
  renderTablaNovedades(listaNovedades);
}

function renderTablaNovedades(datos) {
  const tbody = document.getElementById('tbodyNovedades');
  if (!tbody) return;

  if (!datos || datos.length === 0) {
    tbody.innerHTML = `<tr><td colspan="5" class="text-center text-muted py-4">No hay novedades registradas.</td></tr>`;
    return;
  }

  tbody.innerHTML = datos.map(item => {
    const fecha = item.fecha_registro || item.fecha_hora || item.created_at;
    const hFecha = fecha ? new Date(fecha).toLocaleString('es-EC') : '---';
    const guardia = item.guardia_nombre || item.guardia_registro || item.reportado_por || 'Guardia';
    const detalle = item.descripcion || item.observacion_guardia || item.titulo || 'Sin detalle';
    const foto = item.imagen_url || item.foto_url;

    const imgElement = foto 
      ? `<img src="${foto}" class="img-thumbnail-table ver-foto-btn" data-url="${foto}" alt="Evidencia">` 
      : '<span class="text-muted small">Sin Foto</span>';

    return `
      <tr>
        <td>${hFecha}</td>
        <td><strong>${guardia}</strong></td>
        <td>${detalle}</td>
        <td class="text-center">${imgElement}</td>
        <td><span class="badge bg-warning text-dark">${item.estado || 'PENDIENTE'}</span></td>
      </tr>
    `;
  }).join('');

  // Evento para abrir modal de fotos ampliadas
  document.querySelectorAll('.ver-foto-btn').forEach(img => {
    img.addEventListener('click', (e) => {
      const url = e.target.getAttribute('data-url');
      const imgTarget = document.getElementById('imgModalTarget');
      if (imgTarget && url) {
        imgTarget.src = url;
        const modal = new bootstrap.Modal(document.getElementById('modalVerImagen'));
        modal.show();
      }
    });
  });
}

function aplicarFiltrosNovedades() {
  const fechaVal = document.getElementById('filtroFechaNovedades')?.value;

  let resultado = [...listaNovedades];

  if (fechaVal) {
    resultado = resultado.filter(item => {
      const fechaItem = item.fecha_registro || item.fecha_hora || item.created_at;
      return fechaItem && fechaItem.startsWith(fechaVal);
    });
  }

  renderTablaNovedades(resultado);
}

// ==========================================
// REALTIME (TIEMPO REAL)
// ==========================================

async function activarTiempoReal() {
  const supabase = await obtenerClienteSupabase();
  if (!supabase) return;

  supabase
    .channel('realtime-supervisor-v2')
    .on('postgres_changes', { event: '*', schema: 'public', table: 'bitacora_asistencia' }, () => cargarAsistencias())
    .on('postgres_changes', { event: '*', schema: 'public', table: 'bitacora_novedades' }, () => cargarNovedades())
    .on('postgres_changes', { event: '*', schema: 'public', table: 'bitacora' }, () => cargarAsistencias())
    .subscribe();
}

// ==========================================
// FUNCIONES EXPORTAR (EXCEL Y PDF)
// ==========================================

function exportarExcel(elementId, nombreArchivo) {
  const elemento = document.getElementById(elementId);
  if (!elemento) return;
  
  const wb = XLSX.utils.table_to_book(elemento, { sheet: "Reporte" });
  XLSX.writeFile(wb, `${nombreArchivo}.xlsx`);
}

function exportarPDF(elementId, nombreArchivo) {
  const elemento = document.getElementById(elementId);
  if (!elemento) return;

  const opt = {
    margin:       0.3,
    filename:     nombreArchivo,
    image:        { type: 'jpeg', quality: 0.98 },
    html2canvas:  { scale: 2 },
    jsPDF:        { unit: 'in', format: 'letter', orientation: 'landscape' }
  };

  html2pdf().set(opt).from(elemento).save();
}