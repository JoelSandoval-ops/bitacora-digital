import { supabase } from './supabaseClient.js';

const SEDE_DEFAULT = 'Club Buena Vista - Charles Darwin, 170102 Quito';

// Variables Globales
let usuariosGlobal = [];

document.addEventListener('DOMContentLoaded', () => {
  // Cargar datos al iniciar
  cargarPersonal();
  cargarDashboardStats();

  // Event Listeners
  const formUsuario = document.getElementById('formUsuario');
  if (formUsuario) {
    formUsuario.addEventListener('submit', guardarUsuario);
  }

  const inputBuscarPersonal = document.getElementById('inputBuscarPersonal');
  if (inputBuscarPersonal) {
    inputBuscarPersonal.addEventListener('input', filtrarPersonal);
  }

  const btnCerrarSesion = document.getElementById('btnCerrarSesion');
  if (btnCerrarSesion) {
    btnCerrarSesion.addEventListener('click', cerrarSesion);
  }

  const btnConfirmarResetClave = document.getElementById('btnConfirmarResetClave');
  if (btnConfirmarResetClave) {
    btnConfirmarResetClave.addEventListener('click', procesarResetClave);
  }
});

/* ==========================================================================
   1. REGISTRO Y CONEXIÓN DIRECTA CON PESTAÑA 2
   ========================================================================== */

async function guardarUsuario(e) {
  e.preventDefault();

  const btnSubmit = e.target.querySelector('button[type="submit"]');
  const textoOriginal = btnSubmit ? btnSubmit.innerHTML : '';

  if (btnSubmit) {
    btnSubmit.disabled = true;
    btnSubmit.innerHTML = '<span class="spinner-border spinner-border-sm me-2" role="status" aria-hidden="true"></span>Guardando...';
  }

  const payload = {
    nombre: document.getElementById('uNombre').value.trim(),
    usuario: document.getElementById('uUsuario').value.trim(),
    password: document.getElementById('uPassword').value.trim(),
    rol: document.getElementById('uRol').value,
    sede: SEDE_DEFAULT
  };

  try {
    // 1. Guardar en Supabase (Backup en la nube)
    const { data, error } = await supabase.from('usuarios').insert([payload]).select();
    if (error) throw error;

    const usuarioCreado = data && data.length > 0 ? data[0] : null;

    // 2. Limpiar el formulario
    document.getElementById('formUsuario').reset();

    // 3. Recargar la lista de usuarios
    await cargarPersonal();

    // 4. Cambiar automáticamente a la Pestaña 2 (Directorio)
    const tabDirectorioBtn = document.getElementById('tab-directorio');
    if (tabDirectorioBtn) {
      const bsTab = new bootstrap.Tab(tabDirectorioBtn);
      bsTab.show();
    }

    // 5. Resaltar la fila recién creada si existe en la tabla
    if (usuarioCreado) {
      setTimeout(() => {
        const filaNueva = document.querySelector(`tr[data-user-id="${usuarioCreado.id}"]`);
        if (filaNueva) {
          filaNueva.classList.add('table-success');
          filaNueva.scrollIntoView({ behavior: 'smooth', block: 'center' });
          setTimeout(() => filaNueva.classList.remove('table-success'), 3500);
        }
      }, 300);
    }

  } catch (err) {
    alert('Error al registrar usuario: ' + err.message);
  } finally {
    if (btnSubmit) {
      btnSubmit.disabled = false;
      btnSubmit.innerHTML = textoOriginal;
    }
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

// Renderizar Tabla de Personal en Pestaña 2
function renderTablaPersonal(lista) {
  const tbody = document.getElementById('tablaUsuarios');
  if (!tbody) return;

  if (lista.length === 0) {
    tbody.innerHTML = `<tr><td colspan="5" class="text-center text-muted py-4">No hay personal registrado.</td></tr>`;
    return;
  }

  tbody.innerHTML = lista.map(u => `
    <tr data-user-id="${u.id}" style="transition: background-color 0.5s ease;">
      <td class="fw-bold">${u.nombre || 'N/A'}</td>
      <td><span class="badge bg-light text-dark border">${u.usuario || 'N/A'}</span></td>
      <td>
        <span class="badge ${u.rol === 'ADMIN' ? 'bg-danger' : u.rol === 'SUPERVISOR' ? 'bg-warning text-dark' : 'bg-success'}">
          ${u.rol || 'GUARDIA'}
        </span>
      </td>
      <td><code class="text-dark bg-light px-2 py-1 rounded border">${u.password || '******'}</code></td>
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

  // Re-asignar eventos a los botones de acción
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

// Filtrar Personal en Pestaña 2
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
  if (!confirm('¿Está seguro de eliminar este usuario? Perderá el acceso al sistema.')) return;

  try {
    const { error } = await supabase.from('usuarios').delete().eq('id', id);
    if (error) throw error;

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
  
  const modalEl = document.getElementById('modalResetPassword');
  if (modalEl) {
    const modal = new bootstrap.Modal(modalEl);
    modal.show();
  }
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

    cargarPersonal();
  } catch (err) {
    alert('Error al restablecer clave: ' + err.message);
  }
}

/* ==========================================================================
   2. DASHBOARD Y ESTADÍSTICAS (PESTAÑA 3)
   ========================================================================== */

async function cargarDashboardStats() {
  try {
    const hoy = new Date().toISOString().split('T')[0];

    const { data: bitacora, error } = await supabase
      .from('bitacora')
      .select('*');

    if (error) throw error;

    const registrosHoy = (bitacora || []).filter(item => {
      const fechaRegistro = item.created_at ? item.created_at.split('T')[0] : '';
      return fechaRegistro === hoy;
    });

    const kpiTotalAccesos = document.getElementById('kpiTotalAccesos');
    if (kpiTotalAccesos) kpiTotalAccesos.innerText = registrosHoy.length;

    const kpiEficiencia = document.getElementById('kpiEficiencia');
    if (kpiEficiencia) {
      const efectividad = registrosHoy.length > 0 ? 98.5 : 100;
      kpiEficiencia.innerText = `${efectividad}%`;
    }

    const kpiInactivos = document.getElementById('kpiInactivos');
    if (kpiInactivos) kpiInactivos.innerText = '0';

  } catch (err) {
    console.error('Error cargando estadísticas:', err.message);
  }
}

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
      <td><span class="badge bg-secondary">${u.rol}</span></td>
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
   3. CERRAR SESIÓN
   ========================================================================== */

function cerrarSesion() {
  if (confirm('¿Desea cerrar la sesión del sistema?')) {
    localStorage.removeItem('user_bv');
    window.location.href = './index.html';
  }
}