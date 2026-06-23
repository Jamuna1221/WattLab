const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { supabase } = require('../config/supabaseClient');

exports.loginAdmin = async ({ email, password }) => {
  if (!email || !password) throw new Error('Email and password are required');

  // Find admin by email
  const { data: admin, error } = await supabase
    .from('admins')
    .select('*')
    .eq('email', email.toLowerCase().trim())  // normalize email
    .single();

  // Generic message to avoid exposing which field is wrong
  if (error || !admin) throw new Error('Invalid admin credentials');

  // Compare password
  const isMatch = await bcrypt.compare(password, admin.password);
  if (!isMatch) throw new Error('Invalid admin credentials');

  // Generate JWT
  const token = jwt.sign(
    { id: admin.id, email: admin.email, role: 'admin' },
    process.env.JWT_SECRET,
    { expiresIn: '8h' }
  );

  return {
    token,
    admin: { id: admin.id, email: admin.email, name: admin.name }
  };
};

exports.createAdmin = async ({ email, password, name }) => {
  const hashedPassword = await bcrypt.hash(password, 10);

  const { data, error } = await supabase
    .from('admins')
    .insert([{ email: email.toLowerCase().trim(), password: hashedPassword, name }])
    .select()
    .single();

  if (error) throw new Error(error.message);
  return data;
};

// ✅ FIXED: Use upsert so it creates OR updates the admin record
exports.seedAdmin = async () => {
  const hashedPassword = await bcrypt.hash('Admin@123', 10);

  const { data, error } = await supabase
    .from('admins')
    .upsert(
      [{ email: 'admin@wattlab.com', password: hashedPassword, name: 'Super Admin' }],
      { onConflict: 'email' }   // if email exists → update, else → insert
    )
    .select()
    .single();

  if (error) throw new Error(error.message);

  // ✅ Verify the record actually exists now
  if (!data) throw new Error('Seed failed: no record returned');

  console.log('✅ Admin password seeded successfully for:', data.email);
  return data;
};