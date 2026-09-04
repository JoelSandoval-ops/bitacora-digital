import { createClient } from 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/+esm';

const SUPABASE_URL = 'https://irdgnyqomuwajsezswal.supabase.co';
const SUPABASE_ANON_KEY = 'sb_publishable_dHiFIWqRS9XAedJLYMdeew_XVQUYDvp';

const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

let listaAsistencias = [];

document.addEventListener('DOMContentLoaded', async () => {
  await cargarDatos();
  activarTiempoReal();
  configurarEventos();
});

function configurarEventos() {
  // Actualizar datos
  document.querySelectorAll('.btn-actualizar').forEach(btn => {
    btn.addEventListener('click', () => cargarDatos());
  });

  // Filtros de Asistencia
  const inputFecha = document.getElementById('filtroFechaAsistencia');
  const inputTexto = document.getElementById('filtroTextoAsistencia');
  const btnVerTodo = document.getElementById('btnVerTodoAsistencia');

  if (inputFecha) inputFecha.addEventListener('change', aplicarFiltrosAsistencia);
  if (inputTexto) inputTexto.addEventListener('input', aplicarFiltrosAsistencia);
  if (btnVerTodo) {
    btnVerTodo.addEventListener('click', () => {
      if (inputFecha) inputFecha.value = '';
      if (inputTexto) inputTexto.value = '';
      renderTablaAsistencias(listaAsistencias);
    });
  }

  // Exportar Excel y PDF
  const btnExcel = document.getElementById('btnExcelAsistencia');
  const btnPDF = document.getElementById('btnPDFAsistencia');
  if (btnExcel) btnExcel.addEventListener('click', () => exportarExcel('areaPDFAsistencia', 'Asistencia_Club_Buena_Vista'));
  if (btnPDF) btnPDF.addEventListener('click', () => exportarPDF('areaPDFAsistencia', 'Asistencia_Club_Buena_Vista.pdf'));

  // Guardar Cambios de Edición
  const formEditar = document.getElementById('formEditarAsistencia');
  if (formEditar) {
    formEditar.addEventListener('submit', async (e) => {
      e.preventDefault();
      await guardarCambiosAsistencia();
    });
  }

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
// CONSULTA DE DATOS
// ==========================================

async function cargarDatos() {
  let { data: todos, error } = await supabase.from('bitacora').select('*').order('id', { ascending: false });

  if (error || !todos) {
    const resp2 = await supabase.from('bitacora_asistencia').select('*').order('id', { ascending: false });
    todos = resp2.data || [];
  }

  const registros = todos || [];

  // Filtrado exclusivo de asistencias
  listaAsistencias = registros.filter(item => {
    const destinoStr = String(item.destino || '');
    const obsStr = String(item.observaciones || item.novedades || item.detalle || '');
    const fotoStr = String(item.imagen_url || item.foto_url || item.foto || '');

    const esNovedad = destinoStr.startsWith('data:image') || 
                      obsStr.startsWith('data:image') || 
                      fotoStr.startsWith('data:image') ||
                      fotoStr.length > 50 ||
                      item.ubicacion || 
                      item.sector;

    return !esNovedad;
  });

  renderTablaAsistencias(listaAsistencias);
}

// ==========================================
// RENDERIZADO Y ACCIONES CRUD
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
    let destino = item.destino || 'Instalaciones';
    if (String(destino).startsWith('data:image')) destino = 'Instalaciones';

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
        <td class="text-center no-export">
          <button class="btn btn-warning btn-sm btn-editar py-0 px-2 me-1" data-id="${item.id}" title="Editar"><i class="fa-solid fa-pen-to-square"></i></button>
          <button class="btn btn-danger btn-sm btn-eliminar py-0 px-2" data-id="${item.id}" title="Eliminar"><i class="fa-solid fa-trash"></i></button>
        </td>
      </tr>
    `;
  }).join('');

  // Vincular eventos de editar y eliminar
  document.querySelectorAll('.btn-editar').forEach(btn => {
    btn.addEventListener('click', (e) => abrirModalEditar(e.currentTarget.getAttribute('data-id')));
  });

  document.querySelectorAll('.btn-eliminar').forEach(btn => {
    btn.addEventListener('click', (e) => eliminarRegistro(e.currentTarget.getAttribute('data-id')));
  });
}

function abrirModalEditar(id) {
  const reg = listaAsistencias.find(item => String(item.id) === String(id));
  if (!reg) return;

  document.getElementById('editId').value = reg.id;
  document.getElementById('editNombre').value = reg.socio_visitante || reg.nombre || '';
  document.getElementById('editCedula').value = reg.cedula || '';
  document.getElementById('editDestino').value = reg.destino || '';
  document.getElementById('editObservacion').value = reg.observaciones || reg.observacion || reg.detalle || '';

  const modal = new bootstrap.Modal(document.getElementById('modalEditarAsistencia'));
  modal.show();
}

async function guardarCambiosAsistencia() {
  const id = document.getElementById('editId').value;
  const nombre = document.getElementById('editNombre').value;
  const cedula = document.getElementById('editCedula').value;
  const destino = document.getElementById('editDestino').value;
  const observaciones = document.getElementById('editObservacion').value;

  const { error } = await supabase
    .from('bitacora')
    .update({
      socio_visitante: nombre,
      cedula: cedula,
      destino: destino,
      observaciones: observaciones
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
  if (!confirm('¿Está seguro de eliminar este registro de asistencia?')) return;

  const { error } = await supabase
    .from('bitacora')
    .delete()
    .eq('id', id);

  if (error) {
    alert('Error al eliminar registro: ' + error.message);
  } else {
    await cargarDatos();
  }
}

// ==========================================
// FILTROS Y EXPORTACIONES
// ==========================================

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
    .channel('realtime-supervisor-crud')
    .on('postgres_changes', { event: '*', schema: 'public', table: 'bitacora' }, () => cargarDatos())
    .subscribe();
}

function exportarExcel(elementId, nombreArchivo) {
  const elemento = document.getElementById(elementId).cloneNode(true);
  elemento.querySelectorAll('.no-export').forEach(el => el.remove());
  
  const wb = XLSX.utils.table_to_book(elemento, { sheet: "Asistencia" });
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