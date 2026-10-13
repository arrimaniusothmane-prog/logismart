import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, screen, cleanup } from '@testing-library/react';
import { MemoryRouter, Routes, Route } from 'react-router-dom';
import { ClientRoutes } from '../routes';

// Mock matchMedia
Object.defineProperty(window, 'matchMedia', {
  writable: true,
  value: vi.fn().mockImplementation((query) => ({
    matches: false,
    media: query,
    onchange: null,
    addListener: vi.fn(),
    removeListener: vi.fn(),
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
    dispatchEvent: vi.fn(),
  })),
});

// Mock ResizeObserver
global.ResizeObserver = class {
  observe() {}
  unobserve() {}
  disconnect() {}
} as unknown as typeof ResizeObserver;

describe('Client Routes with Parent Router', () => {
  afterEach(() => {
    cleanup();
  });

  it('renders ClientLoginPage when navigating to /client/login', async () => {
    render(
      <MemoryRouter initialEntries={['/client/login']}>
        <Routes>
          <Route path="/client/*" element={<ClientRoutes />} />
        </Routes>
      </MemoryRouter>
    );
    expect(await screen.findByText('Bon retour parmi nous')).toBeDefined();
  });

  it('renders ClientHomePage when navigating to /client', async () => {
    render(
      <MemoryRouter initialEntries={['/client']}>
        <Routes>
          <Route path="/client/*" element={<ClientRoutes />} />
        </Routes>
      </MemoryRouter>
    );
    expect(await screen.findByText('Suivez votre livraison.')).toBeDefined();
  });

  it('renders ClientRegisterPage when navigating to /client/register', async () => {
    render(
      <MemoryRouter initialEntries={['/client/register']}>
        <Routes>
          <Route path="/client/*" element={<ClientRoutes />} />
        </Routes>
      </MemoryRouter>
    );
    expect(await screen.findByText('Activez votre suivi')).toBeDefined();
  });
});
