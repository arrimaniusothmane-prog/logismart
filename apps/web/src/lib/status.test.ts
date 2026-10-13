import { describe, expect, it } from 'vitest';
import {
  availabilityMeta,
  candidateStatusMeta,
  escalationStatusMeta,
  jobStatusMeta,
  knowledgeStatusMeta,
  orderStatusMeta,
  roleLabel,
  userStatusMeta,
} from './status';

describe('status library', () => {
  it('mappe les statuts de commande vers libellé français et couleur', () => {
    expect(orderStatusMeta('DELIVERED')).toEqual({ label: 'Livrée', tone: 'success' });
    expect(orderStatusMeta('IN_TRANSIT')).toEqual({ label: 'En transit', tone: 'warning' });
    expect(orderStatusMeta('FAILED')).toEqual({ label: 'Échec', tone: 'danger' });
  });

  it('reste cohérent pour un statut inconnu sans planter', () => {
    expect(orderStatusMeta('BOGUS')).toEqual({ label: 'BOGUS', tone: 'neutral' });
  });

  it('mappe candidats, disponibilités, offres, documents et escalades', () => {
    expect(candidateStatusMeta('SHORTLISTED').label).toBe('Présélectionné');
    expect(availabilityMeta('BUSY')).toEqual({ label: 'Occupé', tone: 'warning' });
    expect(jobStatusMeta('PUBLISHED')).toEqual({ label: 'Publiée', tone: 'success' });
    expect(knowledgeStatusMeta('PROCESSING')).toEqual({ label: 'Traitement', tone: 'warning' });
    expect(escalationStatusMeta('RESOLVED').label).toBe('Résolue');
  });

  it('traduit les rôles', () => {
    expect(roleLabel('COMPANY_ADMIN')).toBe('Admin entreprise');
    expect(roleLabel('SUPER_ADMIN')).toBe('Super admin');
  });

  it('propage les libellés sans correspondance', () => {
    expect(userStatusMeta('PENDING')).toEqual({ label: 'PENDING', tone: 'neutral' });
  });
});