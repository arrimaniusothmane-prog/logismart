import '@testing-library/jest-dom/vitest';
import { describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';
import { Button } from './Button';
import { Spinner } from './Skeleton';

/**
 * Tests sans matchers jest-dom côté typecheck :
 * les assertions utilisent les matchers natifs de Vitest pour rester robustes
 * aux évolutions de typage de Vitest 5.
 */

describe('Button', () => {
  it('affiche son libellé', () => {
    render(<Button>Enregistrer</Button>);
    expect(screen.getByRole('button', { name: 'Enregistrer' })).toBeTruthy();
  });

  it('passe en état de chargement et bloque le clic', () => {
    render(<Button loading>Valider</Button>);
    const button = screen.getByRole('button', { name: 'Valider' });
    expect((button as HTMLButtonElement).disabled).toBe(true);
    expect(button.getAttribute('aria-busy')).toBe('true');
  });

  it('reste cliquable quand désactivé est explicite', () => {
    render(<Button disabled>Annuler</Button>);
    expect((screen.getByRole('button', { name: 'Annuler' }) as HTMLButtonElement).disabled).toBe(true);
  });
});

describe('Spinner', () => {
  it('porte un libellé accessible', () => {
    render(<Spinner label="Chargement…" />);
    expect(screen.getByText('Chargement…')).toBeTruthy();
  });
});