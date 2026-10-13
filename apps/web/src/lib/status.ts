import type { BadgeTone } from '../components/ui/Badge';
import {
  CANDIDATE_STATUS_LABELS,
  CATALOG_STATUS_LABELS,
  CATALOG_TYPE_LABELS,
  DRIVER_AVAILABILITY_LABELS,
  ORDER_STATUS_LABELS,
  type CandidateStatus,
  type DriverAvailability,
  type OrderStatus,
} from '@logismart/shared';

/** Table de correspondance statut métier → libellé FR + couleur. */

const ORDER_TONES: Record<OrderStatus, BadgeTone> = {
  PREPARED: 'neutral',
  ASSIGNED: 'info',
  PICKED_UP: 'brand',
  IN_TRANSIT: 'warning',
  DELIVERED: 'success',
  FAILED: 'danger',
  CANCELLED: 'outline',
};

const CANDIDATE_TONES: Record<CandidateStatus, BadgeTone> = {
  RECEIVED: 'neutral',
  SCREENING: 'info',
  SHORTLISTED: 'brand',
  INTERVIEW: 'warning',
  HIRED: 'success',
  REJECTED: 'danger',
};

const USER_STATUS_LABELS: Record<string, string> = {
  ACTIVE: 'Actif',
  INVITED: 'Invité',
  SUSPENDED: 'Suspendu',
};

const USER_STATUS_TONES: Record<string, BadgeTone> = {
  ACTIVE: 'success',
  INVITED: 'info',
  SUSPENDED: 'danger',
};

const AVAILABILITY_TONES: Record<DriverAvailability, BadgeTone> = {
  ONLINE: 'success',
  OFFLINE: 'neutral',
  BUSY: 'warning',
  ON_LEAVE: 'outline',
};

const VEHICLE_LABELS: Record<string, string> = {
  BIKE: 'Vélo',
  MOTORCYCLE: 'Moto',
  CAR: 'Voiture',
  VAN: 'Fourgon',
  TRUCK: 'Camion',
};

const JOB_LABELS: Record<string, string> = { DRAFT: 'Brouillon', PUBLISHED: 'Publiée', CLOSED: 'Clôturée' };
const JOB_TONES: Record<string, BadgeTone> = { DRAFT: 'neutral', PUBLISHED: 'success', CLOSED: 'outline' };

const KNOWLEDGE_LABELS: Record<string, string> = {
  PENDING: 'En attente',
  PROCESSING: 'Traitement',
  READY: 'Prêt',
  FAILED: 'Échec',
};
const KNOWLEDGE_TONES: Record<string, BadgeTone> = {
  PENDING: 'neutral',
  PROCESSING: 'warning',
  READY: 'success',
  FAILED: 'danger',
};

const ESCALATION_LABELS: Record<string, string> = { OPEN: 'Ouverte', IN_PROGRESS: 'En cours', RESOLVED: 'Résolue' };
const ESCALATION_TONES: Record<string, BadgeTone> = { OPEN: 'warning', IN_PROGRESS: 'info', RESOLVED: 'success' };

const ROLE_LABELS: Record<string, string> = {
  SUPER_ADMIN: 'Super admin',
  COMPANY_ADMIN: 'Admin entreprise',
  DISPATCHER: 'Dispatcheur',
  DRIVER: 'Livreur',
  RECRUITER: 'Recruteur',
};

function lookup(
  value: string,
  labels: Record<string, string>,
  tones: Record<string, BadgeTone>,
  fallbackTone: BadgeTone = 'neutral',
): { label: string; tone: BadgeTone } {
  return { label: labels[value] ?? value, tone: tones[value] ?? fallbackTone };
}

export function orderStatusMeta(status: string) {
  return lookup(status, ORDER_STATUS_LABELS as Record<string, string>, ORDER_TONES);
}

export function candidateStatusMeta(status: string) {
  return lookup(status, CANDIDATE_STATUS_LABELS as Record<string, string>, CANDIDATE_TONES);
}

export function userStatusMeta(status: string) {
  return lookup(status, USER_STATUS_LABELS, USER_STATUS_TONES);
}

export function availabilityMeta(availability: string) {
  return lookup(availability, DRIVER_AVAILABILITY_LABELS as Record<string, string>, AVAILABILITY_TONES);
}

export function jobStatusMeta(status: string) {
  return lookup(status, JOB_LABELS, JOB_TONES);
}

export function knowledgeStatusMeta(status: string) {
  return lookup(status, KNOWLEDGE_LABELS, KNOWLEDGE_TONES);
}

export function escalationStatusMeta(status: string) {
  return lookup(status, ESCALATION_LABELS, ESCALATION_TONES);
}

const CATALOG_TYPE_TONES: Record<string, BadgeTone> = { SERVICE: 'info', PRODUCT: 'brand' };

const CATALOG_STATUS_TONES: Record<string, BadgeTone> = { ACTIVE: 'success', INACTIVE: 'outline' };

export function catalogTypeMeta(type: string) {
  return lookup(type, CATALOG_TYPE_LABELS as Record<string, string>, CATALOG_TYPE_TONES);
}

export function catalogStatusMeta(status: string) {
  return lookup(status, CATALOG_STATUS_LABELS as Record<string, string>, CATALOG_STATUS_TONES);
}

export function roleLabel(role: string) {
  return ROLE_LABELS[role] ?? role;
}

export function vehicleLabel(vehicle: string) {
  return VEHICLE_LABELS[vehicle] ?? vehicle;
}

export function orderStatusLabel(status: string) {
  return (ORDER_STATUS_LABELS as Record<string, string>)[status] ?? status;
}
