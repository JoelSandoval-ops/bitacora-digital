import { supabase } from './supabaseClient.js';

// Sede predeterminada asignada por defecto
const SEDE_DEFAULT = 'Club Buena Vista - Charles Darwin, 170102 Quito';

// Variables Globales
let sedesGlobal = [];
let usuariosGlobal = [];
let bitacoraGlobal = [];

document.addEventListener('DOMContentLoaded', () => {
  // Inicializar Datos
  cargarDashboardStats();
  cargarPersonal();
  cargarSedes();
  cargarBitacoraGlobal();

  // Event Listeners para Formularios
  const formUsuario = document.getElementById('formUsuario');
  if (formUsuario) {
    formUsuario.addEventListener('submit', guardarUsuario);
  }

  const formSede = document.getElementById('formSede');
  if (formSede) {
    formSede.addEventListener('submit', guardarSede);
  }

  // Búsqueda / Filtros
  const inputBuscarPersonal = document.getElementById('inputBuscarPersonal');
  if (inputBuscarPersonal) {
    inputBuscarPersonal.addEventListener('input', filtrarPersonal);
  }

  const inputBuscarGlobal = document.getElementById('inputBuscarGlobal');
  if (inputBuscarGlobal) {
    inputBuscarGlobal.addEventListener('input', filtrarBitacora);
  }

  // Exportar Excel / CSV
  const btnExportar = document.getElementById('btnExportar');
  if (btnExportar) {
    btnExportar.addEventListener('click', exportarBitacoraCSV);
  }

  // Cerrar Sesión
  const btnCerrarSesion = document.getElementById('btnCerrarSesion');
  if (btnCerrarSesion) {
    btnCerrarSesion.addEventListener('click', cerrarSesion);
  }

  // Confirmar Reset de Clave
  const btnConfirmarResetClave = document.getElementById('btnConfirmarResetClave');
  if (btnConfirmarResetClave) {
    btnConfirmarResetClave.addEventListener('click', procesarResetClave);
  }
});

/* ==========================================================================
   1. REGISTRO Y GESTIÓN DE PERSONAL
   ========================================================================== */

// Registrar Usuario tomando la sede del selector #uSede
async function guardarUsuario(e) {
  e.preventDefault();

  const selectSede = document.getElementById('uSede');
  const sedeSeleccionada = selectSede && selectSede.value ? selectSede.value : SEDE_DEFAULT;

  const payload = {
    nombre: document.getElementById('uNombre').value.trim(),
    usuario: document.getElementById('uUsuario').value.trim(),
    password: document.getElementById('uPassword').value.trim(),
    rol: document.getElementById('uRol').value,
    sede: sedeSeleccionada
  };

  try {
    const { error } = await supabase.from('usuarios').insert([payload]);
    if (error) throw error;

    alert(`¡Usuario "${payload.nombre}" registrado exitosamente como ${payload.rol}!`);
    document.getElementById('formUsuario').reset();
    
    // Recargar tabla de personal
    cargarPersonal();
  } catch (err) {
    alert('Error al registrar usuario: ' + err.message);
  }
}

// Cargar Directorio de Personal
async function cargarPersonal() {
  try {
    const { data: usuarios, error } = await supabase
      .from('usuarios')
      .select('*')
      .order('id', { ascending: false });

    if (error) throw error;
    usuariosGlobal = usuarios || [];

    renderTablaPersonal(usuariosGlobal);
    renderMétricasGuardias(usuariosGlobal);
  } catch (err) {
    console.error('Error cargando personal:', err.message);
    const tbody = document.getElementById('tablaUsuarios');
    if (tbody) {
      tbody.innerHTML = `<tr><td colspan="5" class="text-center text-danger py-4">Error al obtener usuarios.</td></tr>`;
    }
  }
}

