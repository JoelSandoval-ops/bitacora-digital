import { supabase } from './supabase.js';

// Variables Globales del Módulo Admin
let usuariosGlobal = [];
let sedesGlobal = [];
let bitacoraGlobal = [];
let modalReset = null;

// Inicialización de la Aplicación al cargar el DOM
document.addEventListener('DOMContentLoaded', () => {
  // Inicializar componentes Bootstrap
  const modalEl = document.getElementById('modalResetPassword');
  if (modalEl) {
    modalReset = new bootstrap.Modal(modalEl);
  }

  // Cargar datos del usuario logueado en la cabecera
  const userLocal = JSON.parse(localStorage.getItem('user_bv') || '{}');
  if (userLocal.nombre) {
    const elNombre = document.getElementById('nombreAdmin');
    if (elNombre) elNombre.innerText = `Admin: ${userLocal.nombre}`;
  }

  // Carga inicial de datos
  cargarEstadisticas();
  cargarSedes();

  // Suscripción de Eventos para Navegación por Pestañas (Solo 3 pestañas)
  const tabDashboard = document.getElementById('tab-dashboard');
  const tabPersonal = document.getElementById('tab-personal');
  const tabSedesBitacora = document.getElementById('tab-sedes-bitacora');

  if (tabDashboard) {
    tabDashboard.addEventListener('click', cargarEstadisticas);
  }

  if (tabPersonal) {
    tabPersonal.addEventListener('click', () => {
      cargarSedes();
      cargarPersonal();
    });
  }

  if (tabSedesBitacora) {
    tabSedesBitacora.addEventListener('click', () => {
      cargarSedes();
      cargarBitacoraGlobal();
    });
  }

  // Escuchadores de Formularios y Botones
  const formUsuario = document.getElementById('formUsuario');
  if (formUsuario) formUsuario.addEventListener('submit', guardarUsuario);

  const formSede = document.getElementById('formSede');
  if (formSede) formSede.addEventListener('submit', guardarSede);

  const inputBuscar = document.getElementById('inputBuscarGlobal');
  if (inputBuscar) inputBuscar.addEventListener('keyup', filtrarBitacoraGlobal);

  const btnExportar = document.getElementById('btnExportar');
  if (btnExportar) btnExportar.addEventListener('click', exportarCSV);

  const btnConfirmarReset = document.getElementById('btnConfirmarResetClave');
  if (btnConfirmarReset) btnConfirmarReset.addEventListener('click', procesarResetClave);

  const btnCerrarSesion = document.getElementById('btnCerrarSesion');
  if (btnCerrarSesion) btnCerrarSesion.addEventListener('click', cerrarSesion);
});

// Función para Cerrar Sesión
function cerrarSesion() {
  localStorage.removeItem('user_bv');
  window.location.href = './index.html';
}

// ==========================================
// PESTAÑA 1: ESTADÍSTICAS & EFICIENCIA
// ==========================================
async function cargarEstadisticas() {
  try {
    const { data: bitacora, error: errBita } = await supabase
      .from('bitacora')
      .select('*')
      .order('hora_ingreso', { ascending: false });

    if (errBita) throw errBita;
    bitacoraGlobal = bitacora || [];

    const { data: usuarios, error: errUser } = await supabase
      .from('usuarios')
      .select('*');

    if (errUser) throw errUser;
    usuariosGlobal = usuarios || [];

    // Filtrar personal que opera en garita (Guardia / Supervisor)
    const personal = usuariosGlobal.filter(u => u.rol === 'GUARDIA' || u.rol === 'SUPERVISOR');
    
    const kpiAccesos = document.getElementById('kpiTotalAccesos');
    if (kpiAccesos) kpiAccesos.innerText = bitacoraGlobal.length;

    let inactivosCount = 0;
    const htmlTabla = personal.map(g => {
      const registrosGuardia = bitacoraGlobal.filter(b => b.registrado_por === g.nombre);
      const cantidad = registrosGuardia.length;
      let porcentaje = Math.min(cantidad * 10, 100);
      let estadoBadge = '<span class="badge bg-success">Excelente Uso</span>';

      if (porcentaje < 30) {
        inactivosCount++;
        estadoBadge = '<span class="badge bg-danger">Inactivo / Poco Uso</span>';
      } else if (porcentaje < 70) {
        estadoBadge = '<span class="badge bg-warning text-dark">Uso Moderado</span>';
      }

      return `
        <tr>
          <td class="fw-bold">${g.nombre} <small class="text-muted">(${g.rol})</small></td>
          <td>${g.sede || 'Sede Principal'}</td>
          <td><span class="fw-bold text-success">${cantidad}</span> registros</td>
          <td>${cantidad > 0 ? (cantidad * 12) + ' min' : '0 min'}</td>
          <td style="width: 200px;">
            <div class="progress progress-sm mb-1">
              <div class="progress-bar ${porcentaje < 30 ? 'bg-danger' : 'bg-success'}" style="width: ${porcentaje}%"></div>
            </div>
            <small class="text-muted">${porcentaje}% de uso estimado</small>
          </td>
          <td>${estadoBadge}</td>
        </tr>
      `;
    }).join('');

    const tablaEficiencia = document.getElementById('tablaEficienciaGuardias');
    if (tablaEficiencia) {
      tablaEficiencia.innerHTML = htmlTabla || '<tr><td colspan="6" class="text-center py-3">No hay personal registrado</td></tr>';
    }

    const kpiInactivos = document.getElementById('kpiInactivos');
    if (kpiInactivos) kpiInactivos.innerText = inactivosCount;

    const kpiEficiencia = document.getElementById('kpiEficiencia');
    if (kpiEficiencia) {
      kpiEficiencia.innerText = personal.length > 0 
        ? Math.round(((personal.length - inactivosCount) / personal.length) * 100) + '%' 
        : '100%';
    }

  } catch (err) {
    console.error("Error al cargar estadísticas:", err.message);
  }
}

