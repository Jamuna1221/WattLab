const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { supabase } = require('../config/supabaseClient');

exports.loginAdmin = async ({ email, password }) => {
  if (!email || !password) throw new Error('Email and password are required');

  const { data: admin, error } = await supabase
    .from('admins')
    .select('*')
    .eq('email', email.toLowerCase().trim())  
    .single();

  if (error || !admin) throw new Error('Invalid admin credentials');

  const isMatch = await bcrypt.compare(password, admin.password);
  if (!isMatch) throw new Error('Invalid admin credentials');

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

exports.seedAdmin = async () => {
  const hashedPassword = await bcrypt.hash('Admin@123', 10);

  const { data, error } = await supabase
    .from('admins')
    .upsert(
      [{ email: 'admin@wattlab.com', password: hashedPassword, name: 'Super Admin' }],
      { onConflict: 'email' }   
    )
    .select()
    .single();

  if (error) throw new Error(error.message);

  if (!data) throw new Error('Seed failed: no record returned');

  console.log('✅ Admin password seeded successfully for:', data.email);
  return data;
};

exports.getDashboardData = async () => {
  // Fetch users
  const { data: users, error: usersError } = await supabase
    .from('users')
    .select('id, name, email, created_at')
    .order('created_at', { ascending: false });
  if (usersError) throw new Error(usersError.message);

  // Fetch devices
  const { data: devices, error: devicesError } = await supabase
    .from('devices')
    .select('device_id, user_id, status, registered_at');
  if (devicesError) throw new Error(devicesError.message);

  // Map devices to users to calculate appliance/device count per user
  const usersWithStats = users.map(user => {
    const userDevices = devices.filter(d => d.user_id === user.id);
    return {
      ...user,
      total_consumption: 0, // Placeholder, can be calculated from energy_readings if needed
      appliances_count: userDevices.length,
      status: userDevices.length > 0 ? 'active' : 'inactive',
      devices: userDevices.map(d => d.device_id)
    };
  });

  return {
    users: usersWithStats,
    stats: {
      total_users: users.length,
      active_users: usersWithStats.filter(u => u.status === 'active').length,
      total_appliances: devices.length,
      total_consumption: 0, // Placeholder
      total_alerts: 0,
      system_efficiency: 95.0
    }
  };
};

exports.createDeviceAndAssign = async ({ device_id, device_secret, user_id }) => {
  if (!device_id || !device_secret || !user_id) throw new Error('device_id, device_secret and user_id are required');

  const bcrypt = require('bcryptjs');
  const hashedSecret = await bcrypt.hash(device_secret, 10);

  // Check if device already exists
  const { data: existing } = await supabase
    .from('devices')
    .select('device_id')
    .eq('device_id', device_id)
    .single();

  if (existing) {
    // Device exists — just reassign it
    const { data, error } = await supabase
      .from('devices')
      .update({ user_id, status: 'ASSIGNED' })
      .eq('device_id', device_id)
      .select()
      .single();
    if (error) throw new Error(error.message);
    return data;
  }

  // Create new device and assign in one shot
  const { data, error } = await supabase
    .from('devices')
    .insert([{ device_id, device_secret: hashedSecret, user_id, status: 'ASSIGNED' }])
    .select()
    .single();

  if (error) throw new Error(error.message);
  return data;
};


exports.assignDevice = async ({ device_id, user_id }) => {
  if (!device_id || !user_id) throw new Error('device_id and user_id are required');

  // Verify device exists
  const { data: device, error: checkError } = await supabase
    .from('devices')
    .select('*')
    .eq('device_id', device_id)
    .single();

  if (checkError || !device) {
    throw new Error('Device not found');
  }

  // Update the device to belong to the user
  const { data, error } = await supabase
    .from('devices')
    .update({ user_id: user_id, status: 'ASSIGNED' })
    .eq('device_id', device_id)
    .select()
    .single();

  if (error) throw new Error(error.message);
  return data;
};