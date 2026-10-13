/** Statuts d'une commande / livraison. */
export const ORDER_STATUSES = [
  'PREPARED',
  'ASSIGNED',
  'PICKED_UP',
  'IN_TRANSIT',
  'DELIVERED',
  'FAILED',
  'CANCELLED',
] as const;

export type OrderStatus = (typeof ORDER_STATUSES)[number];

export const ORDER_STATUS_LABELS: Record<OrderStatus, string> = {
  PREPARED: 'Préparée',
  ASSIGNED: 'Affectée',
  PICKED_UP: 'Récupérée',
  IN_TRANSIT: 'En transit',
  DELIVERED: 'Livrée',
  FAILED: 'Échec',
  CANCELLED: 'Annulée',
};

/** Transitions autorisées depuis un statut donné. Toute autre transition est rejetée. */
export const ORDER_STATUS_TRANSITIONS: Record<OrderStatus, readonly OrderStatus[]> = {
  PREPARED: ['ASSIGNED', 'CANCELLED'],
  ASSIGNED: ['PICKED_UP', 'PREPARED', 'CANCELLED', 'FAILED'],
  PICKED_UP: ['IN_TRANSIT', 'FAILED'],
  IN_TRANSIT: ['DELIVERED', 'FAILED'],
  DELIVERED: [],
  FAILED: [],
  CANCELLED: [],
};

/** Statuts considérés comme « terminaux ». */
export const TERMINAL_ORDER_STATUSES: readonly OrderStatus[] = ['DELIVERED', 'FAILED', 'CANCELLED'];

/** Statuts pendant lesquels la position du livreur est pertinente sur la carte. */
export const ACTIVE_ORDER_STATUSES: readonly OrderStatus[] = ['ASSIGNED', 'PICKED_UP', 'IN_TRANSIT'];

export function canTransitionOrderStatus(from: OrderStatus, to: OrderStatus): boolean {
  return ORDER_STATUS_TRANSITIONS[from].includes(to);
}

export function isTerminalOrderStatus(status: OrderStatus): boolean {
  return TERMINAL_ORDER_STATUSES.includes(status);
}

/** Statuts d'un candidat dans le pipeline RH. */
export const CANDIDATE_STATUSES = [
  'RECEIVED',
  'SCREENING',
  'SHORTLISTED',
  'INTERVIEW',
  'HIRED',
  'REJECTED',
] as const;

export type CandidateStatus = (typeof CANDIDATE_STATUSES)[number];

export const CANDIDATE_STATUS_LABELS: Record<CandidateStatus, string> = {
  RECEIVED: 'Reçu',
  SCREENING: 'Présélection',
  SHORTLISTED: 'Présélectionné',
  INTERVIEW: 'Entretien',
  HIRED: 'Embauché',
  REJECTED: 'Écarté',
};

export const CANDIDATE_STATUS_TRANSITIONS: Record<CandidateStatus, readonly CandidateStatus[]> = {
  RECEIVED: ['SCREENING', 'REJECTED'],
  SCREENING: ['SHORTLISTED', 'REJECTED'],
  SHORTLISTED: ['INTERVIEW', 'REJECTED'],
  INTERVIEW: ['HIRED', 'REJECTED'],
  HIRED: [],
  REJECTED: [],
};

export function canTransitionCandidateStatus(from: CandidateStatus, to: CandidateStatus): boolean {
  return CANDIDATE_STATUS_TRANSITIONS[from].includes(to);
}

/** État du compte utilisateur. */
export const USER_STATUSES = ['ACTIVE', 'INVITED', 'SUSPENDED'] as const;
export type UserStatus = (typeof USER_STATUSES)[number];

/** Disponibilité d'un livreur. */
export const DRIVER_AVAILABILITIES = ['ONLINE', 'OFFLINE', 'BUSY', 'ON_LEAVE'] as const;
export type DriverAvailability = (typeof DRIVER_AVAILABILITIES)[number];

export const DRIVER_AVAILABILITY_LABELS: Record<DriverAvailability, string> = {
  ONLINE: 'En ligne',
  OFFLINE: 'Hors ligne',
  BUSY: 'Occupé',
  ON_LEAVE: 'Congé',
};

/** Véhicules possibles pour un livreur. */
export const VEHICLE_TYPES = ['BIKE', 'MOTORCYCLE', 'CAR', 'VAN', 'TRUCK'] as const;
export type VehicleType = (typeof VEHICLE_TYPES)[number];

/** Statut d'une offre d'emploi. */
export const JOB_STATUSES = ['DRAFT', 'PUBLISHED', 'CLOSED'] as const;
export type JobStatus = (typeof JOB_STATUSES)[number];

/** Type de preuve de livraison. */
export const PROOF_TYPES = ['PHOTO', 'SIGNATURE'] as const;
export type ProofType = (typeof PROOF_TYPES)[number];

/** Traitement d'un document de connaissance (RAG). */
export const KNOWLEDGE_STATUSES = ['PENDING', 'PROCESSING', 'READY', 'FAILED'] as const;
export type KnowledgeStatus = (typeof KNOWLEDGE_STATUSES)[number];

/** Escalade support. */
export const ESCALATION_STATUSES = ['OPEN', 'IN_PROGRESS', 'RESOLVED'] as const;
export type EscalationStatus = (typeof ESCALATION_STATUSES)[number];

/** Rôles de message de chat. */
export const CHAT_ROLES = ['user', 'assistant', 'system'] as const;
export type ChatRole = (typeof CHAT_ROLES)[number];

/** Éléments du catalogue (services et produits proposés par l'entreprise). */
export const CATALOG_TYPES = ['SERVICE', 'PRODUCT'] as const;
export type CatalogType = (typeof CATALOG_TYPES)[number];

export const CATALOG_TYPE_LABELS: Record<CatalogType, string> = {
  SERVICE: 'Service',
  PRODUCT: 'Produit',
};

export const CATALOG_STATUSES = ['ACTIVE', 'INACTIVE'] as const;
export type CatalogStatus = (typeof CATALOG_STATUSES)[number];

export const CATALOG_STATUS_LABELS: Record<CatalogStatus, string> = {
  ACTIVE: 'En ligne',
  INACTIVE: 'Masqué',
};