// ==========================================
// PESTAÑA 2: CONTROL DE PERSONAL & ACCESOS
// ==========================================
async function cargarPersonal() {
  try {
    const { data: usuarios, error } = await supabase
      .from('usuarios')
      .select('*')
      .order('id', { ascending: true });

    if (error) throw error;
    usuariosGlobal = usuarios || [];

    const tbody = document.getElementById('tablaUsuarios');
    if (!tbody) return;

    tbody.innerHTML = usuariosGlobal.map(u => `
      <tr>
        <td class="fw-bold">${u.nombre}</td>
        <td><code>${u.usuario}</code></td>
        <td><span class="badge ${u.rol === 'SUPERVISOR' ? 'bg-warning text-dark' : (u.rol === 'ADMIN' ? 'bg-danger' : 'bg-success')}">${u.rol}</span></td>
        <td>${u.sede || 'Sin Asignar'}</td>
        <td class="text-end">
          <button class="btn btn-sm btn-outline-warning btn-reset-pass me-1" data-id="${u.id}" data-nombre="${u.nombre}">
            <i class="bi bi-key"></i> Clave
          </button>
          ${u.rol !== 'ADMIN' ? `
          <button class="btn btn-sm btn-outline-danger btn-eliminar-usr" data-id="${u.id}">
            <i class="bi bi-trash"></i>
          </button>` : ''}
        </td>
      </tr>
    `).join('');

    // Escuchadores dinámicos para botones de la tabla
    document.querySelectorAll('.btn-eliminar-usr').forEach(btn => {
      btn.addEventListener('click', (e) => eliminarUsuario(e.currentTarget.getAttribute('data-id')));
    });

    document.querySelectorAll('.btn-reset-pass').forEach(btn => {
      btn.addEventListener('click', (e) => abrirModalReset(
        e.currentTarget.getAttribute('data-id'), 
        e.currentTarget.getAttribute('data-nombre')
      ));
    });

  } catch (err) {
    console.error("Error al cargar personal:", err.message);
  }
}

async function guardarUsuario(e) {
  e.preventDefault();
  const payload = {
    nombre: document.getElementById('uNombre').value,
    usuario: document.getElementById('uUsuario').value,
    password: document.getElementById('uPassword').value,
    rol: document.getElementById('uRol').value,
    sede: document.getElementById('uSede').value
  };

  try {
    const { error } = await supabase.from('usuarios').insert([payload]);
    if (error) throw error;

    alert('¡Usuario registrado con éxito!');
    document.getElementById('formUsuario').reset();
    cargarPersonal();
  } catch (err) {
    alert('Error al guardar el usuario: ' + err.message);
  }
}

async function eliminarUsuario(id) {
  if (!confirm('¿Desea eliminar este usuario permanentemente?')) return;

  try {
    const { error } = await supabase.from('usuarios').delete().eq('id', id);
    if (error) throw error;

    alert('Usuario eliminado.');
    cargarPersonal();
  } catch (err) {
    alert('Error al eliminar usuario: ' + err.message);
  }
}

function abrirModalReset(id, nombre) {
  document.getElementById('resetUserId').value = id;
  document.getElementById('resetUserNombre').value = nombre;
  document.getElementById('resetNuevaClave').value = '';
  if (modalReset) modalReset.show();
}

