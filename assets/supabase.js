// assets/supabase.js

// 这里先直接写死你的 Supabase 项目信息
// （这是 anon 公钥，只能做前端允许的操作，注意不要用 service_role）

const SUPABASE_URL = 'https://ukinuavvsjnqmrbtmwtq.supabase.co';
const SUPABASE_ANON_KEY =
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InVraW51YXZ2c2pucW1yYnRtd3RxIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjMwNDgwNzUsImV4cCI6MjA3ODYyNDA3NX0.e4Y9sw_apIhln146rSExKadRAzzO3RoCGqgRh7eIGnI';

const supabaseClient = window.supabase.createClient(
  SUPABASE_URL,
  SUPABASE_ANON_KEY
);

async function pingSupabase() {
  try {
    const el = document.getElementById('supabaseStatus');
    if (!el) return;

    // titles 表要在 Supabase 里建好
    const { error } = await supabaseClient.from('titles').select('id').limit(1);

    if (error) {
      console.error('Supabase error:', error);
      el.textContent = 'DB Error';
      el.classList.remove('pill-muted');
      el.classList.add('pill');
      el.style.backgroundColor = '#fee2e2';
      el.style.color = '#b91c1c';
    } else {
      el.textContent = 'Supabase 在线';
      el.classList.remove('pill-muted');
      el.classList.add('pill');
      el.style.backgroundColor = '#dcfce7';
      el.style.color = '#166534';
    }
  } catch (e) {
    console.error(e);
  }
}

document.addEventListener('DOMContentLoaded', pingSupabase);
