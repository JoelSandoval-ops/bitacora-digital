import { supabase } from './supabase.js';
import { protegerVista, cerrarSesion } from './auth-guard.js';

let modalReset = null;
let bitacoraGlobal = [];

document.addEventListener('DOMContentLoaded', async () => {
  // 1. Verificar sesión de Admin con el Guardia de Seguridad
  const adminActivo = await protegerVista(['ADMIN', 'ADMINISTRADOR']);
  if (!adminActivo) return;

  // 2. Mostrar el nombre del Administrador en el encabezado
  const lblNombre = document.getElementById('nombreAdmin');
  if (lblNombre) {
    lblNombre.innerText = `Admin: ${adminActivo.nombre_completo || adminActivo.nombre || 'Master'}`;
  }

  // 3. Inicializar Bootstrap Modal de Reseteo de Claves
  const modalEl = document.getElementById('modalResetPassword');
  if (modalEl && window.bootstrap) {
    modalReset = new bootstrap.Modal(modalEl);
  }

  // 4. Asignar Event Listeners
  document.getElementById('btnCerrarSesion')?.addEventListener('click', cerrarSesion);
  document.getElementById('formUsuario')?.addEventListener('submit', registrarNuevoPersonal);
  document.getElementById('formSede')?.addEventListener('submit', guardarSede);
  document.getElementById('btnConfirmarResetClave')?.addEventListener('click', procesarResetClave);
  document.getElementById('inputBuscarGlobal')?.addEventListener('keyup', filtrarBitacoraGlobal);
  document.getElementById('btnExportar')?.addEventListener('click', exportarCSV);
  document.getElementById('btnRefrescarDanos')?.addEventListener('click', cargarReportesDanos);

  // Eventos de Pestañas
  document.getElementById('tab-dashboard')?.addEventListener('click', cargarEstadisticas);
  document.getElementById('tab-personal')?.addEventListener('click', cargarUsuarios);
  document.getElementById('tab-danos')?.addEventListener('click', cargarReportesDanos);
  document.getElementById('tab-sedes')?.addEventListener('click', cargarSedes);
  document.getElementById('tab-bitacora')?.addEventListener('click', cargarBitacoraGlobal);

  // 5. Carga Inicial de Datos
  cargarEstadisticas();
  cargarSedes();
  escucharNotificacionesRealtime();
});

/* ==========================================================================
   1. REGISTRO Y GESTIÓN DE PERSONAL (USUARIOS & CLAVES)
   ========================================================================== */

async function registrarNuevoPersonal(e) {
  e.preventDefault();

  const nombre = document.getElementById('uNombre').value.trim();
  const usuario = document.getElementById('uUsuario').value.trim();
  const password = document.getElementById('uPassword').value.trim();
  const rol = document.getElementById('uRol').value;
  const sede = document.getElementById('uSede').value;

  try {
    // Insertar directamente en la tabla personalizada 'usuarios'
    const { error: dbError } = await supabase
      .from('usuarios')
      .insert([{
        nombre: nombre,
        usuario: usuario,
        password: password,
        rol: rol,
        sede: sede
      }]);

    if (dbError) throw new Error('Error al guardar el usuario: ' + dbError.message);

    alert(`Usuario ${nombre} (${rol}) creado exitosamente.`);
    document.getElementById('formUsuario').reset();
    cargarUsuarios();

  } catch (err) {
    alert(err.message);
  }
}