async function procesarResetClave() {
  const id = document.getElementById('resetUserId').value;
  const nuevaClave = document.getElementById('resetNuevaClave').value.trim();

  if (!nuevaClave) return alert('Por favor ingrese la nueva contraseña.');

  try {
    const { error } = await supabase
      .from('usuarios')
      .update({ password: nuevaClave })
      .eq('id', id);

    if (error) throw error;

    alert('¡Contraseña actualizada con éxito!');
    if (modalReset) modalReset.hide();
  } catch (err) {
    alert('Error al actualizar contraseña: ' + err.message);
  }
}

// ==========================================
// PESTAÑA 3: GESTOR DE SEDES Y BITÁCORA GLOBAL
// ==========================================
async function cargarSedes() {
  try {
    const { data: sedes, error } = await supabase.from('sedes').select('*');
    if (error) throw error;
    sedesGlobal = sedes || [];

    // Sincronizar inmediatamente el combo desplegable de la Pestaña 2
    const selectSede = document.getElementById('uSede');
    if (selectSede) {
      selectSede.innerHTML = sedesGlobal.length > 0 
        ? sedesGlobal.map(s => `<option value="${s.nombre}">${s.nombre}</option>`).join('')
        : '<option value="">No hay sedes creadas</option>';
    }

    // Renderizar tabla de Sedes en Pestaña 3
    const tbody = document.getElementById('tablaSedes');
    if (tbody) {
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
    }

  } catch (err) {
    console.error("Error cargando sedes:", err.message);
  }
}

async function guardarSede(e) {
  e.preventDefault();
  const payload = {
    nombre: document.getElementById('sNombre').value,
    ubicacion: document.getElementById('sUbicacion').value,
    capacidad: document.getElementById('sCapacidad').value
  };

  try {
    const { error } = await supabase.from('sedes').insert([payload]);
    if (error) throw error;

    alert('¡Sede creada exitosamente y disponible para asignación!');
    document.getElementById('formSede').reset();
    cargarSedes();
  } catch (err) {
    alert('Error creando sede: ' + err.message);
  }
}

async function eliminarSede(id) {
  if (!confirm('¿Desea eliminar esta sede?')) return;
  try {
    const { error } = await supabase.from('sedes').delete().eq('id', id);
    if (error) throw error;
    cargarSedes();
  } catch (err) {
    alert('Error eliminando sede: ' + err.message);
  }
}

async function cargarBitacoraGlobal() {
  try {
    const { data, error } = await supabase
      .from('bitacora')
      .select('*')
      .order('hora_ingreso', { ascending: false });

    if (error) throw error;
    bitacoraGlobal = data || [];
    renderizarTablaBitacora(bitacoraGlobal);
  } catch (err) {
    console.error("Error al cargar bitácora:", err.message);
  }
}

function renderizarTablaBitacora(lista) {
  const tbody = document.getElementById('tablaBitacoraGlobal');
  if (!tbody) return;

  tbody.innerHTML = lista.map(b => `
    <tr>
      <td>${b.hora_ingreso ? new Date(b.hora_ingreso).toLocaleString() : 'N/A'}</td>
      <td><span class="badge bg-secondary">${b.tipo_visita || 'VISITA'}</span></td>
      <td class="fw-bold">${b.nombre_visitante || 'Anónimo'}</td>
      <td><code>${b.placa || b.cedula || 'N/A'}</code></td>
      <td>${b.destino || 'Club'}</td>
      <td>${b.registrado_por || 'Garita'}</td>
    </tr>
  `).join('');
}

function filtrarBitacoraGlobal() {
  const query = document.getElementById('inputBuscarGlobal').value.toLowerCase();
  const filtrados = bitacoraGlobal.filter(b => 
    (b.nombre_visitante || '').toLowerCase().includes(query) ||
    (b.placa || '').toLowerCase().includes(query) ||
    (b.registrado_por || '').toLowerCase().includes(query)
  );
  renderizarTablaBitacora(filtrados);
}

function exportarCSV() {
  if (bitacoraGlobal.length === 0) {
    return alert('No hay datos en la bitácora para exportar.');
  }

  let csv = 'Fecha,Tipo,Nombre,Placa_CI,Destino,Registrado_Por\n';
  bitacoraGlobal.forEach(b => {
    csv += `"${b.hora_ingreso}","${b.tipo_visita}","${b.nombre_visitante}","${b.placa || b.cedula}","${b.destino}","${b.registrado_por}"\n`;
  });

  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
  const url = window.URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `bitacora_buenavista_${new Date().toISOString().slice(0,10)}.csv`;
  a.click();
}