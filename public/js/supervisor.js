import { createClient } from 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/+esm';

const SUPABASE_URL = 'https://irdgnyqomuwajsezswal.supabase.co';
const SUPABASE_ANON_KEY = 'sb_publishable_dHiFIWqRS9XAedJLYMdeew_XVQUYDvp';

const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

let listaAsistencias = [];
let listaNovedades = [];

document.addEventListener('DOMContentLoaded', async () => {
  console.log("🔍 [SUPERVISOR] Iniciando script...");

  await cargarDatos();
  activarTiempoReal();
  configurarEventos();
});

function configurarEventos() {
  document.querySelectorAll('.btn-actualizar').forEach(btn => {
    btn.addEventListener('click', () => cargarDatos());
  });

  // Filtros Asistencia
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

  // Filtros Novedades
  const inputFechaNov = document.getElementById('filtroFechaNovedades');
  const btnVerTodoNov = document.getElementById('btnVerTodoNovedades');

  if (inputFechaNov) inputFechaNov.addEventListener('change', aplicarFiltrosNovedades);
  if (btnVerTodoNov) {
    btnVerTodoNov.addEventListener('click', () => {
      if (inputFechaNov) inputFechaNov.value = '';
      renderTablaNovedades(listaNovedades);
    });
  }

  // Exportaciones
  const btnExcelAsis = document.getElementById('btnExcelAsistencia');
  const btnPDFAsis = document.getElementById('btnPDFAsistencia');
  if (btnExcelAsis) btnExcelAsis.addEventListener('click', () => exportarExcel('areaPDFAsistencia', 'Asistencia_Club_Buena_Vista'));
  if (btnPDFAsis) btnPDFAsis.addEventListener('click', () => exportarPDF('areaPDFAsistencia', 'Asistencia_Club_Buena_Vista.pdf'));

  const btnExcelNov = document.getElementById('btnExcelNovedades');
  const btnPDFNov = document.getElementById('btnPDFNovedades');
  if (btnExcelNov) btnExcelNov.addEventListener('click', () => exportarExcel('areaPDFNovedades', 'Novedades_Club_Buena_Vista'));
  if (btnPDFNov) btnPDFNov.addEventListener('click', () => exportarPDF('areaPDFNovedades', 'Novedades_Club_Buena_Vista.pdf'));

  const btnSalir = document.getElementById('btnSalir');
  if (btnSalir) {
    btnSalir.addEventListener('click', async () => {
      await supabase.auth.signOut();
      window.location.href = './login.html';
    });
  }
}

// ==========================================
// CONSULTA Y REPARTICIÓN
// ==========================================

async function cargarDatos() {
  console.log("📡 [SUPERVISOR] Consultando registros...");

  let { data: todos, error } = await supabase.from('bitacora').select('*').order('id', { ascending: false });

  if (error || !todos) {
    const resp2 = await supabase.from('bitacora_asistencia').select('*').order('id', { ascending: false });
    todos = resp2.data || [];
  }

  const registros = todos || [];

  // Clasificar Novedades
  listaNovedades = registros.filter(item => {
    const destinoStr = String(item.destino || '');
    const obsStr = String(item.observaciones || item.novedades || item.detalle || '');
    const fotoStr = String(item.imagen_url || item.foto_url || item.foto || '');
    const tipoStr = String(item.tipo || '').toLowerCase();

    return destinoStr.startsWith('data:image') || 
           obsStr.startsWith('data:image') || 
           fotoStr.startsWith('data:image') ||
           fotoStr.length > 50 ||
           tipoStr === 'novedad' ||
           item.ubicacion || 
           item.sector || 
           item.asunto;
  });

  // Clasificar Asistencias limpias
  listaAsistencias = registros.filter(item => {
    const destinoStr = String(item.destino || '');
    const obsStr = String(item.observaciones || item.novedades || item.detalle || '');
    const fotoStr = String(item.imagen_url || item.foto_url || item.foto || '');

    const esNovedad = destinoStr.startsWith('data:image') || 
                      obsStr.startsWith('data:image') || 
                      fotoStr.startsWith('data:image') ||
                      fotoStr.length > 50;

    return !esNovedad;
  });

  renderTablaAsistencias(listaAsistencias);
  renderTablaNovedades(listaNovedades);
}