export async function cargarUsuarios() {
  const tbody = document.getElementById('tablaUsuarios');
  if (!tbody) return;

  try {
    const { data: usuarios, error } = await supabase
      .from('usuarios')
      .select('*')
      .order('nombre', { ascending: true });

    if (error) throw error;

    if (!usuarios || usuarios.length === 0) {
      tbody.innerHTML = `<tr><td colspan="5" class="text-center py-4 text-muted">No hay usuarios registrados.</td></tr>`;
      return;
    }

    tbody.innerHTML = usuarios.map(u => `
      <tr>
        <td class="fw-bold">${u.nombre || ''}</td>
        <td><code>${u.usuario || ''}</code></td>
        <td><span class="badge ${u.rol === 'SUPERVISOR' ? 'bg-warning text-dark' : (u.rol === 'ADMIN' ? 'bg-danger' : 'bg-success')}">${u.rol || 'GUARDIA'}</span></td>
        <td>${u.sede || 'Sin Asignar'}</td>
        <td class="text-end">
          <button class="btn btn-sm btn-outline-warning me-1 btn-reset-pass" data-id="${u.id}" data-nombre="${u.nombre}">
            <i class="bi bi-key"></i> Clave
          </button>
          <button class="btn btn-sm btn-outline-danger btn-eliminar-usr" data-id="${u.id}">
            <i class="bi bi-trash"></i>
          </button>
        </td>
      </tr>
    `).join('');

    // Eventos dinámicos
    tbody.querySelectorAll('.btn-eliminar-usr').forEach(btn => {
      btn.addEventListener('click', (e) => eliminarUsuario(e.currentTarget.getAttribute('data-id')));
    });

    tbody.querySelectorAll('.btn-reset-pass').forEach(btn => {
      btn.addEventListener('click', (e) => abrirModalReset(e.currentTarget.getAttribute('data-id'), e.currentTarget.getAttribute('data-nombre')));
    });

  } catch (err) {
    console.error("Error al cargar usuarios:", err.message);
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

async function eliminarUsuario(id) {
  if (!confirm('¿Desea eliminar este usuario de la plataforma de manera permanente?')) return;

  try {
    const { error } = await supabase.from('usuarios').delete().eq('id', id);
    if (error) throw error;
    cargarUsuarios();
  } catch (err) {
    alert('Error al eliminar el usuario: ' + err.message);
  }
}

/* ==========================================================================
   2. ESTADÍSTICAS Y RENDIMIENTO DEL PERSONAL
   ========================================================================== */

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
    const usuariosList = usuarios || [];

    const guardias = usuariosList.filter(u => (u.rol || '').toUpperCase() === 'GUARDIA');
    const danosContador = bitacoraGlobal.filter(b => b.tipo_visita === 'DAÑO' || (b.observaciones || '').toLowerCase().includes('daño')).length;

    document.getElementById('kpiTotalAccesos').innerText = bitacoraGlobal.length;
    document.getElementById('kpiIncidentes').innerText = danosContador;
    
    const badgeDanos = document.getElementById('badgeCantDanos');
    if (badgeDanos) badgeDanos.innerText = danosContador;

    let inactivosCount = 0;
    const htmlTabla = guardias.map(g => {
      const registrosGuardia = bitacoraGlobal.filter(b => b.registrado_por === g.nombre);
      const cantidad = registrosGuardia.length;
      let porcentaje = Math.min(cantidad * 10, 100);
      let estadoBadge = '<span class="badge bg-success">Excelente Uso</span>';

      if (porcentaje < 30) {
        inactivosCount++;
        estadoBadge = '<span class="badge bg-danger">Inactivo / No usa App</span>';
      } else if (porcentaje < 70) {
        estadoBadge = '<span class="badge bg-warning text-dark">Uso Moderado</span>';
      }

      return `
        <tr>
          <td class="fw-bold">${g.nombre}</td>
          <td>${g.sede || 'Sede Principal'}</td>
          <td><span class="fw-bold text-success">${cantidad}</span> registros</td>
          <td>${cantidad > 0 ? (cantidad * 12) + ' min' : '0 min'}</td>
          <td style="width: 200px;">
            <div class="progress progress-sm mb-1" style="height: 8px;">
              <div class="progress-bar ${porcentaje < 30 ? 'bg-danger' : 'bg-success'}" style="width: ${porcentaje}%"></div>
            </div>
            <small class="text-muted">${porcentaje}% del turno activo</small>
          </td>
          <td>${estadoBadge}</td>
        </tr>
      `;
    }).join('');

    const elTabla = document.getElementById('tablaEficienciaGuardias');
    if (elTabla) elTabla.innerHTML = htmlTabla || '<tr><td colspan="6" class="text-center py-3">No hay guardias registrados</td></tr>';

    document.getElementById('kpiInactivos').innerText = inactivosCount;
    document.getElementById('kpiEficiencia').innerText = guardias.length > 0 ? Math.round(((guardias.length - inactivosCount) / guardias.length) * 100) + '%' : '100%';

  } catch (err) {
    console.error("Error al cargar estadísticas:", err.message);
  }
}

