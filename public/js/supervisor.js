import { createClient } from 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/+esm';

const SUPABASE_URL = 'https://irdgnyqomuwajsezswal.supabase.co';
const SUPABASE_ANON_KEY = 'sb_publishable_dHiFIWqRS9XAedJLYMdeew_XVQUYDvp';

const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

let listaAsistencias = [];
let listaNovedades = [];

document.addEventListener('DOMContentLoaded', async () => {
  console.log("🔍 [SUPERVISOR] Cargando modulo...");
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
      renderTarjetasNovedades(listaNovedades);
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

async function cargarDatos() {
  let { data: todos, error } = await supabase.from('bitacora').select('*').order('id', { ascending: false });

  if (error || !todos) {
    const resp2 = await supabase.from('bitacora_asistencia').select('*').order('id', { ascending: false });
    todos = resp2.data || [];
  }

  const registros = todos || [];

  // Filtrado de Novedades
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

  // Filtrado de Asistencias
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
  renderTarjetasNovedades(listaNovedades);
}

// ==========================================
// RENDER ASISTENCIAS
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

    if (String(destino).startsWith('data:image')) destino = 'Instalaciones';

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
// RENDER NOVEDADES CON DISEÑO DISEÑO EXACTO
// ==========================================
function renderTarjetasNovedades(datos) {
  const contenedor = document.getElementById('contenedorNovedades');
  if (!contenedor) return;

  if (!datos || datos.length === 0) {
    contenedor.innerHTML = `<div class="text-center text-muted py-4 fw-bold">No hay novedades registradas.</div>`;
    return;
  }

  contenedor.innerHTML = datos.map(item => {
    // Fecha y hora
    const fecha = item.fecha_registro || item.fecha_hora || item.fecha_hora_entrada || item.created_at;
    const hFecha = fecha ? new Date(fecha).toLocaleString('es-EC') : '---';

    // Sector / Ubicacion
    const sector = item.ubicacion || item.sector || item.lugar || 'Porteria';

    // Asunto / Novedad
    let asunto = item.asunto || item.socio_visitante || item.novedad || 'Novedad Reportada';
    if (String(asunto).startsWith('data:image')) asunto = 'Novedad Reportada';

    // Detalle / Observacion
    let detalle = item.detalle || item.observaciones || item.descripcion || 'Sin detalle escrito';
    if (String(detalle).startsWith('data:image')) detalle = 'Sin detalle escrito';

    // Recuperar foto
    let foto = item.imagen_url || item.foto_url || item.foto || '';
    if (!foto && String(item.destino).startsWith('data:image')) foto = item.destino;
    if (!foto && String(item.observaciones).startsWith('data:image')) foto = item.observaciones;

    const fotoHTML = foto 
      ? `<img src="${foto}" class="img-novedad-card ver-foto-btn" data-url="${foto}" alt="Evidencia Novedad" title="Clic para ampliar">`
      : `<div class="sin-foto-box"><i class="fa-regular fa-image me-2"></i> - Sin Foto -</div>`;

    return `
      <div class="novedad-card">
        <div class="row g-0 align-items-center">
          
          <!-- COLUMNA IZQUIERDA (DATOS CON ENCABEZADOS NEGROS) -->
          <div class="col-md-8 col-lg-8 border-end">
            
            <!-- BLOQUE 1: FECHA Y ASUNTO -->
            <div class="row g-0 novedad-header-row">
              <div class="col-6">Fecha y Hora</div>
              <div class="col-6">Asunto / Novedad</div>
            </div>
            <div class="row g-0 novedad-content-row border-bottom">
              <div class="col-6 fw-semibold">${hFecha}</div>
              <div class="col-6 fw-bold text-dark">${asunto}</div>
            </div>

            <!-- BLOQUE 2: UBICACIÓN Y DETALLE -->
            <div class="row g-0 novedad-header-row">
              <div class="col-6">Ubicación / Sector</div>
              <div class="col-6">Detalle / Observación</div>
            </div>
            <div class="row g-0 novedad-content-row">
              <div class="col-6">
                <span class="badge-sector-red">${sector}</span>
              </div>
              <div class="col-6 text-secondary" style="white-space: pre-line;">${detalle}</div>
            </div>

          </div>

          <!-- COLUMNA DERECHA (IMAGEN GIGANTE A LA DERECHA) -->
          <div class="col-md-4 col-lg-4 text-center p-3 d-flex justify-content-center align-items-center bg-light">
            <div>
              <div class="fw-bold mb-2 text-dark d-md-none">Imagen / Evidencia</div>
              ${fotoHTML}
            </div>
          </div>

        </div>
      </div>
    `;
  }).join('');

  // Evento modal para fotos
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

  renderTarjetasNovedades(resultado);
}

function activarTiempoReal() {
  supabase
    .channel('realtime-supervisor-v6')
    .on('postgres_changes', { event: '*', schema: 'public', table: 'bitacora' }, () => cargarDatos())
    .subscribe();
}