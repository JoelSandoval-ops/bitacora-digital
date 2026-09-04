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
  // Botones de actualización manual
  document.querySelectorAll('.btn-actualizar').forEach(btn => {
    btn.addEventListener('click', () => cargarDatos());
  });

  // Eventos de Filtro - Asistencia
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

  // Eventos de Filtro - Novedades
  const inputFechaNov = document.getElementById('filtroFechaNovedad');
  const btnVerTodoNov = document.getElementById('btnVerTodoNovedad');

  if (inputFechaNov) inputFechaNov.addEventListener('change', aplicarFiltrosNovedades);
  if (btnVerTodoNov) {
    btnVerTodoNov.addEventListener('click', () => {
      if (inputFechaNov) inputFechaNov.value = '';
      renderTablaNovedades(listaNovedades);
    });
  }

  // Exportaciones a Excel
  document.getElementById('btnExcelAsistencia')?.addEventListener('click', () => {
    exportarExcel('areaPDFAsistencia', 'Bitacora_Asistencia_Club_Buena_Vista');
  });

  document.getElementById('btnExcelNovedad')?.addEventListener('click', () => {
    exportarExcel('areaPDFNovedad', 'Bitacora_Novedades_Club_Buena_Vista');
  });

  // Exportaciones a PDF con Membrete Oficial y Título Dinámico
  document.getElementById('btnPDFAsistencia')?.addEventListener('click', () => {
    exportarPDF({
      tituloReporte: 'BITÁCORA DE ASISTENCIA',
      idContenedorTabla: 'areaPDFAsistencia',
      nombreArchivo: 'Bitacora_Asistencia_Club_Buena_Vista.pdf'
    });
  });

  document.getElementById('btnPDFNovedad')?.addEventListener('click', () => {
    exportarPDF({
      tituloReporte: 'BITÁCORA DE NOVEDADES',
      idContenedorTabla: 'areaPDFNovedad',
      nombreArchivo: 'Bitacora_Novedades_Club_Buena_Vista.pdf'
    });
  });

  // Formulario de edición
  document.getElementById('formEditarAsistencia')?.addEventListener('submit', async (e) => {
    e.preventDefault();
    await guardarCambiosAsistencia();
  });

  // Cierre de Sesión
  document.getElementById('btnSalir')?.addEventListener('click', async () => {
    await supabase.auth.signOut();
    window.location.href = './login.html';
  });
}

