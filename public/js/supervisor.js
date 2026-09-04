import { createClient } from 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/+esm';

const SUPABASE_URL = 'https://irdgnyqomuwajsezswal.supabase.co';
const SUPABASE_ANON_KEY = 'sb_publishable_dHiFIWqRS9XAedJLYMdeew_XVQUYDvp';

const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

let listaAsistencias = [];
let listaNovedades = [];

document.addEventListener('DOMContentLoaded', async () => {
  console.log("🔍 [SUPERVISOR] Cargando Bitácora de Asistencia...");
  await cargarDatos();
  activarTiempoReal();
  configurarEventos();
});

function configurarEventos() {
  document.querySelectorAll('.btn-actualizar').forEach(btn => {
    btn.addEventListener('click', () => cargarDatos());
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

  // Exportar Asistencia
  const btnExcelAsis = document.getElementById('btnExcelAsistencia');
  const btnPDFAsis = document.getElementById('btnPDFAsistencia');
  if (btnExcelAsis) btnExcelAsis.addEventListener('click', () => exportarExcel('areaPDFAsistencia', 'Asistencia_Club_Buena_Vista'));
  if (btnPDFAsis) btnPDFAsis.addEventListener('click', () => exportarPDF('areaPDFAsistencia', 'Asistencia_Club_Buena_Vista.pdf'));

  // Cerrar Sesión
  const btnSalir = document.getElementById('btnSalir');
  if (btnSalir) {
    btnSalir.addEventListener('click', async () => {
      await supabase.auth.signOut();
      window.location.href = './login.html';
    });
  }
}

// ==========================================
// CONSULTA DE DATOS DESDE SUPABASE
// ==========================================

async function cargarDatos() {
  let { data: todos, error } = await supabase.from('bitacora').select('*').order('id', { ascending: false });

  if (error || !todos) {
    const resp2 = await supabase.from('bitacora_asistencia').select('*').order('id', { ascending: false });
    todos = resp2.data || [];
  }

  const registros = todos || [];

  // FILTRO ESTRICTO PARA ASISTENCIA (Solo entradas/salidas de personas)
  listaAsistencias = registros.filter(item => {
    const destinoStr = String(item.destino || '');
    const obsStr = String(item.observaciones || item.novedades || item.detalle || '');
    const fotoStr = String(item.imagen_url || item.foto_url || item.foto || '');

    // Si contiene imagen o es un reporte técnico, NO va en asistencia
    const esFotoONovedad = destinoStr.startsWith('data:image') || 
                           obsStr.startsWith('data:image') || 
                           fotoStr.startsWith('data:image') ||
                           fotoStr.length > 50 ||
                           item.ubicacion || 
                           item.sector;

    return !esFotoONovedad;
  });

  renderTablaAsistencias(listaAsistencias);
}

// ==========================================
// RENDERIZADO DE LA TABLA DE ASISTENCIA
// ==========================================

function renderTablaAsistencias(datos) {
  const tbody = document.getElementById('tbodyAsistencia');
  if (!tbody) return;

  if (!datos || datos.length === 0) {
    tbody.innerHTML = `<tr><td colspan="6" class="text-center text-warning fw-bold py-4">No hay asistencias registradas.</td></tr>`;
    return;
  }

  tbody.innerHTML = datos.map(item => {
    // 1. Hora de entrada
    const fEntrada = item.fecha_hora_entrada || item.hora_ingreso || item.created_at;
    const hEntrada = fEntrada ? new Date(fEntrada).toLocaleString('es-EC') : '---';

    // 2. Hora de salida (Si no ha salido, muestra badge "DENTRO DEL CLUB")
    const fSalida = item.fecha_hora_salida || item.hora_salida;
    let hSalida = '---';

    if (fSalida && fSalida !== null && fSalida !== '') {
      hSalida = `<span class="badge badge-estado-salida"><i class="fa-solid fa-check me-1"></i>${new Date(fSalida).toLocaleString('es-EC')}</span>`;
    } else {
      hSalida = `<span class="badge badge-estado-dentro"><i class="fa-solid fa-clock me-1"></i>DENTRO DEL CLUB</span>`;
    }

    // 3. Socio / Visitante
    const nombre = item.socio_visitante || item.nombre || 'Sin Nombre';

    // 4. Cédula
    const cedula = item.cedula || '---';

    // 5. Destino
    let destino = item.destino || 'Instalaciones';
    if (String(destino).startsWith('data:image')) destino = 'Instalaciones';

    // 6. Observación real del guardia
    let observacion = item.observaciones || item.observacion || item.detalle || 'Sin observaciones';
    if (String(observacion).startsWith('data:image')) observacion = 'Sin observaciones';

    return `
      <tr>
        <td class="fw-semibold">${hEntrada}</td>
        <td>${hSalida}</td>
        <td><strong>${nombre}</strong></td>
        <td class="text-danger fw-bold">${cedula}</td>
        <td>${destino}</td>
        <td class="text-muted">${observacion}</td>
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
      const f = item.fecha_hora_entrada || item.hora_ingreso || item.created_at;
      return f && f.startsWith(fechaVal);
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

function activarTiempoReal() {
  supabase
    .channel('realtime-supervisor-asis')
    .on('postgres_changes', { event: '*', schema: 'public', table: 'bitacora' }, () => cargarDatos())
    .subscribe();
}

function exportarExcel(elementId, nombreArchivo) {
  const elemento = document.getElementById(elementId);
  if (!elemento) return;
  const wb = XLSX.utils.table_to_book(elemento, { sheet: "Asistencia" });
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