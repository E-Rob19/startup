import React from 'react';
import { NavLink, useNavigate } from 'react-router-dom';
import { AuthState } from '../login/authState';
import { register } from '../services/authService';

export function CreateAccount({ onAuthChange }) {
  const [userName, setUserName] = React.useState('');
  const [password, setPassword] = React.useState('');
  const [confirmPassword, setConfirmPassword] = React.useState('');
  const [error, setError] = React.useState('');
  const navigate = useNavigate();

  async function handleSubmit(e) {
    e.preventDefault();
    if (password !== confirmPassword) {
      setError("Passwords don't match.");
      return;
    }
    try {
      const user = await register(userName.trim(), password);
      onAuthChange(user.userName, AuthState.Authenticated);
      navigate('/game');
    } catch (err) {
      setError(err.message);
    }
  }

  return (
    <main>
      <section id="create-account">
        <h2>Create Account</h2>
        <form onSubmit={handleSubmit}>
          <div>
            <label htmlFor="new-username" className="form-label">Username</label>
            <input
              type="text"
              id="new-username"
              className="form-control"
              value={userName}
              onChange={(e) => setUserName(e.target.value)}
              required
            />
          </div>
          <div>
            <label htmlFor="new-password" className="form-label">Password</label>
            <input
              type="password"
              id="new-password"
              className="form-control"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
            />
          </div>
          <div>
            <label htmlFor="confirm-password" className="form-label">Confirm Password</label>
            <input
              type="password"
              id="confirm-password"
              className="form-control"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              required
            />
          </div>
          {error && <p className="text-danger" role="alert">{error}</p>}
          <button
            type="submit"
            className="btn"
            disabled={!userName.trim() || !password || !confirmPassword}
          >
            Create Account
          </button>
        </form>
        <p>Already have an account? <NavLink to="/login">Login</NavLink></p>
      </section>

      <section id="security-note">
        <h2>Secure by Default</h2>
        <p>
          Your password will be hashed with BCrypt before being stored, and all traffic to and
          from EarShot is sent over HTTPS.
        </p>
      </section>
    </main>
  );
}
