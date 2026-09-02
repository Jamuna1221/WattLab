export function getStoredJson(key) {
  try {
    const value = localStorage.getItem(key);
    return value ? JSON.parse(value) : null;
  } catch {
    return null;
  }
}

export function getStoredUser() {
  return getStoredJson('user');
}

export function getUserProfile(user = getStoredUser()) {
  return user?.profile || getStoredJson('profile') || null;
}

export function getUserEmail(user = getStoredUser()) {
  const profile = getUserProfile(user);
  return profile?.email || user?.email || user?.user?.email || '';
}

export function getUserName(user = getStoredUser()) {
  const email = getUserEmail(user);
  const profile = getUserProfile(user);
  return (
    profile?.name ||
    user?.user_metadata?.name ||
    user?.user_metadata?.full_name ||
    user?.name ||
    (email ? email.split('@')[0] : '')
  );
}

export function getUserId(user = getStoredUser()) {
  const profile = getUserProfile(user);
  return profile?.id || user?.id || user?.user?.id || '';
}

export function persistLoginData(data) {
  localStorage.removeItem('user');
  localStorage.removeItem('profile');

  const authUser = data?.user || null;
  const profile = data?.profile || null;
  const user = authUser ? { ...authUser, profile } : profile;

  if (data?.token || data?.session?.access_token) {
    localStorage.setItem('token', data.token || data.session.access_token);
  }

  if (user) {
    localStorage.setItem('user', JSON.stringify(user));
  }

  if (profile) {
    localStorage.setItem('profile', JSON.stringify(profile));
  }
}

export function clearSessionData() {
  localStorage.removeItem('userRole');
  localStorage.removeItem('token');
  localStorage.removeItem('user');
  localStorage.removeItem('profile');
  localStorage.removeItem('wattlab_device_id');
  localStorage.removeItem('wattlab_user_name');
  localStorage.removeItem('wattlab_tariff');
  localStorage.removeItem('wattlab_budget_goal');
  localStorage.removeItem('wattlab_notification_prefs');
}
