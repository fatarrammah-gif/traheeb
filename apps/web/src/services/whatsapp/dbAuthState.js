/**
 * Custom Baileys auth-state backed by Neon PostgreSQL.
 * Replaces the filesystem-based useMultiFileAuthState.
 *
 * Each userId (or 'SYSTEM') gets one row in traheeb_whatsapp_sessions.
 */
import { initAuthCreds, BufferJSON } from '@whiskeysockets/baileys';
import sql from '../../app/api/utils/sql.js';

export async function useDbAuthState(userId) {
  // ── Load existing session ──────────────────────────────────────────────────
  const rows = await sql`
    SELECT creds, keys FROM traheeb_whatsapp_sessions WHERE user_id = ${userId}
  `;

  let creds;
  let keys = {};

  if (rows.length) {
    try {
      creds = JSON.parse(JSON.stringify(rows[0].creds), BufferJSON.reviver);
      keys  = JSON.parse(JSON.stringify(rows[0].keys ?? {}), BufferJSON.reviver);
    } catch {
      creds = initAuthCreds();
    }
  } else {
    creds = initAuthCreds();
  }

  // ── Persist helper ─────────────────────────────────────────────────────────
  const save = async () => {
    const credsJson = JSON.parse(JSON.stringify(creds, BufferJSON.replacer));
    const keysJson  = JSON.parse(JSON.stringify(keys,  BufferJSON.replacer));
    await sql`
      INSERT INTO traheeb_whatsapp_sessions (user_id, creds, keys, updated_at)
      VALUES (${userId}, ${credsJson}, ${keysJson}, now())
      ON CONFLICT (user_id)
      DO UPDATE SET creds = EXCLUDED.creds, keys = EXCLUDED.keys, updated_at = now()
    `;
  };

  // ── Baileys key store interface ────────────────────────────────────────────
  const state = {
    creds,
    keys: {
      get: (type, ids) => {
        const result = {};
        for (const id of ids) {
          const val = keys[`${type}-${id}`];
          if (val !== undefined) result[id] = val;
        }
        return result;
      },
      set: async (data) => {
        for (const [type, typeData] of Object.entries(data)) {
          for (const [id, value] of Object.entries(typeData ?? {})) {
            const key = `${type}-${id}`;
            if (value) {
              keys[key] = value;
            } else {
              delete keys[key];
            }
          }
        }
        await save();
      },
    },
  };

  return { state, saveCreds: save };
}
