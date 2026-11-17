// client/src/pages/CreditsPage.jsx
import React, { useState, useEffect } from 'react';
import api from '../services/api';
import { useAuth } from '../context/AuthContext';
import LoadingSpinner from '../components/LoadingSpinner';
import {
  Coins,
  CreditCard,
  Check,
  Sparkles,
  ArrowUpRight,
  ArrowDownLeft,
  Clock,
  ShieldCheck,
  AlertCircle,
  CheckCircle,
} from 'lucide-react';

export default function CreditsPage() {
  const { user, refreshUser } = useAuth();
  const [packages, setPackages] = useState([]);
  const [transactions, setTransactions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [purchasingId, setPurchasingId] = useState(null);
  const [successMessage, setSuccessMessage] = useState('');
  const [errorMessage, setErrorMessage] = useState('');

  const fetchData = async () => {
    try {
      const [pkgRes, txRes] = await Promise.all([
        api.get('/credits/packages'),
        api.get('/credits/transactions?limit=25'),
      ]);

      if (pkgRes.data.success) {
        setPackages(pkgRes.data.packages || []);
      }
      if (txRes.data.success) {
        setTransactions(txRes.data.transactions || []);
      }
    } catch (err) {
      console.error('Credits data load error:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  const handlePurchase = async (pkg) => {
    if (pkg.price === 0) {
      alert('Free package is already granted upon account registration.');
      return;
    }

    setPurchasingId(pkg.id);
    setSuccessMessage('');
    setErrorMessage('');

    try {
      const res = await api.post('/credits/purchase', { packageId: pkg.id });
      if (res.data.success) {
        setSuccessMessage(`Successfully purchased ${pkg.name} package (+${pkg.credits} credits)!`);
        await refreshUser();
        fetchData();
      }
    } catch (err) {
      setErrorMessage(err.response?.data?.message || 'Failed to complete credit purchase.');
    } finally {
      setPurchasingId(null);
    }
  };

  return (
    <div className="container" style={{ padding: '36px 20px 80px' }}>
      {/* Page Header */}
      <div style={{ marginBottom: '32px' }}>
        <h1 style={{ fontSize: '26px', marginBottom: '6px' }}>My Credits & Packages</h1>
        <p style={{ color: 'var(--text-secondary)', fontSize: '14px' }}>
          Transparent credit pricing. 2 credits per generated video clip. Unused credits never expire.
        </p>
      </div>

      {successMessage && (
        <div className="alert alert-success" style={{ marginBottom: '24px' }}>
          <CheckCircle size={18} />
          <span>{successMessage}</span>
        </div>
      )}

      {errorMessage && (
        <div className="alert alert-error" style={{ marginBottom: '24px' }}>
          <AlertCircle size={18} />
          <span>{errorMessage}</span>
        </div>
      )}

      {/* Credit Balance Card */}
      <div
        className="card"
        style={{
          background: 'linear-gradient(135deg, #101612 0%, #151C18 100%)',
          border: '1px solid rgba(34, 197, 94, 0.3)',
          padding: '28px',
          marginBottom: '40px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          flexWrap: 'wrap',
          gap: '20px',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '18px' }}>
          <div
            style={{
              width: '56px',
              height: '56px',
              borderRadius: 'var(--radius-lg)',
              background: 'var(--green-light)',
              border: '1px solid var(--green-primary)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: 'var(--green-accent)',
            }}
          >
            <Coins size={28} />
          </div>
          <div>
            <div style={{ fontSize: '13px', color: 'var(--text-secondary)', fontWeight: 500, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
              Available Balance
            </div>
            <div style={{ fontSize: '36px', fontWeight: 800, color: 'var(--text-primary)' }}>
              {user?.credits ?? 0} <span style={{ fontSize: '18px', fontWeight: 600, color: 'var(--green-accent)' }}>Credits</span>
            </div>
          </div>
        </div>

        <div style={{ textAlign: 'right', display: 'flex', flexDirection: 'column', gap: '4px' }}>
          <div style={{ fontSize: '13px', color: 'var(--text-secondary)' }}>
            Estimated Capacity: ~{Math.floor((user?.credits ?? 0) / 2)} short clips
          </div>
          <div style={{ fontSize: '12px', color: 'var(--text-muted)' }}>
            Cost rate: 2 credits / clip (Reserved during processing, refunded on failure)
          </div>
        </div>
      </div>

      {/* Pricing Packages Section (Section 10) */}
      <div style={{ marginBottom: '48px' }}>
        <div style={{ marginBottom: '20px' }}>
          <h2 style={{ fontSize: '20px', marginBottom: '4px' }}>Choose a Credit Package</h2>
          <p style={{ fontSize: '13px', color: 'var(--text-secondary)' }}>
            Instant credit activation. Razorpay and card payment integration ready.
          </p>
        </div>

        {loading ? (
          <LoadingSpinner text="Loading credit packages..." />
        ) : (
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
              gap: '18px',
            }}
          >
            {packages.map((pkg) => (
              <div
                key={pkg.id}
                className="card"
                style={{
                  position: 'relative',
                  display: 'flex',
                  flexDirection: 'column',
                  padding: '24px',
                  border: pkg.isPopular ? '2px solid var(--green-accent)' : '1px solid var(--border)',
                  boxShadow: pkg.isPopular ? 'var(--shadow-glow)' : 'none',
                }}
              >
                {pkg.isPopular && (
                  <div
                    style={{
                      position: 'absolute',
                      top: '-12px',
                      right: '16px',
                      background: 'var(--green-accent)',
                      color: '#090D0B',
                      fontSize: '11px',
                      fontWeight: 800,
                      padding: '2px 8px',
                      borderRadius: 'var(--radius-full)',
                      textTransform: 'uppercase',
                    }}
                  >
                    Best Value
                  </div>
                )}

                <div style={{ fontSize: '14px', fontWeight: 700, color: 'var(--text-secondary)', marginBottom: '8px' }}>
                  {pkg.name}
                </div>

                <div style={{ display: 'flex', alignItems: 'baseline', gap: '4px', marginBottom: '14px' }}>
                  <span style={{ fontSize: '32px', fontWeight: 800 }}>
                    {pkg.price === 0 ? 'Free' : `₹${pkg.price}`}
                  </span>
                  {pkg.price > 0 && <span style={{ fontSize: '12px', color: 'var(--text-muted)' }}>one-time</span>}
                </div>

                <div
                  style={{
                    padding: '8px 12px',
                    background: 'var(--bg-secondary)',
                    borderRadius: 'var(--radius-sm)',
                    fontSize: '14px',
                    fontWeight: 700,
                    color: 'var(--green-accent)',
                    marginBottom: '16px',
                  }}
                >
                  {pkg.credits} Credits
                </div>

                <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', marginBottom: '24px', flex: 1 }}>
                  {(pkg.features || []).map((feat, idx) => (
                    <div key={idx} style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '12px', color: 'var(--text-secondary)' }}>
                      <Check size={14} color="var(--green-accent)" style={{ flexShrink: 0 }} />
                      <span>{feat}</span>
                    </div>
                  ))}
                </div>

                <button
                  onClick={() => handlePurchase(pkg)}
                  className={`btn ${pkg.isPopular ? 'btn-primary' : 'btn-secondary'}`}
                  disabled={purchasingId === pkg.id || pkg.price === 0}
                  style={{ width: '100%', marginTop: 'auto' }}
                >
                  {purchasingId === pkg.id ? (
                    'Processing...'
                  ) : pkg.price === 0 ? (
                    'Included at Signup'
                  ) : (
                    <>
                      <CreditCard size={15} /> Buy for ₹{pkg.price}
                    </>
                  )}
                </button>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Transaction History Section */}
      <div>
        <div style={{ marginBottom: '16px' }}>
          <h2 style={{ fontSize: '20px', marginBottom: '4px' }}>Transaction History</h2>
          <p style={{ fontSize: '13px', color: 'var(--text-secondary)' }}>
            Complete audit trail of all credit deposits, reservations, deductions, and refunds.
          </p>
        </div>

        <div className="card" style={{ padding: '0', overflow: 'hidden' }}>
          {transactions.length === 0 ? (
            <div style={{ padding: '32px', textAlign: 'center', color: 'var(--text-secondary)' }}>
              No transactions recorded yet.
            </div>
          ) : (
            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '13px' }}>
                <thead>
                  <tr style={{ background: 'var(--bg-secondary)', borderBottom: '1px solid var(--border)' }}>
                    <th style={{ padding: '12px 18px', color: 'var(--text-secondary)', fontWeight: 600 }}>Date & Time</th>
                    <th style={{ padding: '12px 18px', color: 'var(--text-secondary)', fontWeight: 600 }}>Type</th>
                    <th style={{ padding: '12px 18px', color: 'var(--text-secondary)', fontWeight: 600 }}>Description</th>
                    <th style={{ padding: '12px 18px', color: 'var(--text-secondary)', fontWeight: 600 }}>Amount</th>
                    <th style={{ padding: '12px 18px', color: 'var(--text-secondary)', fontWeight: 600 }}>Balance</th>
                    <th style={{ padding: '12px 18px', color: 'var(--text-secondary)', fontWeight: 600 }}>Status</th>
                  </tr>
                </thead>
                <tbody>
                  {transactions.map((tx) => (
                    <tr key={tx._id} style={{ borderBottom: '1px solid var(--border)' }}>
                      <td style={{ padding: '12px 18px', color: 'var(--text-muted)' }}>
                        {new Date(tx.createdAt).toLocaleString()}
                      </td>
                      <td style={{ padding: '12px 18px', fontWeight: 600 }}>
                        <span
                          style={{
                            textTransform: 'capitalize',
                            color: tx.amount > 0 ? 'var(--green-accent)' : 'var(--text-primary)',
                          }}
                        >
                          {tx.type.replace('_', ' ')}
                        </span>
                      </td>
                      <td style={{ padding: '12px 18px', color: 'var(--text-secondary)' }}>
                        {tx.description}
                      </td>
                      <td
                        style={{
                          padding: '12px 18px',
                          fontWeight: 700,
                          color: tx.amount > 0 ? 'var(--green-accent)' : 'var(--red-accent)',
                        }}
                      >
                        {tx.amount > 0 ? `+${tx.amount}` : tx.amount}
                      </td>
                      <td style={{ padding: '12px 18px', fontWeight: 600 }}>
                        {tx.balanceAfter}
                      </td>
                      <td style={{ padding: '12px 18px' }}>
                        <span
                          className={`badge ${
                            tx.status === 'completed'
                              ? 'badge-green'
                              : tx.status === 'reserved'
                              ? 'badge-amber'
                              : 'badge-neutral'
                          }`}
                        >
                          {tx.status}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