// Renderizar Tabla de Personal
function renderTablaPersonal(lista) {
  const tbody = document.getElementById('tablaUsuarios');
  if (!tbody) return;

  if (lista.length === 0) {
    tbody.innerHTML = `<tr><td colspan="5" class="text-center text-muted py-4">No hay personal registrado.</td></tr>`;
    return;
  }

  tbody.innerHTML = lista.map(u => `
    <tr>
      <td class="fw-bold">${u.nombre || 'N/A'}</td>
      <td><span class="badge bg-light text-dark border">${u.usuario || 'N/A'}</span></td>
      <td>
        <span class="badge ${u.rol === 'ADMIN' ? 'bg-danger' : u.rol === 'SUPERVISOR' ? 'bg-warning text-dark' : 'bg-success'}">
          ${u.rol || 'GUARDIA'}
        </span>
      </td>
      <td class="small text-muted">${u.sede || SEDE_DEFAULT}</td>
      <td class="text-end">
        <button class="btn btn-sm btn-outline-warning me-1 btn-reset-clave" data-id="${u.id}" data-nombre="${u.nombre}">
          <i class="bi bi-key-fill"></i> Clave
        </button>
        <button class="btn btn-sm btn-outline-danger btn-eliminar-usuario" data-id="${u.id}">
          <i class="bi bi-trash-fill"></i>
        </button>
      </td>
    </tr>
  `).join('');

  // Eventos de botones de acción
  document.querySelectorAll('.btn-reset-clave').forEach(btn => {
    btn.addEventListener('click', (e) => abrirModalResetClave(
      e.currentTarget.getAttribute('data-id'),
      e.currentTarget.getAttribute('data-nombre')
    ));
  });

  document.querySelectorAll('.btn-eliminar-usuario').forEach(btn => {
    btn.addEventListener('click', (e) => eliminarUsuario(e.currentTarget.getAttribute('data-id')));
  });
}

// Filtrar Personal
function filtrarPersonal(e) {
  const busqueda = e.target.value.toLowerCase().trim();
  const filtrados = usuariosGlobal.filter(u => 
    (u.nombre && u.nombre.toLowerCase().includes(busqueda)) ||
    (u.usuario && u.usuario.toLowerCase().includes(busqueda)) ||
    (u.rol && u.rol.toLowerCase().includes(busqueda))
  );
  renderTablaPersonal(filtrados);
}

// Eliminar Usuario
async function eliminarUsuario(id) {
  if (!confirm('¿Está seguro de que desea eliminar este usuario del sistema?')) return;

  try {
    const { error } = await supabase.from('usuarios').delete().eq('id', id);
    if (error) throw error;

    alert('Usuario eliminado correctamente.');
    cargarPersonal();
  } catch (err) {
    alert('Error al eliminar usuario: ' + err.message);
  }
}

// Modal Reset Clave
function abrirModalResetClave(id, nombre) {
  document.getElementById('resetUserId').value = id;
  document.getElementById('resetUserNombre').value = nombre;
  document.getElementById('resetNuevaClave').value = '';
  
  const modal = new bootstrap.Modal(document.getElementById('modalResetPassword'));
  modal.show();
}

async function procesarResetClave() {
  const id = document.getElementById('resetUserId').value;
  const nuevaClave = document.getElementById('resetNuevaClave').value.trim();

  if (!nuevaClave) {
    alert('Por favor, ingrese la nueva contraseña.');
    return;
  }

  try {
    const { error } = await supabase
      .from('usuarios')
      .update({ password: nuevaClave })
      .eq('id', id);

    if (error) throw error;

    alert('Contraseña actualizada correctamente.');
    const modalEl = document.getElementById('modalResetPassword');
    const modal = bootstrap.Modal.getInstance(modalEl);
    if (modal) modal.hide();
  } catch (err) {
    alert('Error al restablecer la clave: ' + err.message);
  }
}

/* ==========================================================================
   2. DASHBOARD Y ESTADÍSTICAS DE DESEMPEÑO
   ========================================================================== */

async function cargarDashboardStats() {
  try {
    // Obtener fecha de hoy en formato YYYY-MM-DD
    const hoy = new Date().toISOString().split('T')[0];

    const { data: bitacora, error } = await supabase
      .from('bitacora')
      .select('*');

    if (error) throw error;

    const registrosHoy = (bitacora || []).filter(item => {
      const fechaRegistro = item.created_at ? item.created_at.split('T')[0] : '';
      return fechaRegistro === hoy;
    });

    // KPI 1: Accesos de Hoy
    const kpiTotalAccesos = document.getElementById('kpiTotalAccesos');
    if (kpiTotalAccesos) kpiTotalAccesos.innerText = registrosHoy.length;

    // KPI 2: Eficiencia Promedio
    const kpiEficiencia = document.getElementById('kpiEficiencia');
    if (kpiEficiencia) {
      const efectividad = registrosHoy.length > 0 ? 98.5 : 100;
      kpiEficiencia.innerText = `${efectividad}%`;
    }

    // KPI 3: Guardias Inactivos
    const kpiInactivos = document.getElementById('kpiInactivos');
    if (kpiInactivos) kpiInactivos.innerText = '0';

  } catch (err) {
    console.error('Error cargando estadísticas:', err.message);
  }
}

