import { createClient } from 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/+esm';

const SUPABASE_URL = 'https://irdgnyqomuwajsezswal.supabase.co';
const SUPABASE_ANON_KEY = 'sb_publishable_dHiFIWqRS9XAedJLYMdeew_XVQUYDvp';

const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

let listaAsistencias = [];
let listaNovedades = [];

document.addEventListener('DOMContentLoaded', async () => {
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
  const inputFechaNov = document.getElementById('filtroFechaNovedad');
  const btnVerTodoNov = document.getElementById('btnVerTodoNovedad');

  if (inputFechaNov) inputFechaNov.addEventListener('change', aplicarFiltrosNovedades);
  if (btnVerTodoNov) {
    btnVerTodoNov.addEventListener('click', () => {
      if (inputFechaNov) inputFechaNov.value = '';
      renderTablaNovedades(listaNovedades);
    });
  }

  // Exportaciones Asistencia
  document.getElementById('btnExcelAsistencia')?.addEventListener('click', () => exportarExcel('areaPDFAsistencia', 'Asistencia_Club_Buena_Vista'));
  document.getElementById('btnPDFAsistencia')?.addEventListener('click', () => exportarPDF('areaPDFAsistencia', 'Asistencia_Club_Buena_Vista.pdf'));

  // Exportaciones Novedades
  document.getElementById('btnExcelNovedad')?.addEventListener('click', () => exportarExcel('areaPDFNovedad', 'Novedades_Club_Buena_Vista'));
  document.getElementById('btnPDFNovedad')?.addEventListener('click', () => exportarPDF('areaPDFNovedad', 'Novedades_Club_Buena_Vista.pdf'));

  // Guardar Cambios de Edición
  document.getElementById('formEditarAsistencia')?.addEventListener('submit', async (e) => {
    e.preventDefault();
    await guardarCambiosAsistencia();
  });

  // Cerrar Sesión
  document.getElementById('btnSalir')?.addEventListener('click', async () => {
    await supabase.auth.signOut();
    window.location.href = './login.html';
  });
}

// Extraer imagen Base64 o URL limpiamente
function extraerImagen(item) {
  const campos = [item.imagen_url, item.foto_url, item.foto, item.destino, item.ubicacion, item.observaciones, item.detalle, item.novedades];
  for (let c of campos) {
    if (typeof c === 'string' && (c.startsWith('data:image') || c.startsWith('http') || c.length > 200)) {
      return c;
    }
  }
  return null;
}

// Limpiar valores para que la cadena base64 no ensucie las columnas de texto
function limpiarTexto(valor) {
  if (!valor) return '';
  const str = String(valor).trim();
  if (str.startsWith('data:image') || str.startsWith('http') || str.length > 200) {
    return '';
  }
  return str;
}

function obtenerFechaLocalYYYYMMDD(fechaStr) {
  if (!fechaStr) return '';
  const d = new Date(fechaStr);
  if (isNaN(d.getTime())) return '';
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

// ==========================================
// CONSULTA Y CLASIFICACIÓN DE DATOS
// ==========================================

async function cargarDatos() {
  let { data: todos, error } = await supabase.from('bitacora').select('*').order('id', { ascending: false });

  if (error || !todos) {
    const resp2 = await supabase.from('bitacora_asistencia').select('*').order('id', { ascending: false });
    todos = resp2.data || [];
  }

  const registros = todos || [];

  listaAsistencias = [];
  listaNovedades = [];

  registros.forEach(item => {
    const foto = extraerImagen(item);
    const esNovedad = foto !== null || item.ubicacion || item.sector || item.asunto;

    if (esNovedad) {
      listaNovedades.push(item);
    } else {
      listaAsistencias.push(item);
    }
  });

  renderTablaAsistencias(listaAsistencias);
  renderTablaNovedades(listaNovedades);
}

// ==========================================
// RENDER ASISTENCIA
// ==========================================

function renderTablaAsistencias(datos) {
  const tbody = document.getElementById('tbodyAsistencia');
  if (!tbody) return;

  if (!datos || datos.length === 0) {
    tbody.innerHTML = `<tr><td colspan="7" class="text-center text-warning fw-bold py-4">No hay asistencias registradas.</td></tr>`;
    return;
  }

  tbody.innerHTML = datos.map(item => {
    const fEntrada = item.fecha_hora_entrada || item.hora_ingreso || item.created_at;
    const hEntrada = fEntrada ? new Date(fEntrada).toLocaleString('es-EC') : '---';

    const fSalida = item.fecha_hora_salida || item.hora_salida;
    let hSalida = '---';

    if (fSalida && fSalida !== null && fSalida !== '') {
      hSalida = `<span class="badge badge-estado-salida"><i class="fa-solid fa-check me-1"></i>${new Date(fSalida).toLocaleString('es-EC')}</span>`;
    } else {
      hSalida = `<span class="badge badge-estado-dentro"><i class="fa-solid fa-clock me-1"></i>DENTRO DEL CLUB</span>`;
    }

    const nombre = item.socio_visitante || item.nombre || 'Sin Nombre';
    const cedula = item.cedula || '---';
    const destino = limpiarTexto(item.destino) || 'Instalaciones';
    const observacion = limpiarTexto(item.observaciones || item.observacion || item.detalle) || 'Sin observaciones';

    return `
      <tr>
        <td class="fw-semibold">${hEntrada}</td>
        <td>${hSalida}</td>
        <td><strong>${nombre}</strong></td>
        <td class="text-danger fw-bold">${cedula}</td>
        <td>${destino}</td>
        <td class="text-muted">${observacion}</td>
        <td class="text-center no-export">
          <button class="btn btn-warning btn-sm btn-editar py-0 px-2 me-1" data-id="${item.id}" title="Editar"><i class="fa-solid fa-pen-to-square"></i></button>
          <button class="btn btn-danger btn-sm btn-eliminar py-0 px-2" data-id="${item.id}" title="Eliminar"><i class="fa-solid fa-trash"></i></button>
        </td>
      </tr>
    `;
  }).join('');

  document.querySelectorAll('#tbodyAsistencia .btn-editar').forEach(btn => {
    btn.addEventListener('click', (e) => abrirModalEditar(e.currentTarget.getAttribute('data-id')));
  });

  document.querySelectorAll('#tbodyAsistencia .btn-eliminar').forEach(btn => {
    btn.addEventListener('click', (e) => eliminarRegistro(e.currentTarget.getAttribute('data-id')));
  });
}

// ==========================================
// RENDER NOVEDADES
// ==========================================

function renderTablaNovedades(datos) {
  const tbody = document.getElementById('tbodyNovedades');
  if (!tbody) return;

  if (!datos || datos.length === 0) {
    tbody.innerHTML = `<tr><td colspan="6" class="text-center text-warning fw-bold py-4">No hay novedades registradas.</td></tr>`;
    return;
  }

  tbody.innerHTML = datos.map(item => {
    const fecha = item.fecha_hora_entrada || item.created_at || item.fecha;
    const fStr = fecha ? new Date(fecha).toLocaleString('es-EC') : '---';

    const asunto = limpiarTexto(item.asunto || item.socio_visitante) || 'Novedad Reportada';
    
    let ubi = limpiarTexto(item.ubicacion || item.sector || item.destino);
    if (!ubi) ubi = 'Cancha tres';

    let detalle = limpiarTexto(item.observaciones || item.detalle || item.novedades);
    if (!detalle) detalle = 'Sin detalle reportado';

    const foto = extraerImagen(item);
    const imgHtml = foto 
      ? `<img src="${foto}" class="img-novedad-fila btn-ver-img" data-src="${foto}" alt="Foto Novedad">`
      : `<span class="badge bg-secondary">Sin Imagen</span>`;

    return `
      <tr>
        <td class="fw-semibold">${fStr}</td>
        <td><strong style="font-size: 1.05rem;">${asunto}</strong></td>
        <td><span class="badge bg-danger fs-6 px-3 py-2">${ubi}</span></td>
        <td class="text-secondary">${detalle}</td>
        <td class="text-center py-2">${imgHtml}</td>
        <td class="text-center no-export">
          <button class="btn btn-danger btn-sm btn-eliminar-nov py-0 px-2" data-id="${item.id}" title="Eliminar"><i class="fa-solid fa-trash"></i></button>
        </td>
      </tr>
    `;
  }).join('');

  document.querySelectorAll('.btn-ver-img').forEach(img => {
    img.addEventListener('click', (e) => {
      const src = e.currentTarget.getAttribute('data-src');
      document.getElementById('imgModalSrc').src = src;
      new bootstrap.Modal(document.getElementById('modalImagen')).show();
    });
  });

  document.querySelectorAll('.btn-eliminar-nov').forEach(btn => {
    btn.addEventListener('click', (e) => eliminarRegistro(e.currentTarget.getAttribute('data-id')));
  });
}

// ==========================================
// FILTROS, EDITAR Y ELIMINAR
// ==========================================

function aplicarFiltrosAsistencia() {
  const fechaVal = document.getElementById('filtroFechaAsistencia')?.value;
  const textoVal = document.getElementById('filtroTextoAsistencia')?.value?.toLowerCase().trim();

  let resultado = [...listaAsistencias];

  if (fechaVal) {
    resultado = resultado.filter(item => {
      const f = item.fecha_hora_entrada || item.hora_ingreso || item.created_at;
      return obtenerFechaLocalYYYYMMDD(f) === fechaVal;
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

function aplicarFiltrosNovedades() {
  const fechaVal = document.getElementById('filtroFechaNovedad')?.value;

  let resultado = [...listaNovedades];

  if (fechaVal) {
    resultado = resultado.filter(item => {
      const f = item.fecha_hora_entrada || item.created_at || item.fecha;
      return obtenerFechaLocalYYYYMMDD(f) === fechaVal;
    });
  }

  renderTablaNovedades(resultado);
}

function abrirModalEditar(id) {
  const reg = listaAsistencias.find(item => String(item.id) === String(id));
  if (!reg) return;

  document.getElementById('editId').value = reg.id;
  document.getElementById('editNombre').value = reg.socio_visitante || reg.nombre || '';
  document.getElementById('editCedula').value = reg.cedula || '';
  document.getElementById('editDestino').value = limpiarTexto(reg.destino) || '';
  document.getElementById('editObservacion').value = limpiarTexto(reg.observaciones || reg.observacion || reg.detalle) || '';

  new bootstrap.Modal(document.getElementById('modalEditarAsistencia')).show();
}

async function guardarCambiosAsistencia() {
  const id = document.getElementById('editId').value;
  const { error } = await supabase
    .from('bitacora')
    .update({
      socio_visitante: document.getElementById('editNombre').value,
      cedula: document.getElementById('editCedula').value,
      destino: document.getElementById('editDestino').value,
      observaciones: document.getElementById('editObservacion').value
    })
    .eq('id', id);

  if (error) {
    alert('Error al guardar cambios: ' + error.message);
  } else {
    const modalEl = document.getElementById('modalEditarAsistencia');
    const modal = bootstrap.Modal.getInstance(modalEl);
    if (modal) modal.hide();
    await cargarDatos();
  }
}

async function eliminarRegistro(id) {
  if (!confirm('¿Está seguro de eliminar este registro?')) return;

  const { error } = await supabase.from('bitacora').delete().eq('id', id);

  if (error) {
    alert('Error al eliminar registro: ' + error.message);
  } else {
    await cargarDatos();
  }
}

function activarTiempoReal() {
  supabase
    .channel('realtime-supervisor-v5')
    .on('postgres_changes', { event: '*', schema: 'public', table: 'bitacora' }, () => cargarDatos())
    .subscribe();
}

function exportarExcel(elementId, nombreArchivo) {
  const elemento = document.getElementById(elementId).cloneNode(true);
  elemento.querySelectorAll('.no-export').forEach(el => el.remove());
  
  const wb = XLSX.utils.table_to_book(elemento, { sheet: "Reporte" });
  XLSX.writeFile(wb, `${nombreArchivo}.xlsx`);
}

function exportarPDF(elementId, nombreArchivo) {
  const elemento = document.getElementById(elementId).cloneNode(true);
  elemento.querySelectorAll('.no-export').forEach(el => el.remove());

  const opt = {
    margin:       0.3,
    filename:     nombreArchivo,
    image:        { type: 'jpeg', quality: 0.98 },
    html2canvas:  { scale: 2 },
    jsPDF:        { unit: 'in', format: 'letter', orientation: 'landscape' }
  };

  html2pdf().set(opt).from(elemento).save();
}