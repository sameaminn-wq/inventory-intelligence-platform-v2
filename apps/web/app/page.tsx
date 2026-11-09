'use client';

import { useState } from 'react';

const apiBase = (process.env.NEXT_PUBLIC_API_BASE_URL ?? '').replace(/\/$/, '');

export default function HomePage() {
  const [health, setHealth] = useState<string>('Not checked');
  const [checking, setChecking] = useState(false);

  async function checkApi() {
    setChecking(true);
    setHealth('Checking…');
    try {
      if (!apiBase) throw new Error('API URL is not configured yet.');
      const response = await fetch(apiBase + '/api/v1/health');
      if (!response.ok) throw new Error('API returned HTTP ' + response.status);
      const data = await response.json();
      setHealth('Connected — ' + data.service + ' (' + data.status + ')');
    } catch (error) {
      setHealth(error instanceof Error ? error.message : 'Connection failed');
    } finally {
      setChecking(false);
    }
  }

  return (
    <main style={{ maxWidth: 920, margin: '0 auto', padding: '72px 24px' }}>
      <div style={{ color: '#2563eb', fontWeight: 700, letterSpacing: 2, fontSize: 12 }}>
        INVENTORY INTELLIGENCE PLATFORM
      </div>
      <h1 style={{ color: '#111827', fontSize: 42, lineHeight: 1.1, margin: '18px 0' }}>
        Know what is on your shelves.
      </h1>
      <p style={{ color: '#4b5563', fontSize: 18, maxWidth: 620, lineHeight: 1.6 }}>
        A web shell connected to a dedicated API. Store accounts, inventory and image analysis
        will be enabled in tested stages.
      </p>
      <section style={{ marginTop: 36, padding: 24, background: '#fff', border: '1px solid #e5e7eb', borderRadius: 12 }}>
        <h2 style={{ marginTop: 0, color: '#111827' }}>Deployment connection test</h2>
        <p style={{ color: '#4b5563' }}>API status: <strong>{health}</strong></p>
        <button onClick={checkApi} disabled={checking} style={{ background: '#1d4ed8', color: '#fff', border: 0, borderRadius: 8, padding: '12px 18px', cursor: 'pointer' }}>
          {checking ? 'Checking…' : 'Check API connection'}
        </button>
      </section>
      <p style={{ marginTop: 32, color: '#6b7280', fontSize: 13 }}>
        Development deployment only — do not use real customer data.
      </p>
    </main>
  );
}