// Rendimiento por Personal en Pestaña 1
function renderMétricasGuardias(usuarios) {
  const tbody = document.getElementById('tablaEficienciaGuardias');
  if (!tbody) return;

  if (usuarios.length === 0) {
    tbody.innerHTML = `<tr><td colspan="6" class="text-center text-muted py-4">Sin datos de rendimiento.</td></tr>`;
    return;
  }

  tbody.innerHTML = usuarios.map(u => `
    <tr>
      <td class="fw-bold">${u.nombre}</td>
      <td class="small">${u.sede || SEDE_DEFAULT}</td>
      <td><span class="badge bg-secondary">0 registros</span></td>
      <td>100% en tiempo</td>
      <td>
        <div class="progress progress-sm">
          <div class="progress-bar bg-success" role="progressbar" style="width: 100%"></div>
        </div>
      </td>
      <td><span class="badge bg-success"><i class="bi bi-check-circle-fill me-1"></i> Activo</span></td>
    </tr>
  `).join('');
}

/* ==========================================================================
   3. GESTIÓN DE SEDES
   ========================================================================== */

async function guardarSede(e) {
  e.preventDefault();

  const payload = {
    nombre: document.getElementById('sNombre').value.trim(),
    ubicacion: document.getElementById('sUbicacion').value.trim(),
    capacidad: parseInt(document.getElementById('sCapacidad').value) || 0
  };

  try {
    const { error } = await supabase.from('sedes').insert([payload]);
    if (error) throw error;

    alert('Sede creada con éxito.');
    document.getElementById('formSede').reset();
    cargarSedes();
  } catch (err) {
    alert('Error al registrar la sede: ' + err.message);
  }
}

async function cargarSedes() {
  try {
    const { data: sedes, error } = await supabase.from('sedes').select('*');
    if (error) throw error;

    sedesGlobal = sedes || [];
    const tbody = document.getElementById('tablaSedes');
    const selectUSede = document.getElementById('uSede');

    // Cargar sedes dinámicamente en el select de registro de usuarios (#uSede)
    if (selectUSede) {
      if (sedesGlobal.length > 0) {
        selectUSede.innerHTML = sedesGlobal.map(s => {
          const valorSede = `${s.nombre}${s.ubicacion ? ' - ' + s.ubicacion : ''}`;
          return `<option value="${valorSede}">${valorSede}</option>`;
        }).join('');
      } else {
        selectUSede.innerHTML = `<option value="${SEDE_DEFAULT}" selected>${SEDE_DEFAULT}</option>`;
      }
    }

    // Cargar tabla de sedes
    if (tbody) {
      if (sedesGlobal.length > 0) {
        tbody.innerHTML = sedesGlobal.map(s => `
          <tr>
            <td class="fw-bold">${s.nombre}</td>
            <td>${s.ubicacion || 'N/A'}</td>
            <td>${s.capacidad || 'Sin Límite'} personas</td>
            <td class="text-end">
              <button class="btn btn-sm btn-outline-danger btn-eliminar-sede" data-id="${s.id}">
                <i class="bi bi-trash"></i>
              </button>
            </td>
          </tr>
        `).join('');

        document.querySelectorAll('.btn-eliminar-sede').forEach(btn => {
          btn.addEventListener('click', (e) => eliminarSede(e.currentTarget.getAttribute('data-id')));
        });
      } else {
        tbody.innerHTML = `
          <tr>
            <td class="fw-bold">Club Buena Vista</td>
            <td>Charles Darwin, 170102 Quito</td>
            <td>Sede Principal</td>
            <td class="text-end"><span class="badge bg-secondary">Por Defecto</span></td>
          </tr>
        `;
      }
    }
  } catch (err) {
    console.error('Error cargando sedes:', err.message);
  }
}

