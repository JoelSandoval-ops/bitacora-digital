// supabase.js
const SUPABASE_URL = 'https://irdgnyqomuwajsezswal.supabase.co';
const SUPABASE_ANON_KEY = 'sb_publishable_dHiFIWqRS9XAedJLYMdeew_XVQUYDvp';

// Crear el cliente global para que todo el HTML lo reconozca inmediatamente
window.supabaseClient = supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);