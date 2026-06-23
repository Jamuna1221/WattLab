const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { supabase } = require('../config/supabaseClient');

exports.createDevice = async ({ device_id, device_secret }) => {
  if (!device_id || !device_secret) throw new Error('device_id and device_secret are required');

  const hashedSecret = await bcrypt.hash(device_secret, 10);

  const { data, error } = await supabase
    .from('devices')
    .insert([
      {
        device_id,
        device_secret: hashedSecret,
        status: 'UNASSIGNED',
      },
    ])
    .select()
    .single();

  if (error) throw new Error(error.message);
  return data;
};

exports.linkDevice = async ({ device_id, device_secret, user_id }) => {
  if (!device_id || !device_secret || !user_id) throw new Error('device_id, device_secret, user_id are required');

  const { data: device, error } = await supabase
    .from('devices')
    .select('*')
    .eq('device_id', device_id)
    .single();

  if (error || !device) throw new Error('Device not found');
  if (device.status === 'ASSIGNED') throw new Error('Device already linked to another user');

  const isMatch = await bcrypt.compare(device_secret, device.device_secret);
  if (!isMatch) throw new Error('Invalid device secret');

  const { data: updated, error: updateError } = await supabase
    .from('devices')
    .update({ user_id, status: 'ASSIGNED' })
    .eq('device_id', device_id)
    .select()
    .single();

  if (updateError) throw new Error(updateError.message);

  if (!process.env.JWT_SECRET) throw new Error('JWT_SECRET not set');
  const token = jwt.sign({ deviceId: device_id, userId: user_id }, process.env.JWT_SECRET, { expiresIn: '30d' });

  return { device: updated, token };
};

exports.getUserDevices = async (user_id) => {
  const { data, error } = await supabase.from('devices').select('*').eq('user_id', user_id);
  if (error) throw new Error(error.message);
  return data || [];
};

