import React from 'react';
import { NavLink } from 'react-router-dom';

export function CreateAccount() {
  return (
    <main>
      <section id="create-account">
        <h2>Create Account</h2>
        <p className="placeholder-tag">[Placeholder: Authentication]</p>
        <form action="#" method="post">
          <div>
            <label htmlFor="new-username" className="form-label">Username</label>
            <input type="text" id="new-username" name="new-username" className="form-control" required />
          </div>
          <div>
            <label htmlFor="new-password" className="form-label">Password</label>
            <input type="password" id="new-password" name="new-password" className="form-control" required />
          </div>
          <div>
            <label htmlFor="confirm-password" className="form-label">Confirm Password</label>
            <input type="password" id="confirm-password" name="confirm-password" className="form-control" required />
          </div>
          <button type="submit" className="btn">Create Account</button>
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