// ==========================================
// RENDER: BITÁCORA DE ASISTENCIA
// ==========================================

function renderTablaAsistencias(datos) {
  const tbody = document.getElementById('tbodyAsistencia');
  if (!tbody) return;

  if (!datos || datos.length === 0) {
    tbody.innerHTML = `<tr><td colspan="5" class="text-center text-warning fw-bold py-4">No hay asistencias registradas.</td></tr>`;
    return;
  }

  tbody.innerHTML = datos.map(item => {
    const fEntrada = item.fecha_hora_entrada || item.hora_ingreso || item.created_at;
    const hEntrada = fEntrada ? new Date(fEntrada).toLocaleString('es-EC') : '---';

    const fSalida = item.fecha_hora_salida || item.hora_salida;
    const hSalida = fSalida 
      ? new Date(fSalida).toLocaleString('es-EC') 
      : '<span class="badge bg-warning text-dark font-weight-bold">DENTRO DEL CLUB</span>';

    const nombre = item.socio_visitante || item.nombre || 'Sin Nombre';
    const cedula = item.cedula || '---';
    
    let destino = item.destino || 'Instalaciones';
    if (String(destino).startsWith('data:image')) {
      destino = 'Instalaciones';
    }

    return `
      <tr>
        <td>${hEntrada}</td>
        <td>${hSalida}</td>
        <td><strong>${nombre}</strong></td>
        <td class="text-danger fw-bold">${cedula}</td>
        <td>${destino}</td>
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

// ==========================================
// RENDER: BITÁCORA DE NOVEDADES CON FOTOS GRANDES
// ==========================================

function renderTablaNovedades(datos) {
  const tbody = document.getElementById('tbodyNovedades');
  if (!tbody) return;

  if (!datos || datos.length === 0) {
    tbody.innerHTML = `<tr><td colspan="5" class="text-center text-muted py-4">No hay novedades registradas.</td></tr>`;
    return;
  }

  tbody.innerHTML = datos.map(item => {
    // 1. Fecha
    const fecha = item.fecha_registro || item.fecha_hora || item.fecha_hora_entrada || item.created_at;
    const hFecha = fecha ? new Date(fecha).toLocaleString('es-EC') : '---';

    // 2. Ubicación / Sector
    const sector = item.ubicacion || item.sector || item.lugar || 'Porteria';

    // 3. Asunto / Novedad
    let asunto = item.asunto || item.socio_visitante || item.novedad || 'Novedad Reportada';
    if (String(asunto).startsWith('data:image')) {
      asunto = 'Novedad Reportada';
    }

    // 4. Detalle / Observación
    let detalle = item.detalle || item.observaciones || item.descripcion || 'Sin detalle registrado';
    if (String(detalle).startsWith('data:image')) {
      detalle = 'Sin detalle escrito';
    }

    // 5. Extracción Limpia de la Fotografía
    let foto = item.imagen_url || item.foto_url || item.foto || '';
    if (!foto && String(item.destino).startsWith('data:image')) {
      foto = item.destino;
    }
    if (!foto && String(item.observaciones).startsWith('data:image')) {
      foto = item.observaciones;
    }

    const imgElement = foto 
      ? `<img src="${foto}" class="img-novedad-amplia ver-foto-btn" data-url="${foto}" alt="Foto Novedad" title="Clic para ampliar">` 
      : '<span class="text-muted fw-bold small">- Sin Foto -</span>';

    return `
      <tr style="height: 110px;">
        <td class="align-middle">${hFecha}</td>
        <td class="align-middle"><span class="badge badge-sector">${sector}</span></td>
        <td class="align-middle"><strong>${asunto}</strong></td>
        <td class="align-middle" style="white-space: pre-line;">${detalle}</td>
        <td class="align-middle text-center">${imgElement}</td>
      </tr>
    `;
  }).join('');

  // Evento clic para abrir la foto gigante en Modal
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
      const f = item.fecha_registro || item.fecha_hora || item.created_at;
      return f && f.startsWith(fechaVal);
    });
  }

  renderTablaNovedades(resultado);
}

function activarTiempoReal() {
  supabase
    .channel('realtime-supervisor-v5')
    .on('postgres_changes', { event: '*', schema: 'public', table: 'bitacora' }, () => cargarDatos())
    .subscribe();
}

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