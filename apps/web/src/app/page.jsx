'use client';

import { useEffect, useState } from 'react';

export default function Page() {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch('/api/__dev/status')
      .then(r => r.json())
      .then(setData)
      .catch(() => setData({ error: true }))
      .finally(() => setLoading(false));
  }, []);

  const refresh = () => {
    setLoading(true);
    fetch('/api/__dev/status')
      .then(r => r.json())
      .then(setData)
      .finally(() => setLoading(false));
  };

  return (
    <div style={{
      fontFamily: 'monospace', background: '#0f0f0f', minHeight: '100vh',
      color: '#e2e8f0', padding: 32, direction: 'ltr',
    }}>
      <div style={{ maxWidth: 800, margin: '0 auto' }}>

        {/* Header */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 32 }}>
          <div>
            <h1 style={{ color: '#C8005A', margin: 0, fontSize: 24 }}>Traheeb — Local Dev</h1>
            <p style={{ color: '#64748b', margin: '4px 0 0', fontSize: 13 }}>localhost:4000</p>
          </div>
          <button onClick={refresh} style={{
            background: '#1e293b', border: '1px solid #334155', color: '#94a3b8',
            padding: '8px 16px', borderRadius: 8, cursor: 'pointer', fontSize: 13,
          }}>
            ↻ Refresh
          </button>
        </div>

        {loading && <p style={{ color: '#64748b' }}>Loading...</p>}

        {data && !data.error && (
          <>
            {/* Status */}
            <Section title="Server Status">
              <Row label="Database" value={data.dbOk ? '✅ Connected' : '❌ Not connected'} />
              <Row label="WhatsApp Bot" value={data.botConnected ? '✅ Connected' : '⚠️  Not connected (OTPs log to console)'} />
              <Row label="Users" value={data.userCount} />
              <Row label="Events" value={data.eventCount} />
            </Section>

            {/* Latest OTPs */}
            <Section title="Latest OTP Codes (for testing)">
              {data.otps?.length === 0 && (
                <p style={{ color: '#64748b', fontSize: 13 }}>No OTPs yet. Try logging in from the mobile app.</p>
              )}
              {data.otps?.map((otp, i) => (
                <div key={i} style={{
                  display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                  padding: '10px 0', borderBottom: '1px solid #1e293b',
                }}>
                  <div>
                    <span style={{ color: '#94a3b8', fontSize: 13 }}>{otp.phone}</span>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
                    <span style={{
                      background: otp.used ? '#1e293b' : '#0f2d1a',
                      color: otp.used ? '#475569' : '#4ade80',
                      padding: '4px 12px', borderRadius: 6, fontSize: 20,
                      fontWeight: 'bold', letterSpacing: 4,
                    }}>{otp.code}</span>
                    <span style={{ color: otp.used ? '#475569' : '#64748b', fontSize: 12 }}>
                      {otp.used ? 'used' : `expires ${new Date(otp.expires_at).toLocaleTimeString()}`}
                    </span>
                  </div>
                </div>
              ))}
            </Section>

            {/* Recent Users */}
            <Section title="Recent Users">
              {data.users?.length === 0 && (
                <p style={{ color: '#64748b', fontSize: 13 }}>No users yet.</p>
              )}
              {data.users?.map((u, i) => (
                <div key={i} style={{
                  display: 'flex', justifyContent: 'space-between',
                  padding: '8px 0', borderBottom: '1px solid #1e293b', fontSize: 13,
                }}>
                  <span style={{ color: '#e2e8f0' }}>{u.name}</span>
                  <span style={{ color: '#64748b' }}>{u.phone}</span>
                </div>
              ))}
            </Section>

            {/* Recent Events */}
            <Section title="Recent Events">
              {data.events?.length === 0 && (
                <p style={{ color: '#64748b', fontSize: 13 }}>No events yet.</p>
              )}
              {data.events?.map((e, i) => (
                <div key={i} style={{
                  display: 'flex', justifyContent: 'space-between',
                  padding: '8px 0', borderBottom: '1px solid #1e293b', fontSize: 13,
                }}>
                  <span style={{ color: '#e2e8f0' }}>{e.name}</span>
                  <span style={{ color: '#64748b' }}>{e.date}</span>
                </div>
              ))}
            </Section>
          </>
        )}

        {data?.error && (
          <div style={{ color: '#ef4444', background: '#1e293b', padding: 16, borderRadius: 8 }}>
            ❌ Could not load status. Is the server running?
          </div>
        )}

        <p style={{ color: '#334155', fontSize: 12, marginTop: 32 }}>
          This page is only visible in local development.
        </p>
      </div>
    </div>
  );
}

function Section({ title, children }) {
  return (
    <div style={{ marginBottom: 28 }}>
      <h2 style={{ color: '#E6D06A', fontSize: 13, textTransform: 'uppercase', letterSpacing: 2, margin: '0 0 12px' }}>
        {title}
      </h2>
      <div style={{ background: '#1a1a2e', borderRadius: 10, padding: '4px 16px', border: '1px solid #1e293b' }}>
        {children}
      </div>
    </div>
  );
}

function Row({ label, value }) {
  return (
    <div style={{
      display: 'flex', justifyContent: 'space-between',
      padding: '10px 0', borderBottom: '1px solid #1e293b', fontSize: 13,
    }}>
      <span style={{ color: '#64748b' }}>{label}</span>
      <span style={{ color: '#e2e8f0' }}>{value}</span>
    </div>
  );
}
