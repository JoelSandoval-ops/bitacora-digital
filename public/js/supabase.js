// Si el script de Supabase no está en la página, lo cargamos dinámicamente
if (typeof supabase === 'undefined') {
  const script = document.createElement('script');
  script.src = 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2';
  document.head.appendChild(script);
}

const SUPABASE_URL = 'https://irdgnyqomuwajsezswal.supabase.co';
const SUPABASE_ANON_KEY = 'sb_publishable_dHiFIWqRS9XAedJLYMdeew_XVQUYDvp';

// Función para inicializar el cliente cuando la librería esté lista
function inicializarSupabase() {
  if (typeof supabase !== 'undefined' && supabase.createClient) {
    window.supabaseClient = supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
  } else {
    setTimeout(inicializarSupabase, 100);
  }
}

inicializarSupabase();