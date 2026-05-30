/**
 * whatsapp-web.js RemoteAuth store backed by Neon PostgreSQL.
 *
 * RemoteAuth calls:
 *   sessionExists({ session }) → boolean
 *   save({ session, path })    → read ZIP at `path`, store in DB
 *   extract({ session, path }) → write ZIP from DB to `path`
 *   delete({ session })        → clear ZIP from DB
 *
 * session = userId (UUID)
 * path    = local filesystem path to a .zip file
 */
import fs from 'fs/promises';
import sql from '../../app/api/utils/sql.js';

export class NeonAuthStore {
  async sessionExists({ session }) {
    const rows = await sql`
      SELECT 1 FROM traheeb_whatsapp_sessions
      WHERE user_id = ${session} AND session_zip IS NOT NULL
      LIMIT 1
    `;
    return rows.length > 0;
  }

  /** Called by RemoteAuth after compressing the session dir into a ZIP at `path`. */
  async save({ session, path }) {
    const zipBuffer = await fs.readFile(path);
    const zipBase64 = zipBuffer.toString('base64');
    await sql`
      INSERT INTO traheeb_whatsapp_sessions (user_id, creds, keys, session_zip, updated_at)
      VALUES (${session}, '{}', '{}', ${zipBase64}, now())
      ON CONFLICT (user_id)
      DO UPDATE SET session_zip = ${zipBase64}, updated_at = now()
    `;
    console.log(`[NeonAuthStore] session saved for userId=${session} size=${zipBuffer.length}B`);
  }

  /** Called by RemoteAuth before launching Chrome — writes ZIP to `path` for extraction. */
  async extract({ session, path }) {
    const rows = await sql`
      SELECT session_zip FROM traheeb_whatsapp_sessions
      WHERE user_id = ${session}
      LIMIT 1
    `;
    if (!rows.length || !rows[0].session_zip) {
      console.log(`[NeonAuthStore] no session ZIP found for userId=${session}`);
      return;
    }
    const zipBuffer = Buffer.from(rows[0].session_zip, 'base64');
    await fs.writeFile(path, zipBuffer);
    console.log(`[NeonAuthStore] session extracted for userId=${session} size=${zipBuffer.length}B`);
  }

  async delete({ session }) {
    await sql`
      UPDATE traheeb_whatsapp_sessions
      SET session_zip = null, connected = false, updated_at = now()
      WHERE user_id = ${session}
    `;
    console.log(`[NeonAuthStore] session deleted for userId=${session}`);
  }
}
