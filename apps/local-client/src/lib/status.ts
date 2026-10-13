import {
  ORDER_STATUS_LABELS,
  type OrderStatus,
} from '@logismart/shared';

export function orderStatusLabel(status: string) {
  return (ORDER_STATUS_LABELS as Record<string, string>)[status] ?? status;
}

const ORDER_TONES: Record<OrderStatus, string> = {
  PREPARED: 'neutral',
  ASSIGNED: 'info',
  PICKED_UP: 'brand',
  IN_TRANSIT: 'warning',
  DELIVERED: 'success',
  FAILED: 'danger',
  CANCELLED: 'outline',
} as const;

export function orderStatusTone(status: string): 'neutral' | 'brand' | 'info' | 'success' | 'warning' | 'danger' | 'outline' {
  const tone = (ORDER_TONES as Record<string, string>)[status] ?? 'neutral';
  return tone as 'neutral' | 'brand' | 'info' | 'success' | 'warning' | 'danger' | 'outline';
}

const ROLE_LABELS: Record<string, string> = {
  SUPER_ADMIN: 'Super admin',
  COMPANY_ADMIN: 'Admin entreprise',
  DISPATCHER: 'Dispatcheur',
  DRIVER: 'Livreur',
  RECRUITER: 'Recruteur',
};

export function roleLabel(role: string) {
  return ROLE_LABELS[role] ?? role;
}

const AVAILABILITY_LABELS: Record<string, string> = {
  ONLINE: 'En ligne',
  OFFLINE: 'Hors ligne',
  BUSY: 'Occupé',
  ON_LEAVE: 'Congé',
};

export function availabilityLabel(availability: string) {
  return AVAILABILITY_LABELS[availability] ?? availability;
}

export function availabilityTone(availability: string): 'success' | 'neutral' | 'warning' | 'outline' {
  const tones: Record<string, string> = {
    ONLINE: 'success',
    OFFLINE: 'neutral',
    BUSY: 'warning',
    ON_LEAVE: 'outline',
  };
  return (tones[availability] ?? 'neutral') as 'success' | 'neutral' | 'warning' | 'outline';
}

const VEHICLE_LABELS: Record<string, string> = {
  BIKE: 'Vélo',
  MOTORCYCLE: 'Moto',
  CAR: 'Voiture',
  VAN: 'Fourgon',
  TRUCK: 'Camion',
};

export function vehicleLabel(vehicle: string) {
  return VEHICLE_LABELS[vehicle] ?? vehicle;
}
