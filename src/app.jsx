import React from 'react';
import { Navbar, Nav, Container } from 'react-bootstrap';
import { BrowserRouter, NavLink, Route, Routes } from 'react-router-dom';
import 'bootstrap/dist/css/bootstrap.min.css';
import './app.css';
import { Home } from './home/home';
import { Game } from './game/game';
import { Leaderboard } from './leaderboard/leaderboard';
import { Profile } from './profile/profile';
import { Login } from './login/login';
import { CreateAccount } from './createAccount/createAccount';


export default function App() {
  return (
    <div className="body">
      <header>
        <Navbar expand="md" variant="dark" style={{ backgroundColor: '#f7446a' }}>
          <Container fluid>
            <Navbar.Brand href="/" className="d-flex align-items-center gap-2">
              <img src="/EarShotLogo.png" alt="EarShot logo" width="40" height="40" />
              EarShot
            </Navbar.Brand>
            <Navbar.Toggle aria-controls="nav-menu" />
            <Navbar.Collapse id="nav-menu">
              <Nav className="ms-auto">
                <Nav.Link href="/">Home</Nav.Link>
                <Nav.Link href="/game">Play</Nav.Link>
                <Nav.Link href="/leaderboard">Leaderboard</Nav.Link>
                <Nav.Link href="/profile">Profile</Nav.Link>
              </Nav>
            </Navbar.Collapse>
          </Container>
        </Navbar>
      </header>

      <main>App components go here</main>

      <footer className="container-fluid">
        <span className="text-reset">&copy; 2026 EarShot. Built for CS 260.</span>
        <a className="text-reset" href="https://github.com/E-Rob19/startup">
          Source
        </a>
      </footer>
    </div>
  );
}