/* ==========================================================================
   3. GESTIÓN DE SEDES Y CLUBES
   ========================================================================== */

async function cargarSedes() {
  try {
    const { data: sedes, error } = await supabase
      .from('sedes')
      .select('*')
      .order('nombre', { ascending: true });

    if (error) throw error;
    const sedesList = sedes || [];

    const selectSedes = document.getElementById('uSede');
    if (selectSedes) {
      selectSedes.innerHTML = sedesList.map(s => `<option value="${s.nombre}">${s.nombre}</option>`).join('');
    }

    const tbody = document.getElementById('tablaSedes');
    if (tbody) {
      tbody.innerHTML = sedesList.map(s => `
        <tr>
          <td class="fw-bold">${s.nombre}</td>
          <td>${s.ubicacion || 'Sin Ubicación'}</td>
          <td><span class="badge bg-secondary">${s.capacidad || 0} personas</span></td>
          <td class="text-end">
            <button class="btn btn-sm btn-outline-danger btn-eliminar-sede" data-id="${s.id}">
              <i class="bi bi-trash"></i> Eliminar
            </button>
          </td>
        </tr>
      `).join('');

      tbody.querySelectorAll('.btn-eliminar-sede').forEach(btn => {
        btn.addEventListener('click', (e) => eliminarSede(e.currentTarget.getAttribute('data-id')));
      });
    }

  } catch (err) {
    console.error("Error al cargar sedes:", err.message);
  }
}

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

    alert('Sede registrada con éxito.');
    document.getElementById('formSede').reset();
    cargarSedes();
  } catch (err) {
    alert('Error al guardar la sede: ' + err.message);
  }
}

async function eliminarSede(id) {
  if (!confirm('¿Está seguro de eliminar esta sede?')) return;

  try {
    const { error } = await supabase.from('sedes').delete().eq('id', id);
    if (error) throw error;
    cargarSedes();
  } catch (err) {
    alert('Error al eliminar la sede: ' + err.message);
  }
}

/* ==========================================================================
   4. DAÑOS Y ALERTAS EN TIEMPO REAL
   ========================================================================== */

function escucharNotificacionesRealtime() {
  supabase
    .channel('schema-db-changes')
    .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'bitacora' }, payload => {
      const registro = payload.new;
      if (registro.tipo_visita === 'DAÑO' || registro.tipo_visita === 'NOVEDAD' || (registro.observaciones || '').toUpperCase().includes('DAÑO')) {
        const banner = document.getElementById('contenedorAlertasVivas');
        const txt = document.getElementById('txtUltimaAlerta');
        if (banner && txt) {
          txt.innerHTML = `<strong>${registro.registrado_por || 'Garita'}:</strong> ${registro.observaciones || 'Reporte de daño/novedad en garita'}`;
          banner.style.display = 'block';
        }
      }
    })
    .subscribe();
}

