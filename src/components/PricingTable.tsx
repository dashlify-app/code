'use client';

import { COMPARISON_TABLE, PLANS } from '@/lib/serviceConfig';

export function PricingTable() {
  return (
    <div className="pricing-table-container" style={{ padding: '20px', overflowX: 'auto' }}>
      <table className="pricing-comparison-table" style={{ width: '100%', borderCollapse: 'collapse' }}>
        <thead>
          <tr style={{ backgroundColor: 'var(--surface2)', borderBottom: '2px solid var(--border)' }}>
            <th style={{ padding: '16px', textAlign: 'left', fontWeight: 600, color: 'var(--text)' }}>
              Característica
            </th>
            <th style={{ padding: '16px', textAlign: 'center', fontWeight: 600, color: 'var(--text)' }}>
              Plan Gratuito
            </th>
            <th style={{ padding: '16px', textAlign: 'center', fontWeight: 600, color: 'var(--accent)' }}>
              Plan Pro
            </th>
            <th style={{ padding: '16px', textAlign: 'center', fontWeight: 600, color: 'var(--accent)' }}>
              Plan Empresarial
            </th>
          </tr>
        </thead>
        <tbody>
          {COMPARISON_TABLE.map((section, sectionIdx) => (
            <tbody key={sectionIdx}>
              <tr style={{ backgroundColor: 'var(--surface)', borderTop: '16px solid var(--bg)' }}>
                <td colSpan={4} style={{ padding: '12px 16px', fontWeight: 700, fontSize: '13px', color: 'var(--text2)', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                  {section.category}
                </td>
              </tr>
              {section.items.map((item, itemIdx) => (
                <tr
                  key={itemIdx}
                  style={{
                    borderBottom: '1px solid var(--border)',
                    backgroundColor: itemIdx % 2 === 0 ? 'transparent' : 'var(--surface2)',
                  }}
                >
                  <td style={{ padding: '12px 16px', color: 'var(--text)', fontSize: '14px' }}>
                    {item.label}
                  </td>
                  <td style={{ padding: '12px 16px', textAlign: 'center', color: 'var(--text2)', fontSize: '14px' }}>
                    {item.free}
                  </td>
                  <td style={{ padding: '12px 16px', textAlign: 'center', color: 'var(--accent)', fontSize: '14px', fontWeight: 500 }}>
                    {item.pro}
                  </td>
                  <td style={{ padding: '12px 16px', textAlign: 'center', color: 'var(--accent)', fontSize: '14px', fontWeight: 500 }}>
                    {item.enterprise}
                  </td>
                </tr>
              ))}
            </tbody>
          ))}
        </tbody>
      </table>

      <div style={{ marginTop: '32px', paddingTop: '32px', borderTop: '2px solid var(--border)' }}>
        <h3 style={{ marginBottom: '16px', color: 'var(--text)', fontSize: '16px', fontWeight: 700 }}>
          Información de Precios de IA
        </h3>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(250px, 1fr))', gap: '16px' }}>
          <div style={{ padding: '16px', backgroundColor: 'var(--surface)', borderRadius: '8px', border: '1px solid var(--border)' }}>
            <div style={{ fontSize: '12px', color: 'var(--text2)', textTransform: 'uppercase', marginBottom: '8px' }}>
              GPT-4o (Recomendado)
            </div>
            <div style={{ fontSize: '14px', color: 'var(--text)', marginBottom: '4px' }}>
              🔹 Input: <strong>$0.000005</strong> por token
            </div>
            <div style={{ fontSize: '14px', color: 'var(--text)' }}>
              🔹 Output: <strong>$0.000015</strong> por token
            </div>
            <div style={{ fontSize: '11px', color: 'var(--text2)', marginTop: '8px' }}>
              ~$0.03 por análisis cruzado típico
            </div>
          </div>

          <div style={{ padding: '16px', backgroundColor: 'var(--surface)', borderRadius: '8px', border: '1px solid var(--border)' }}>
            <div style={{ fontSize: '12px', color: 'var(--text2)', textTransform: 'uppercase', marginBottom: '8px' }}>
              GPT-3.5 Turbo
            </div>
            <div style={{ fontSize: '14px', color: 'var(--text)', marginBottom: '4px' }}>
              🔹 Input: <strong>$0.0000015</strong> por token
            </div>
            <div style={{ fontSize: '14px', color: 'var(--text)' }}>
              🔹 Output: <strong>$0.000006</strong> por token
            </div>
            <div style={{ fontSize: '11px', color: 'var(--text2)', marginTop: '8px' }}>
              ~$0.01 por análisis cruzado típico
            </div>
          </div>

          <div style={{ padding: '16px', backgroundColor: 'var(--surface)', borderRadius: '8px', border: '1px solid var(--border)' }}>
            <div style={{ fontSize: '12px', color: 'var(--text2)', textTransform: 'uppercase', marginBottom: '8px' }}>
              Almacenamiento
            </div>
            <div style={{ fontSize: '14px', color: 'var(--text)', marginBottom: '4px' }}>
              🔹 Costo: <strong>$0.023</strong> por GB/mes
            </div>
            <div style={{ fontSize: '14px', color: 'var(--text)' }}>
              🔹 Gratis: <strong>1 GB</strong> por plan
            </div>
            <div style={{ fontSize: '11px', color: 'var(--text2)', marginTop: '8px' }}>
              Solo paga lo que uses
            </div>
          </div>
        </div>
      </div>

      <div style={{ marginTop: '32px', paddingTop: '32px', borderTop: '2px solid var(--border)' }}>
        <h3 style={{ marginBottom: '16px', color: 'var(--text)', fontSize: '16px', fontWeight: 700 }}>
          Límites de Rate Limiting
        </h3>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(250px, 1fr))', gap: '16px' }}>
          {[
            { plan: 'Plan Gratuito', minRate: '10 req/min', hourRate: '500 req/hora' },
            { plan: 'Plan Pro', minRate: '60 req/min', hourRate: '10,000 req/hora' },
            { plan: 'Plan Empresarial', minRate: '1,000 req/min', hourRate: 'Sin límite' },
          ].map((tier, idx) => (
            <div key={idx} style={{ padding: '16px', backgroundColor: 'var(--surface)', borderRadius: '8px', border: '1px solid var(--border)' }}>
              <div style={{ fontSize: '13px', color: 'var(--text2)', textTransform: 'uppercase', marginBottom: '8px', fontWeight: 600 }}>
                {tier.plan}
              </div>
              <div style={{ fontSize: '14px', color: 'var(--text)', marginBottom: '4px' }}>
                ⚡ {tier.minRate}
              </div>
              <div style={{ fontSize: '14px', color: 'var(--text)' }}>
                ⚡ {tier.hourRate}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
