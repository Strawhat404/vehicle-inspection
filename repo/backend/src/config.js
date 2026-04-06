import dotenv from 'dotenv';

dotenv.config();

function mustHave(name, fallback = '') {
  return process.env[name] || fallback;
}

function parseCsvList(value) {
  return String(value || '')
    .split(',')
    .map((item) => item.trim())
    .filter(Boolean);
}

function parseRegexRuleList(value) {
  return parseCsvList(value).map((entry, index) => {
    const separator = entry.lastIndexOf('::');
    const name = separator >= 0 ? entry.slice(0, separator).trim() : `rule_${index + 1}`;
    const pattern = separator >= 0 ? entry.slice(separator + 2).trim() : entry;
    return { name, pattern };
  });
}

export const config = {
  port: Number(mustHave('PORT', 4000)),
  nodeEnv: mustHave('NODE_ENV', 'production'),
  frontend: {
    origin: mustHave('FRONTEND_ORIGIN', 'http://localhost:5173')
  },
  db: {
    host: mustHave('DB_HOST', 'mysql'),
    port: Number(mustHave('DB_PORT', 3306)),
    database: mustHave('DB_NAME', 'roadsafe'),
    user: mustHave('DB_USER', 'roadsafe'),
    password: mustHave('DB_PASSWORD', 'roadsafe_password')
  },
  sessionTtlHours: Number(mustHave('SESSION_TTL_HOURS', 8)),
  rateLimits: {
    ipPerMinute: Number(mustHave('IP_RATE_LIMIT_PER_MIN', 300)),
    userPerMinute: Number(mustHave('USER_RATE_LIMIT_PER_MIN', 60))
  },
  ingestion: {
    dropRoot: mustHave('INGEST_DROP_ROOT', '/var/roadsafe/dropzone')
  },
  audit: {
    exportDir: mustHave('AUDIT_EXPORT_DIR', '/var/roadsafe/audit-exports')
  },
  tls: {
    enabled: String(mustHave('TLS_ENABLED', 'true')).toLowerCase() === 'true',
    certPath: mustHave('TLS_CERT_PATH', './certs/server.crt'),
    keyPath: mustHave('TLS_KEY_PATH', './certs/server.key')
  },
  sensitiveContent: {
    regexRules: parseRegexRuleList(
      mustHave('SENSITIVE_REGEX_RULES', 'ssn::\\b\\d{3}-\\d{2}-\\d{4}\\b,ssn_compact::\\b\\d{9}\\b')
    ),
    dictionaryTerms: parseCsvList(mustHave('SENSITIVE_DICTIONARY_TERMS', 'social security number,ssn'))
  },
  encryption: {
    // Accept either DATA_ENCRYPTION_KEY or legacy AES_256_KEY_HEX.
    aes256KeyHex: mustHave('DATA_ENCRYPTION_KEY', mustHave('AES_256_KEY_HEX', 'PLACEHOLDER_64_HEX_CHARS_FOR_AES_256'))
  }
};
