const jwt = require('jsonwebtoken');
const { supabase, supabaseAnon } = require('../config/supabaseClient');

function signUserToken(user) {
  if (!process.env.JWT_SECRET) throw new Error('JWT_SECRET not set');
  return jwt.sign(
    { id: user.id, email: user.email, role: 'user' },
    process.env.JWT_SECRET,
    { expiresIn: '7d' }
  );
}

exports.registerUser = async ({ email, password, name, username } = {}) => {
  if (!email || !password) throw new Error('Email and password are required');
  
  // Step 1: Check if email already exists in auth.users
  const { data: existingAuthUsers } = await supabase.auth.admin.listUsers();
  const alreadyExists = existingAuthUsers?.users?.find(u => u.email === email);
  if (alreadyExists) throw new Error('Email already registered');

  // Step 2: Create user in Supabase Auth
  const { data, error } = await supabase.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
  });

  if (error) throw new Error(error.message);

  // Step 3: Use UPSERT instead of INSERT to avoid duplicate key error
  const { error: profileError } = await supabase
    .from('users')
    .upsert([{ 
      id: data.user.id, 
      email, 
      name: name || username,
    }], { onConflict: 'id' });  // ← KEY FIX

  if (profileError) throw new Error(profileError.message);

  const token = signUserToken(data.user);
  return { user: data.user, token };
};

exports.loginUser = async ({ email, password } = {}) => {
  if (!email || !password) throw new Error('Email and password are required');
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

  const token = signUserToken(data.user);

  return {
    user: data.user,
    profile,
    session: data.session,
    token,
  };
};