function extraerImagen(item) {
  const campos = [item.imagen_url, item.foto_url, item.foto, item.destino, item.ubicacion, item.observaciones, item.detalle, item.novedades];
  for (let c of campos) {
    if (typeof c === 'string' && (c.startsWith('data:image') || c.startsWith('http') || c.length > 200)) {
      return c;
    }
  }
  return null;
}

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
      hSalida = `<span class="badge bg-success p-2">${new Date(fSalida).toLocaleString('es-EC')}</span>`;
    } else {
      hSalida = `<span class="badge bg-warning text-dark p-2">DENTRO DEL CLUB</span>`;
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
          <button class="btn btn-warning btn-sm btn-editar py-0 px-2 me-1" data-id="${item.id}"><i class="fa-solid fa-pen-to-square"></i></button>
          <button class="btn btn-danger btn-sm btn-eliminar py-0 px-2" data-id="${item.id}"><i class="fa-solid fa-trash"></i></button>
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
    if (!ubi) ubi = 'General';

    let detalle = limpiarTexto(item.observaciones || item.detalle || item.novedades);
    if (!detalle) detalle = 'Sin detalle reportado';

    const foto = extraerImagen(item);
    const imgHtml = foto 
      ? `<img src="${foto}" class="img-card-frame btn-ver-img" data-src="${foto}" alt="Imagen Novedad">`
      : `<span class="badge bg-secondary">Sin Imagen</span>`;

    return `
      <tr>
        <td class="fw-bold">${fStr}</td>
        <td class="fw-bold text-dark">${asunto}</td>
        <td><span class="badge bg-light text-dark border">${ubi}</span></td>
        <td class="text-secondary fw-semibold">${detalle}</td>
        <td class="text-center py-2">${imgHtml}</td>
        <td class="text-center no-export">
          <button class="btn-delete-custom btn-eliminar-nov" data-id="${item.id}"><i class="fa-solid fa-trash"></i></button>
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
    .channel('realtime-supervisor-v6')
    .on('postgres_changes', { event: '*', schema: 'public', table: 'bitacora' }, () => cargarDatos())
    .subscribe();
}

function exportarExcel(elementId, nombreArchivo) {
  const elemento = document.getElementById(elementId).cloneNode(true);
  elemento.querySelectorAll('.no-export').forEach(el => el.remove());
  
  const wb = XLSX.utils.table_to_book(elemento, { sheet: "Reporte" });
  XLSX.writeFile(wb, `${nombreArchivo}.xlsx`);
}

/**
  Genera PDF con el membrete institucional, título dinámico según pestaña y fecha de emisión
 */
function exportarPDF({ tituloReporte, idContenedorTabla, nombreArchivo }) {
  const elementoOriginal = document.getElementById(idContenedorTabla);
  
  if (!elementoOriginal) {
    alert(`No se encontró el contenido a exportar.`);
    return;
  }

  // Clonar el contenedor
  const clonContenedor = elementoOriginal.cloneNode(true);

  // Ocultar botones o elementos excluidos
  clonContenedor.querySelectorAll('.no-export').forEach(e => e.remove());

  // Ajuste visual de las imágenes para el reporte
  clonContenedor.querySelectorAll('img').forEach(img => {
    img.style.maxWidth = '100px';
    img.style.height = 'auto';
    img.style.borderRadius = '6px';
    img.style.border = '2px solid #C5A059';
  });

  // Estilizado directo sobre la tabla para asegurar legibilidad en el PDF
  const tabla = clonContenedor.querySelector('table');
  if (tabla) {
    tabla.style.width = '100%';
    tabla.style.borderCollapse = 'collapse';
    tabla.style.marginTop = '15px';
  }

  clonContenedor.querySelectorAll('th').forEach(th => {
    th.style.backgroundColor = '#2B2F38';
    th.style.color = '#FFFFFF';
    th.style.padding = '8px';
    th.style.fontSize = '11px';
    th.style.textAlign = 'left';
    th.style.border = '1px solid #444';
  });

  clonContenedor.querySelectorAll('td').forEach(td => {
    td.style.padding = '8px';
    td.style.fontSize = '10px';
    td.style.border = '1px solid #DDD';
    td.style.verticalAlign = 'middle';
  });

  // Fecha y hora de emisión oficial en tiempo real
  const fechaEmision = new Date().toLocaleString('es-EC', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit'
  });

  // Estructura completa del Membrete e Impresión
  const wrapperPDF = document.createElement('div');
  wrapperPDF.style.padding = '15px';
  wrapperPDF.style.backgroundColor = '#FFFFFF';
  wrapperPDF.style.fontFamily = "'Montserrat', sans-serif";

  wrapperPDF.innerHTML = `
    <div style="
      display: flex; 
      align-items: center; 
      justify-content: space-between; 
      background: linear-gradient(135deg, #0F3822 0%, #15803D 50%, #1E3A2B 100%);
      border-bottom: 4px solid #D4AF37;
      padding: 12px 18px;
      border-radius: 6px;
      margin-bottom: 15px;
    ">
      <div style="display: flex; align-items: center; gap: 12px;">
        <div style="
          width: 50px; 
          height: 50px; 
          border-radius: 50%; 
          background-color: #003816; 
          border: 2px solid #D4AF37; 
          display: flex; 
          align-items: center; 
          justify-content: center;
          flex-shrink: 0;
        ">
          <svg viewBox="0 0 100 100" width="38" height="38">
            <circle cx="50" cy="50" r="46" fill="#003816" stroke="#D4AF37" stroke-width="2"/>
            <g transform="rotate(-30 50 50)" stroke="#D4AF37" stroke-width="2.5" fill="none">
              <ellipse cx="50" cy="35" rx="14" ry="18" />
              <line x1="50" y1="53" x2="50" y2="82" stroke-width="3" />
              <line x1="45" y1="82" x2="55" y2="82" stroke-width="3" />
              <line x1="42" y1="35" x2="58" y2="35" stroke="#D4AF37" stroke-width="1" />
              <line x1="44" y1="27" x2="56" y2="27" stroke="#D4AF37" stroke-width="1" />
              <line x1="44" y1="43" x2="56" y2="43" stroke="#D4AF37" stroke-width="1" />
              <line x1="50" y1="18" x2="50" y2="51" stroke="#D4AF37" stroke-width="1" />
            </g>
            <g transform="rotate(30 50 50)" stroke="#D4AF37" stroke-width="2.5" fill="none">
              <ellipse cx="50" cy="35" rx="14" ry="18" />
              <line x1="50" y1="53" x2="50" y2="82" stroke-width="3" />
              <line x1="45" y1="82" x2="55" y2="82" stroke-width="3" />
              <line x1="42" y1="35" x2="58" y2="35" stroke="#D4AF37" stroke-width="1" />
              <line x1="44" y1="27" x2="56" y2="27" stroke="#D4AF37" stroke-width="1" />
              <line x1="44" y1="43" x2="56" y2="43" stroke="#D4AF37" stroke-width="1" />
              <line x1="50" y1="18" x2="50" y2="51" stroke="#D4AF37" stroke-width="1" />
            </g>
          </svg>
        </div>

        <div>
          <h2 style="
            margin: 0; 
            color: #FFFFFF; 
            font-family: 'Cinzel', serif; 
            font-size: 1.35rem; 
            font-weight: 800;
            line-height: 1.1;
          ">CLUB BUENA VISTA</h2>
          <div style="
            margin-top: 2px; 
            color: #D4AF37; 
            font-size: 0.82rem; 
            font-weight: 700;
            letter-spacing: 0.8px;
            text-transform: uppercase;
          ">${tituloReporte}</div>
        </div>
      </div>

      <div style="text-align: right; color: #FFFFFF; font-size: 0.72rem; line-height: 1.3;">
        <div style="color: #D4AF37; font-weight: 700; text-transform: uppercase;">Emisión Oficial</div>
        <div>${fechaEmision}</div>
      </div>
    </div>
  `;

  wrapperPDF.appendChild(clonContenedor);

  const opcionesExportacion = {
    margin:       [8, 8, 8, 8],
    filename:     nombreArchivo,
    image:        { type: 'jpeg', quality: 0.98 },
    html2canvas:  { scale: 2, useCORS: true, logging: false },
    jsPDF:        { unit: 'mm', format: 'a4', orientation: 'landscape' }
  };

  if (typeof html2pdf !== 'undefined') {
    html2pdf().set(opcionesExportacion).from(wrapperPDF).save();
  } else {
    alert('No se ha podido cargar la librería html2pdf.js.');
  }
}