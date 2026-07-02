// frontend/src/pages/Verify2FA.jsx
import { useState, useRef, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:4000';

const LogPulseLogo = () => (
  <svg width="140" viewBox="0 0 680 200" xmlns="http://www.w3.org/2000/svg" aria-label="LogPulse">
    <circle cx="150" cy="100" r="52" fill="none" stroke="#111111" strokeWidth="1.5" />
    <path d="M 106,100 L 122,100 L 128,76 L 136,128 L 143,100 L 149,86 L 155,100 L 194,100"
      fill="none" stroke="#111111" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
    <text fontFamily="'Helvetica Neue', Helvetica, Arial, sans-serif" fontSize="56" y="117">
      <tspan x="228" fontWeight="200" fill="#111111" opacity="0.55">Log</tspan>
      <tspan fontWeight="300" fill="#111111">Pulse</tspan>
    </text>
  </svg>
);

const styles = `
  @import url('https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600&family=JetBrains+Mono:wght@500;600&display=swap');

  *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }

  html, body { background: #FAFAF8; }

  .v2fa-root {
    min-height: 100vh;
    background: #FAFAF8;
    display: flex;
    align-items: center;
    justify-content: center;
    font-family: 'Inter', sans-serif;
    padding: 24px;
  }

  .v2fa-wrapper { width: 100%; max-width: 420px; }

  .v2fa-brand { text-align: center; margin-bottom: 40px; }

  .v2fa-tagline {
    margin-top: 14px;
    font-size: 13px;
    color: #9CA3AF;
    letter-spacing: 0.04em;
  }

  .v2fa-card {
    background: #FFFFFF;
    border: 1px solid #E5E4DF;
    border-radius: 16px;
    padding: 40px 36px;
    box-shadow: 0 1px 3px rgba(0,0,0,0.04), 0 4px 16px rgba(0,0,0,0.04);
  }

  .card-heading {
    font-size: 16px;
    font-weight: 600;
    color: #111111;
    margin-bottom: 6px;
    letter-spacing: -0.01em;
  }

  .card-sub {
    font-size: 13px;
    color: #9CA3AF;
    margin-bottom: 32px;
    line-height: 1.6;
  }

  .card-sub strong { color: #374151; font-weight: 500; }

  .otp-row {
    display: flex;
    gap: 8px;
    justify-content: center;
    margin-bottom: 28px;
  }

  .otp-cell {
    width: 52px;
    height: 60px;
    background: #FAFAF8;
    border: 1px solid #E5E4DF;
    border-radius: 8px;
    font-size: 22px;
    font-weight: 600;
    font-family: 'JetBrains Mono', monospace;
    color: #111111;
    text-align: center;
    outline: none;
    transition: border-color 0.15s, box-shadow 0.15s, background 0.15s;
    caret-color: #1A1A2E;
  }

  .otp-cell:focus {
    border-color: #1A1A2E;
    box-shadow: 0 0 0 3px rgba(26,26,46,0.07);
    background: #FFFFFF;
  }

  .otp-cell.filled {
    border-color: #A5B4FC;
    background: #F5F3FF;
    color: #1A1A2E;
  }

  .form-error {
    display: flex;
    align-items: flex-start;
    gap: 9px;
    background: #FEF2F2;
    border: 1px solid #FECACA;
    border-radius: 8px;
    padding: 11px 14px;
    font-size: 13px;
    color: #991B1B;
    margin-bottom: 18px;
    line-height: 1.5;
  }

  .form-error-dot {
    width: 5px; height: 5px;
    border-radius: 50%;
    background: #EF4444;
    flex-shrink: 0;
    margin-top: 5px;
  }

  .submit-btn {
    width: 100%;
    background: #1A1A2E;
    border: none;
    border-radius: 8px;
    padding: 13px;
    font-size: 14px;
    font-weight: 500;
    font-family: 'Inter', sans-serif;
    color: #FFFFFF;
    cursor: pointer;
    transition: background 0.15s, transform 0.1s;
    letter-spacing: 0.01em;
  }

  .submit-btn:hover:not(:disabled) { background: #2D2D4E; }
  .submit-btn:active:not(:disabled) { transform: scale(0.995); }
  .submit-btn:disabled { opacity: 0.35; cursor: not-allowed; }

  .back-link {
    display: block;
    text-align: center;
    margin-top: 18px;
    font-size: 13px;
    color: #9CA3AF;
    cursor: pointer;
    transition: color 0.15s;
    text-decoration: none;
  }

  .back-link:hover { color: #374151; }

  .expiry-note {
    text-align: center;
    margin-top: 12px;
    font-size: 12px;
    color: #C4C3BC;
  }
`;

const OTP_LENGTH = 6;

export default function Verify2FA() {
  const navigate = useNavigate();
  const location = useLocation();
  const { login } = useAuth();

  const pendingToken = location.state?.pendingToken;
  const email = location.state?.email;

  const [digits, setDigits] = useState(Array(OTP_LENGTH).fill(''));
  const [error, setError] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const inputRefs = useRef([]);

  useEffect(() => {
    if (!pendingToken) { navigate('/login'); return; }
    inputRefs.current[0]?.focus();
  }, [pendingToken, navigate]);

  function handleChange(index, value) {
    const char = value.replace(/\D/g, '').slice(-1);
    const next = [...digits];
    next[index] = char;
    setDigits(next);
    if (char && index < OTP_LENGTH - 1) inputRefs.current[index + 1]?.focus();
  }

  function handleKeyDown(index, e) {
    if (e.key === 'Backspace' && !digits[index] && index > 0) {
      inputRefs.current[index - 1]?.focus();
    }
  }

  function handlePaste(e) {
    e.preventDefault();
    const pasted = e.clipboardData.getData('text').replace(/\D/g, '').slice(0, OTP_LENGTH);
    if (!pasted) return;
    const next = [...digits];
    pasted.split('').forEach((c, i) => { next[i] = c; });
    setDigits(next);
    const lastFilled = Math.min(pasted.length, OTP_LENGTH - 1);
    inputRefs.current[lastFilled]?.focus();
  }

  const code = digits.join('');
  const isComplete = code.length === OTP_LENGTH;

  async function handleSubmit(e) {
    e.preventDefault();
    if (!isComplete) return;
    setError('');
    setIsSubmitting(true);

    try {
      const res = await fetch(`${API_URL}/api/auth/verify-2fa`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ pendingToken, code }),
      });
      const data = await res.json();

      if (!res.ok) {
        setError(data.error || 'Invalid code. Please try again.');
        setDigits(Array(OTP_LENGTH).fill(''));
        inputRefs.current[0]?.focus();
        setIsSubmitting(false);
        return;
      }

      login(data.user, data.accessToken);
      navigate('/overview');
    } catch {
      setError('Unable to reach the server. Check your connection.');
      setIsSubmitting(false);
    }
  }

  return (
    <>
      <style>{styles}</style>
      <div className="v2fa-root">
        <div className="v2fa-wrapper">
          <div className="v2fa-brand">
            <LogPulseLogo />
            <p className="v2fa-tagline">Monitoring Dashboard</p>
          </div>

          <div className="v2fa-card">
            <h1 className="card-heading">Two-factor verification</h1>
            <p className="card-sub">
              A 6-digit code was sent to <strong>{email}</strong>.<br />
              Enter it below to complete sign in.
            </p>

            <form onSubmit={handleSubmit}>
              <div className="otp-row" onPaste={handlePaste}>
                {digits.map((d, i) => (
                  <input
                    key={i}
                    ref={(el) => (inputRefs.current[i] = el)}
                    type="text"
                    inputMode="numeric"
                    maxLength={1}
                    value={d}
                    onChange={(e) => handleChange(i, e.target.value)}
                    onKeyDown={(e) => handleKeyDown(i, e)}
                    className={`otp-cell${d ? ' filled' : ''}`}
                    autoComplete="one-time-code"
                  />
                ))}
              </div>

              {error && (
                <div className="form-error">
                  <span className="form-error-dot" />
                  {error}
                </div>
              )}

              <button
                type="submit"
                className="submit-btn"
                disabled={!isComplete || isSubmitting}
              >
                {isSubmitting ? 'Verifying...' : 'Verify and sign in'}
              </button>
            </form>
          </div>

          <span className="back-link" onClick={() => navigate('/login')}>
            Back to sign in
          </span>
          <p className="expiry-note">Code expires in 5 minutes.</p>
        </div>
      </div>
    </>
  );
}