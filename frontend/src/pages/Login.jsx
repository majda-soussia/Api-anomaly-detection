// frontend/src/pages/Login.jsx
import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:4000';

// LogPulse logo SVG inlined — black strokes, designed for light backgrounds
const LogPulseLogo = () => (
  <svg width="160" viewBox="0 0 680 200" xmlns="http://www.w3.org/2000/svg" aria-label="LogPulse">
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
  @import url('https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600&display=swap');

  *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }

  html, body { background: #FAFAF8; }

  .login-root {
    min-height: 100vh;
    background: #FAFAF8;
    display: flex;
    align-items: center;
    justify-content: center;
    font-family: 'Inter', sans-serif;
    padding: 24px;
  }

  .login-wrapper {
    width: 100%;
    max-width: 420px;
  }

  .login-brand {
    text-align: center;
    margin-bottom: 40px;
  }

  .login-tagline {
    margin-top: 14px;
    font-size: 13px;
    font-weight: 400;
    color: #9CA3AF;
    letter-spacing: 0.04em;
  }

  .login-card {
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
    margin-bottom: 28px;
  }

  .form-group { margin-bottom: 18px; }

  .form-label {
    display: block;
    font-size: 12px;
    font-weight: 500;
    color: #374151;
    margin-bottom: 7px;
    letter-spacing: 0.01em;
  }

  .form-input {
    width: 100%;
    background: #FAFAF8;
    border: 1px solid #E5E4DF;
    border-radius: 8px;
    padding: 11px 14px;
    font-size: 14px;
    font-family: 'Inter', sans-serif;
    color: #111111;
    outline: none;
    transition: border-color 0.15s, box-shadow 0.15s;
  }

  .form-input::placeholder { color: #C4C3BC; }

  .form-input:focus {
    border-color: #1A1A2E;
    box-shadow: 0 0 0 3px rgba(26,26,46,0.07);
    background: #FFFFFF;
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
    width: 5px;
    height: 5px;
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
    margin-top: 6px;
    letter-spacing: 0.01em;
  }

  .submit-btn:hover:not(:disabled) { background: #2D2D4E; }
  .submit-btn:active:not(:disabled) { transform: scale(0.995); }
  .submit-btn:disabled { opacity: 0.45; cursor: not-allowed; }

  .login-footer {
    text-align: center;
    margin-top: 20px;
    font-size: 12px;
    color: #C4C3BC;
  }
.login-link {
  margin-top: 20px;
  text-align: center;
  font-size: 13px;
  color: #6B7280;
}

.login-link a {
  color: #1A1A2E;
  font-weight: 600;
  text-decoration: none;
}

.login-link a:hover {
  text-decoration: underline;
}
`;

export default function Login() {
  const navigate = useNavigate();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  async function handleSubmit(e) {
    e.preventDefault();
    setError('');
    setIsSubmitting(true);

    try {
      const res = await fetch(`${API_URL}/api/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password }),
      });
      const data = await res.json();

      if (!res.ok) {
        setError(data.error || 'Authentication failed. Please try again.');
        setIsSubmitting(false);
        return;
      }

      navigate('/verify-2fa', { state: { pendingToken: data.pendingToken, email } });
    } catch {
      setError('Unable to reach the server. Check your connection.');
      setIsSubmitting(false);
    }
  }

  return (
    <>
      <style>{styles}</style>
      <div className="login-root">
        <div className="login-wrapper">
          <div className="login-brand">
            <LogPulseLogo />
            <p className="login-tagline">Monitoring Dashboard</p>
          </div>

          <div className="login-card">
            <h1 className="card-heading">Sign in to your account</h1>
            <p className="card-sub">Enter your credentials to continue.</p>

            <form onSubmit={handleSubmit}>
              <div className="form-group">
                <label className="form-label" htmlFor="email">Email address</label>
                <input
                  id="email"
                  type="email"
                  className="form-input"
                  placeholder="you@example.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                  autoComplete="email"
                />
              </div>

              <div className="form-group">
                <label className="form-label" htmlFor="password">Password</label>
                <input
                  id="password"
                  type="password"
                  className="form-input"
                  placeholder="Enter your password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  autoComplete="current-password"
                />
              </div>

              {error && (
                <div className="form-error">
                  <span className="form-error-dot" />
                  {error}
                </div>
              )}

              <button type="submit" className="submit-btn" disabled={isSubmitting}>
                {isSubmitting ? 'Signing in...' : 'Sign in'}
              </button>
            </form>
            <div className="login-link">
                    Don't have an account?{" "}
                    <Link to="/register">
                    Create account
                    </Link>
                </div>
            
          </div>

          <p className="login-footer">
            A verification code will be sent to your email address.
          </p>
        </div>
      </div>
    </>
  );
}