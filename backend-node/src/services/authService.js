const { supabase, supabaseAnon } = require('../config/supabaseClient');

exports.registerUser = async ({ email, password, name }) => {
  const { data, error } = await supabase.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
  });

  if (error) throw new Error(error.message);

  const { error: profileError } = await supabase
    .from('users')
    .insert([{ id: data.user.id, email, name }]);

  if (profileError) throw new Error(profileError.message);

  return data.user;
};

exports.loginUser = async ({ email, password }) => {
  const { data, error } = await supabaseAnon.auth.signInWithPassword({
    email,
    password,
  });

  if (error) throw new Error("Invalid email or password");

  const { data: profile, error: profileError } = await supabase
    .from('users')
    .select('*')
    .eq('id', data.user.id)
    .single();

  if (profileError) throw new Error("User profile not found");

  return {
    user: data.user,
    profile,
    session: data.session,
  };
};