import { supabase } from './supabase.js';

document.addEventListener('DOMContentLoaded', () => {
  const loginForm = document.getElementById('loginForm') || document.querySelector('form');

  if (!loginForm) return;

  loginForm.addEventListener('submit', async (e) => {
    e.preventDefault();

    // Obtener campos de entrada
    const correoInput = document.getElementById('correo') || document.querySelector('input[type="email"]');
    const passwordInput = document.getElementById('password') || document.querySelector('input[type="password"]');

    const correo = correoInput?.value.trim();
    const password = passwordInput?.value.trim();

    if (!correo || !password) {
      alert('Por favor, ingresa tu correo y contraseña.');
      return;
    }

    try {
      // Consulta directa a la tabla usuarios en Supabase
      const { data: usuario, error } = await supabase
        .from('usuarios')
        .select('*')
        .eq('correo', correo)
        .eq('password', password)
        .maybeSingle();

      if (error) {
        console.error('Error de Supabase:', error);
        alert('Error al verificar credenciales.');
        return;
      }

      if (!usuario) {
        alert('Credenciales incorrectas. Verifique el correo y la contraseña.');
        return;
      }

      // Guardar usuario en LocalStorage
      localStorage.setItem('usuarioSesion', JSON.stringify(usuario));

      // Redireccionar por rol
      if (usuario.rol === 'ADMIN') {
        window.location.href = 'administrador.html';
      } else if (usuario.rol === 'SUPERVISOR') {
        window.location.href = 'supervisor.html';
      } else if (usuario.rol === 'GUARDIA') {
        window.location.href = 'guardia.html';
      } else {
        alert('Rol no asignado.');
      }
    } catch (err) {
      console.error('Error en el proceso de login:', err);
      alert('Ocurrió un error inesperado.');
    }
  });
});