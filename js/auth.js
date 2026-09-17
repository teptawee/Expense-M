// ============================================
// ====== Authentication Module ===============
// ============================================
const Auth = (() => {
  const { SUPABASE_URL, SUPABASE_ANON_KEY } = window.APP_CONFIG;
  const sb = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

  let currentUser = null;
  let currentSession = null;

  // ---------- Getters ----------
  function getUser() { return currentUser; }
  function getSession() { return currentSession; }
  function getClient() { return sb; }

  // Token สำหรับ REST API (fallback เป็น anon key ถ้าไม่มี session)
  function getToken() {
    return currentSession?.access_token || SUPABASE_ANON_KEY;
  }

  // ---------- Auth Actions ----------
  async function login(email, password) {
    const { data, error } = await sb.auth.signInWithPassword({ email, password });
    if (error) throw error;
    currentUser = data.user;
    currentSession = data.session;
    return data;
  }

  async function signup(email, password) {
    const { data, error } = await sb.auth.signUp({
      email,
      password,
      options: {
        emailRedirectTo: window.location.origin
      }
    });
    if (error) throw error;
    return data;
  }

  async function logout() {
    await sb.auth.signOut();
    currentUser = null;
    currentSession = null;
  }

  async function resetPassword(email) {
    const { error } = await sb.auth.resetPasswordForEmail(email, {
      redirectTo: window.location.origin
    });
    if (error) throw error;
  }

  // ---------- Init (เรียกตอนโหลดหน้า) ----------
  async function init() {
    const { data: { session } } = await sb.auth.getSession();
    if (session) {
      currentUser = session.user;
      currentSession = session;
    }
    // listen ต่อการเปลี่ยนแปลง
    sb.auth.onAuthStateChange((_event, session) => {
      currentUser = session?.user || null;
      currentSession = session;
    });
    return currentSession;
  }

  return {
    init, login, signup, logout, resetPassword,
    getUser, getSession, getToken, getClient
  };
})();
