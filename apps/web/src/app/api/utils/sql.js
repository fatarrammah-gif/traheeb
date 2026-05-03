/**
 * SQL tagged-template helper.
 * - Uses @neondatabase/serverless when DATABASE_URL points to Neon cloud.
 * - Falls back to pg (node-postgres) for local/standard PostgreSQL connections.
 *
 * Uses lazy initialisation (no top-level await) so the module is safe to
 * include in the Vite build without triggering esbuild transpile errors.
 */

const DATABASE_URL = process.env.DATABASE_URL ?? '';

// Shared pg pool for local connections (created once, reused across requests)
let _pgPool = null;
// Resolved sql function (set on first call)
let _sql = null;

function getPgPool() {
  if (_pgPool) return _pgPool;
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  const pg = require('pg');
  _pgPool = new pg.Pool({ connectionString: DATABASE_URL });
  return _pgPool;
}

function buildPgSql(pool) {
  const query = async (strings, ...values) => {
    let text;
    const params = [];
    if (typeof strings === 'string') {
      text = strings;
    } else {
      text = strings.reduce((acc, part, i) => {
        return acc + part + (i < values.length ? `$${i + 1}` : '');
      }, '');
      params.push(...values);
    }
    const result = await pool.query(text, params);
    return result.rows;
  };

  query.begin = async (fn) => {
    const client = await pool.connect();
    try {
      await client.query('BEGIN');
      const txSql = async (strings, ...values) => {
        let text;
        const params = [];
        if (typeof strings === 'string') {
          text = strings;
        } else {
          text = strings.reduce((acc, part, i) => {
            return acc + part + (i < values.length ? `$${i + 1}` : '');
          }, '');
          params.push(...values);
        }
        const result = await client.query(text, params);
        return result.rows;
      };
      const result = await fn(txSql);
      await client.query('COMMIT');
      return result;
    } catch (err) {
      await client.query('ROLLBACK');
      throw err;
    } finally {
      client.release();
    }
  };

  return query;
}

async function getSQL() {
  if (_sql) return _sql;

  if (!DATABASE_URL) {
    const stub = () => { throw new Error('DATABASE_URL is not set'); };
    stub.begin = stub;
    _sql = stub;
    return _sql;
  }

  if (DATABASE_URL.includes('neon.tech') || DATABASE_URL.includes('neon.database')) {
    const { neon } = await import('@neondatabase/serverless');
    _sql = neon(DATABASE_URL);
    // neon() doesn't expose .begin() — add a no-op shim so callers don't crash
    if (!_sql.begin) {
      _sql.begin = async (fn) => fn(_sql);
    }
  } else {
    const pool = getPgPool();
    _sql = buildPgSql(pool);
  }

  return _sql;
}

/**
 * Tagged-template SQL function.
 * Lazily initialises the underlying driver on first call.
 *
 * Usage:  await sql`SELECT * FROM users WHERE id = ${id}`
 */
const sql = async (strings, ...values) => {
  const s = await getSQL();
  return s(strings, ...values);
};

sql.begin = async (fn) => {
  const s = await getSQL();
  return s.begin(fn);
};

export default sql;
