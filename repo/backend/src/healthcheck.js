import http from 'http';
import https from 'https';

const tlsEnabled = String(process.env.TLS_ENABLED || 'false').toLowerCase() === 'true';
const transport = tlsEnabled ? https : http;

const options = {
  hostname: process.env.HEALTH_HOST || '127.0.0.1',
  port: Number(process.env.PORT || 4000),
  path: '/health',
  method: 'GET',
  timeout: 3000,
  rejectUnauthorized: false
};

const req = transport.request(options, (res) => {
  if (res.statusCode && res.statusCode >= 200 && res.statusCode < 300) {
    process.exit(0);
  }
  process.exit(1);
});

req.on('error', () => process.exit(1));
req.on('timeout', () => {
  req.destroy();
  process.exit(1);
});

req.end();