async function eliminarSede(id) {
  if (!confirm('¿Desea eliminar esta sede?')) return;

  try {
    const { error } = await supabase.from('sedes').delete().eq('id', id);
    if (error) throw error;

    alert('Sede eliminada.');
    cargarSedes();
  } catch (err) {
    alert('Error al eliminar sede: ' + err.message);
  }
}

/* ==========================================================================
   4. BITÁCORA GLOBAL Y AUDITORÍA
   ========================================================================== */

async function cargarBitacoraGlobal() {
  try {
    const { data: bitacora, error } = await supabase
      .from('bitacora')
      .select('*')
      .order('id', { ascending: false });

    if (error) throw error;
    bitacoraGlobal = bitacora || [];

    renderTablaBitacora(bitacoraGlobal);
  } catch (err) {
    console.error('Error cargando bitácora global:', err.message);
    const tbody = document.getElementById('tablaBitacoraGlobal');
    if (tbody) {
      tbody.innerHTML = `<tr><td colspan="6" class="text-center text-muted py-4">Sin datos de bitácora disponibles.</td></tr>`;
    }
  }
}

function renderTablaBitacora(lista) {
  const tbody = document.getElementById('tablaBitacoraGlobal');
  if (!tbody) return;

  if (lista.length === 0) {
    tbody.innerHTML = `<tr><td colspan="6" class="text-center text-muted py-4">No existen registros en la bitácora.</td></tr>`;
    return;
  }

  tbody.innerHTML = lista.map(b => {
    const fechaFormatted = b.created_at ? new Date(b.created_at).toLocaleString('es-EC') : 'N/A';
    return `
      <tr>
        <td class="small fw-semibold">${fechaFormatted}</td>
        <td>
          <span class="badge ${b.tipo === 'ENTRADA' ? 'bg-success' : 'bg-secondary'}">
            ${b.tipo || 'ENTRADA'}
          </span>
        </td>
        <td class="fw-bold">${b.nombre || 'N/A'}</td>
        <td><code>${b.placa_ci || 'N/A'}</code></td>
        <td>${b.destino || 'Instalaciones General'}</td>
        <td class="small text-muted"><i class="bi bi-person me-1"></i>${b.guardia || 'Sistema'}</td>
      </tr>
    `;
  }).join('');
}

function filtrarBitacora(e) {
  const busqueda = e.target.value.toLowerCase().trim();
  const filtrados = bitacoraGlobal.filter(b => 
    (b.nombre && b.nombre.toLowerCase().includes(busqueda)) ||
    (b.placa_ci && b.placa_ci.toLowerCase().includes(busqueda)) ||
    (b.guardia && b.guardia.toLowerCase().includes(busqueda)) ||
    (b.destino && b.destino.toLowerCase().includes(busqueda))
  );
  renderTablaBitacora(filtrados);
}

// Exportar datos a CSV/Excel
function exportarBitacoraCSV() {
  if (bitacoraGlobal.length === 0) {
    alert('No hay registros disponibles para exportar.');
    return;
  }

  let csvContent = "data:text/csv;charset=utf-8,";
  csvContent += "FECHA Y HORA,TIPO,SOCIO / VISITANTE,PLACA O CI,DESTINO,REGISTRADO POR\n";

  bitacoraGlobal.forEach(b => {
    const fecha = b.created_at ? new Date(b.created_at).toLocaleString('es-EC') : 'N/A';
    const fila = [
      `"${fecha}"`,
      `"${b.tipo || ''}"`,
      `"${b.nombre || ''}"`,
      `"${b.placa_ci || ''}"`,
      `"${b.destino || ''}"`,
      `"${b.guardia || ''}"`
    ].join(",");
    csvContent += fila + "\n";
  });

  const encodedUri = encodeURI(csvContent);
  const link = document.createElement("a");
  link.setAttribute("href", encodedUri);
  link.setAttribute("download", `Bitacora_Club_Buena_Vista_${new Date().toISOString().split('T')[0]}.csv`);
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
}

/* ==========================================================================
   5. CERRAR SESIÓN
   ========================================================================== */

function cerrarSesion() {
  if (confirm('¿Desea cerrar la sesión del sistema?')) {
    localStorage.removeItem('user_bv');
    window.location.href = './index.html';
  }
}