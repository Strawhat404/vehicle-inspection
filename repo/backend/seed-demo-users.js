#!/usr/bin/env node
// Seed demo users for all roles via the admin API.
// Run after the backend is healthy: node seed-demo-users.js

const BASE = process.env.API_BASE_URL || 'http://localhost:4000';

async function main() {
  // Login as admin
  const loginRes = await fetch(`${BASE}/api/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ username: 'admin', password: 'Admin@123456' })
  });
  const { token } = await loginRes.json();
  if (!token) throw new Error('Admin login failed');

  const users = [
    { username: 'coordinator', full_name: 'Demo Coordinator', password: 'Coordinator@123', role_name: 'Coordinator', location_code: 'HQ', department_code: 'OPS', email: 'coordinator@roadsafe.internal' },
    { username: 'inspector', full_name: 'Demo Inspector', password: 'Inspector@1234', role_name: 'Inspector', location_code: 'HQ', department_code: 'OPS', email: 'inspector@roadsafe.internal' },
    { username: 'customer', full_name: 'Demo Customer', password: 'Customer@12345', role_name: 'Customer', location_code: 'HQ', department_code: 'OPS', email: 'customer@roadsafe.internal' },
    { username: 'dataengineer', full_name: 'Demo Data Engineer', password: 'DataEngineer@123', role_name: 'Data Engineer', location_code: 'HQ', department_code: 'OPS', email: 'dataengineer@roadsafe.internal' }
  ];

  for (const user of users) {
    const res = await fetch(`${BASE}/api/auth/register`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
        'X-CSRF-Token': token
      },
      body: JSON.stringify(user)
    });
    if (res.status === 201) {
      console.log(`Created: ${user.username} (${user.role_name})`);
    } else if (res.status === 400) {
      console.log(`Already exists or failed: ${user.username}`);
    } else {
      const body = await res.json();
      console.error(`Failed to create ${user.username}: ${res.status} ${JSON.stringify(body)}`);
    }
  }
  console.log('Demo user seeding complete.');
}

main().catch(console.error);
