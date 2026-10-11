import React from 'react';
import { NavLink } from 'react-router-dom';

export function Login() {
  return (
    <main>
      <section id="login">
        <h2>Login</h2>
        <p className="placeholder-tag">[Placeholder: Authentication]</p>
        <form action="#" method="post">
          <div>
            <label htmlFor="username" className="form-label">Username</label>
            <input type="text" id="username" name="username" className="form-control" required />
          </div>
          <div>
            <label htmlFor="password" className="form-label">Password</label>
            <input type="password" id="password" name="password" className="form-control" required />
          </div>
          <button type="submit" className="btn">Login</button>
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
