import { supabase } from './supabaseClient.js';

document.addEventListener('DOMContentLoaded', () => {
  const loginForm = document.getElementById('loginForm') || document.querySelector('form');
  const errorBox = document.getElementById('errorMessage');
  const btnSubmit = document.getElementById('btnSubmit') || loginForm?.querySelector('button[type="submit"]');

  if (!loginForm) return;

  // Mostrar alertas de error
  function showError(msg) {
    if (errorBox) {
      errorBox.textContent = msg;
      errorBox.style.display = 'block';
    } else {
      alert(msg);
    }
  }

  // Restaurar estado original del botón
  function resetSubmitButton() {
    if (btnSubmit) {
      btnSubmit.disabled = false;
      btnSubmit.textContent = 'Ingresar';
    }
  }

  loginForm.addEventListener('submit', async (e) => {
    e.preventDefault();

    if (errorBox) errorBox.style.display = 'none';

    // Capturar valor del campo usuario o correo
    const userInput = document.getElementById('correo') || 
                      document.getElementById('usuario') || 
                      document.querySelector('input[type="text"]') || 
                      document.querySelector('input[type="email"]');

    const passwordInput = document.getElementById('password') || 
                          document.querySelector('input[type="password"]');

    const usuarioVal = userInput?.value.trim();
    const passwordVal = passwordInput?.value.trim();

    if (!usuarioVal || !passwordVal) {
      showError('Por favor, ingresa tu usuario/correo y contraseña.');
      return;
    }

    if (btnSubmit) {
      btnSubmit.disabled = true;
      btnSubmit.textContent = 'Ingresando...';
    }

    try {
      // Búsqueda flexible: permite autenticar si ingresa nombre de usuario O correo electrónico
      const { data: usuario, error } = await supabase
        .from('usuarios')
        .select('*')
        .or(`usuario.eq.${usuarioVal},correo.eq.${usuarioVal}`)
        .eq('password', passwordVal)
        .maybeSingle();

      if (error) {
        console.error('Error de Supabase:', error);
        showError('Error de conexión al verificar credenciales.');
        resetSubmitButton();
        return;
      }

      if (!usuario) {
        showError('Credenciales incorrectas. Verifique sus datos.');
        resetSubmitButton();
        return;
      }

      // Guardar sesión en la clave leída por el panel administrativo
      localStorage.setItem('user_bv', JSON.stringify(usuario));

      // Normalizar rol y ejecutar redirección
      const rolUpper = (usuario.rol || '').toUpperCase();

      switch (rolUpper) {
        case 'ADMIN':
        case 'ADMINISTRADOR':
          window.location.href = './administrador.html';
          break;

        case 'SUPERVISOR':
          window.location.href = './supervisor.html';
          break;

        case 'GUARDIA':
        case 'GARITA':
          window.location.href = './guardia.html';
          break;

        default:
          showError('El usuario no tiene un rol válido asignado.');
          resetSubmitButton();
      }
    } catch (err) {
      console.error('Error durante la autenticación:', err);
      showError('Ocurrió un error inesperado al iniciar sesión.');
      resetSubmitButton();
    }
  });
});