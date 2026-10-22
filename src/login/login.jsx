import React from 'react';
import { NavLink, useNavigate } from 'react-router-dom';
import { AuthState } from './authState';
import { login } from '../services/authService';

export function Login({ onAuthChange }) {
  const [userName, setUserName] = React.useState('');
  const [password, setPassword] = React.useState('');
  const [error, setError] = React.useState('');
  const navigate = useNavigate();

  async function handleSubmit(e) {
    e.preventDefault();
    try {
      const user = await login(userName.trim(), password);
      onAuthChange(user.userName, AuthState.Authenticated);
      navigate('/game');
    } catch (err) {
      setError(err.message);
    }
  }

  return (
    <main>
      <section id="login">
        <h2>Login</h2>
        <form onSubmit={handleSubmit}>
          <div>
            <label htmlFor="username" className="form-label">Username</label>
            <input
              type="text"
              id="username"
              className="form-control"
              value={userName}
              onChange={(e) => setUserName(e.target.value)}
              required
            />
          </div>
          <div>
            <label htmlFor="password" className="form-label">Password</label>
            <input
              type="password"
              id="password"
              className="form-control"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
            />
          </div>
          {error && <p className="text-danger" role="alert">{error}</p>}
          <button type="submit" className="btn" disabled={!userName.trim() || !password}>Login</button>
        </form>
        <p>Don't have an account? <NavLink to="/createAccount">Create one</NavLink></p>
      </section>

      <section id="security-note">
        <h2>Secure by Default</h2>
        <p>
          Login traffic will be sent over HTTPS, and passwords will be hashed with BCrypt before
          being stored in the database. Once authenticated, your saved rounds and personal history
          will appear on your profile.
        </p>
      </section>
    </main>
  );
}
