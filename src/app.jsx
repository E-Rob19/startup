import React from 'react';
import { Navbar, Nav, Container } from 'react-bootstrap';
import { BrowserRouter, Navigate, NavLink, Route, Routes } from 'react-router-dom';
import 'bootstrap/dist/css/bootstrap.min.css';
import './app.css';
import { Home } from './home/home';
import { Game } from './game/game';
import { Leaderboard } from './leaderboard/leaderboard';
import { Profile } from './profile/profile';
import { Login } from './login/login';
import { CreateAccount } from './createAccount/createAccount';
import { AuthState } from './login/authState';
import { clearStoredUserName, getCurrentUser, getStoredUserName, logout } from './services/authService';


export default function App() {
  const [userName, setUserName] = React.useState(getStoredUserName());
  const currentAuthState = userName ? AuthState.Authenticated : AuthState.Unauthenticated;
  const [authState, setAuthState] = React.useState(currentAuthState);

  function onAuthChange(userName, authState) {
    setUserName(userName);
    setAuthState(authState);
  }

  function handleLogout() {
    logout();
    onAuthChange('', AuthState.Unauthenticated);
  }

  // A page got a 401: the server no longer recognizes our cookie (it expired,
  // or the server restarted). Show the user as logged out to match.
  // useCallback keeps it the same function between renders, so pages can list
  // it in a useEffect's dependencies without re-running the effect every time.
  const handleSessionExpired = React.useCallback(() => {
    clearStoredUserName();
    setUserName('');
    setAuthState(AuthState.Unauthenticated);
  }, []);

  // On startup, check with the server that the stored name is still really
  // logged in. localStorage only remembers the name; the cookie is what counts,
  // and the server may have forgotten it (e.g. it restarted). Runs once.
  React.useEffect(() => {
    let ignore = false;
    getCurrentUser()
      .then((user) => {
        if (ignore) return;
        if (user) {
          // Valid session: trust the server's name (this also restores the
          // navbar if localStorage was cleared but the cookie is still good).
          onAuthChange(user.userName, AuthState.Authenticated);
        } else {
          handleSessionExpired();
        }
      })
      .catch(() => {
        // Server unreachable: keep showing what localStorage says. Pages that
        // need the server will report the problem themselves.
      });
    return () => {
      ignore = true;
    };
  }, [handleSessionExpired]);

  return (
    <BrowserRouter>
      <div className="body">
        <header>
          <Navbar expand="md" variant="dark" style={{ backgroundColor: '#f7446a' }}>
            <Container fluid>
              <Navbar.Brand as={NavLink} to="/" className="d-flex align-items-center gap-2">
                <img src="/EarShotLogo.png" alt="EarShot logo" width="40" height="40" />
                EarShot
              </Navbar.Brand>
              <Navbar.Toggle aria-controls="nav-menu" />
              <Navbar.Collapse id="nav-menu">
                <Nav className="ms-auto">
                  <NavLink className="nav-link" to="/">Home</NavLink>
                  <NavLink className="nav-link" to="game">Play</NavLink>
                  <NavLink className="nav-link" to="leaderboard">Leaderboard</NavLink>
                  {authState === AuthState.Authenticated && (
                    <NavLink className="nav-link" to="profile">Profile</NavLink>
                  )}
                  {authState === AuthState.Authenticated ? (
                    <NavLink className="nav-link" to="/" onClick={handleLogout}>Logout</NavLink>
                  ) : (
                    <NavLink className="nav-link" to="login">Login</NavLink>
                  )}
                </Nav>
              </Navbar.Collapse>
            </Container>
          </Navbar>
        </header>

        <Routes>
          <Route path="/" element={<Home userName={userName} authState={authState} />} />
          <Route
            path="/game"
            element={<Game userName={userName} authState={authState} onSessionExpired={handleSessionExpired} />}
          />
          <Route path="/leaderboard" element={<Leaderboard userName={userName} />} />
          <Route
            path="/profile"
            element={
              authState === AuthState.Authenticated ? (
                <Profile userName={userName} onSessionExpired={handleSessionExpired} />
              ) : (
                <Navigate to="/login" replace />
              )
            }
          />
          <Route path="/login" element={<Login onAuthChange={onAuthChange} />} />
          <Route path="/createAccount" element={<CreateAccount onAuthChange={onAuthChange} />} />
          <Route path="*" element={<NotFound />} />
        </Routes>

        <footer className="container-fluid">
          <span className="text-reset">&copy; 2026 EarShot. Built for CS 260.</span>
          <a className="text-reset" href="https://github.com/E-Rob19/startup">
            Source
          </a>
        </footer>
      </div>
    </BrowserRouter>
  );
}

function NotFound() {
  return <main className="container-fluid bg-secondary text-center">404: Return to sender. Address unknown.</main>;
}