async function cargarReportesDanos() {
  try {
    const { data, error } = await supabase
      .from('bitacora')
      .select('*')
      .or('tipo_visita.eq.DAÑO,tipo_visita.eq.NOVEDAD,observaciones.ilike.%daño%')
      .order('hora_ingreso', { ascending: false });

    if (error) throw error;
    const danos = data || [];

    const tbody = document.getElementById('tablaDanosGlobal');
    if (!tbody) return;

    if (danos.length === 0) {
      tbody.innerHTML = `<tr><td colspan="6" class="text-center py-4 text-muted"><i class="bi bi-check-circle text-success fs-4 d-block mb-1"></i>No hay reportes de daños pendientes en garita.</td></tr>`;
      return;
    }

    tbody.innerHTML = danos.map(d => `
      <tr>
        <td><small class="fw-bold">${d.hora_ingreso ? new Date(d.hora_ingreso).toLocaleString('es-EC') : 'N/A'}</small></td>
        <td class="fw-bold">${d.registrado_por || 'Guardia'}</td>
        <td><span class="badge bg-secondary">${d.destino || 'Garita Principal'}</span></td>
        <td class="text-danger fw-semibold">${d.observaciones || 'Reporte sin descripción'}</td>
        <td><span class="badge bg-warning text-dark">Pendiente Revisión</span></td>
        <td class="text-end">
          <button class="btn btn-sm btn-outline-success" onclick="alert('Marcado como Atendido.')">
            <i class="bi bi-check-lg"></i> Atendido
          </button>
        </td>
      </tr>
    `).join('');

  } catch (err) {
    console.error("Error al cargar daños:", err.message);
  }
}

/* ==========================================================================
   5. BITÁCORA GLOBAL Y EXPORTACIÓN A EXCEL/CSV
   ========================================================================== */

async function cargarBitacoraGlobal() {
  try {
    const { data: bitacora, error } = await supabase
      .from('bitacora')
      .select('*')
      .order('hora_ingreso', { ascending: false });

    if (error) throw error;
    bitacoraGlobal = bitacora || [];
    renderTablaBitacora(bitacoraGlobal);
  } catch (err) {
    console.error("Error al cargar la bitácora:", err.message);
  }
}

function renderTablaBitacora(datos) {
  const tbody = document.getElementById('tablaBitacoraGlobal');
  if (!tbody) return;

  tbody.innerHTML = datos.map(b => `
    <tr>
      <td><small class="fw-bold">${b.hora_ingreso ? new Date(b.hora_ingreso).toLocaleString('es-EC') : 'N/A'}</small></td>
      <td><span class="badge bg-secondary">${b.tipo_visita || 'N/A'}</span></td>
      <td class="fw-bold">${b.nombre || ''}</td>
      <td><small>${b.cedula || b.placa || 'Peatonal'}</small></td>
      <td class="text-success fw-bold">${b.destino || 'General'}</td>
      <td><small class="fw-semibold text-muted">${b.registrado_por || 'Garita'}</small></td>
      <td>${b.hora_salida ? '<span class="badge bg-secondary">SALIÓ</span>' : '<span class="badge bg-success">DENTRO</span>'}</td>
    </tr>
  `).join('');
}

function filtrarBitacoraGlobal() {
  const q = document.getElementById('inputBuscarGlobal').value.toLowerCase();
  const filtrados = bitacoraGlobal.filter(b => 
    (b.nombre && b.nombre.toLowerCase().includes(q)) ||
    (b.registrado_por && b.registrado_por.toLowerCase().includes(q)) ||
    (b.placa && b.placa.toLowerCase().includes(q))
  );
  renderTablaBitacora(filtrados);
}

function exportarCSV() {
  if (bitacoraGlobal.length === 0) return alert('No hay registros para exportar.');

  let csv = "ID,Fecha,Tipo,Nombre,Cedula,Placa,Destino,Guardia,Estado\n";
  bitacoraGlobal.forEach(r => {
    csv += `"${r.id}","${r.hora_ingreso ? new Date(r.hora_ingreso).toLocaleString('es-EC') : ''}","${r.tipo_visita || ''}","${r.nombre || ''}","${r.cedula || ''}","${r.placa || ''}","${r.destino || ''}","${r.registrado_por || ''}","${r.hora_salida ? 'SALIO' : 'DENTRO'}"\n`;
  });

  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
  const link = document.createElement("a");
  link.href = URL.createObjectURL(blob);
  link.setAttribute("download", `Reporte_Bitacora_Club_${new Date().toISOString().slice(0,10)}.csv`);
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
}