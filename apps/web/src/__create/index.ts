import { createHonoServer } from 'react-router-hono-server/node';
import { initAllSessions } from '../services/whatsapp/SessionManager.js';

export default await createHonoServer({
  beforeAll: async () => {
    // Re-hydrate WhatsApp sessions that were connected before the last restart.
    // Credentials are persisted via LocalAuth (.wwebjs_auth/<userId>/).
    await initAllSessions();
  },
});
