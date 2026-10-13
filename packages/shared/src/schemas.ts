import { z } from 'zod';
import { ROLES } from './roles.js';
import {
  CANDIDATE_STATUSES,
  CATALOG_STATUSES,
  CATALOG_TYPES,
  DRIVER_AVAILABILITIES,
  JOB_STATUSES,
  ORDER_STATUSES,
  USER_STATUSES,
  VEHICLE_TYPES,
} from './statuses.js';

/** Schémas Zod partagés frontend/backend — la source de vérité de la validation. */

export const emailSchema = z.string().trim().toLowerCase().email('Adresse e-mail invalide').max(254);

export const passwordSchema = z
  .string()
  .min(8, 'Le mot de passe doit contenir au moins 8 caractères')
  .max(128);

export const trackingNumberSchema = z
  .string()
  .trim()
  .min(6)
  .max(64)
  .regex(/^[A-Za-z0-9-]+$/, 'Numéro de suivi invalide');

export const idSchema = z.string().trim().min(1).max(191);

export const paginationSchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
  search: z.string().trim().max(200).optional(),
  sort: z.string().trim().max(64).optional(),
  order: z.enum(['asc', 'desc']).default('desc'),
});

export type PaginationInput = z.infer<typeof paginationSchema>;

/* ------------------------------ Auth ------------------------------ */

export const loginSchema = z.object({
  email: emailSchema,
  password: z.string().min(1, 'Mot de passe requis').max(128),
});

export type LoginInput = z.infer<typeof loginSchema>;

export const changePasswordSchema = z.object({
  currentPassword: z.string().min(1),
  newPassword: passwordSchema,
});

/* ------------------------------ Entreprise ------------------------------ */

export const createCompanySchema = z.object({
  name: z.string().trim().min(2).max(120),
  slug: z
    .string()
    .trim()
    .toLowerCase()
    .min(2)
    .max(60)
    .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, 'Slug invalide (lettres, chiffres, tirets)'),
  email: emailSchema.optional().or(z.literal('')).transform((v) => v || undefined),
  phone: z.string().trim().max(40).optional(),
  address: z.string().trim().max(240).optional(),
  logo: z.string().trim().max(500).optional(),
});

export type CreateCompanyInput = z.infer<typeof createCompanySchema>;

export const createCompanyUserSchema = z.object({
  companyId: idSchema,
  name: z.string().trim().min(2).max(120),
  email: emailSchema,
  password: passwordSchema,
  role: z.enum(['COMPANY_ADMIN', 'DISPATCHER', 'DRIVER', 'RECRUITER']),
  status: z.enum(USER_STATUSES).default('ACTIVE'),
});

export type CreateCompanyUserInput = z.infer<typeof createCompanyUserSchema>;

export const updateCompanySchema = createCompanySchema.partial().omit({ slug: true });

/* ------------------------------ Utilisateurs ------------------------------ */

export const createUserSchema = z.object({
  name: z.string().trim().min(2).max(120),
  email: emailSchema,
  password: passwordSchema,
  role: z.enum(ROLES),
  status: z.enum(USER_STATUSES).default('ACTIVE'),
});

export type CreateUserInput = z.infer<typeof createUserSchema>;

export const updateUserSchema = z.object({
  name: z.string().trim().min(2).max(120).optional(),
  role: z.enum(ROLES).optional(),
  status: z.enum(USER_STATUSES).optional(),
});

/* ------------------------------ Livreurs ------------------------------ */

export const createDriverSchema = z.object({
  name: z.string().trim().min(2).max(120),
  email: emailSchema,
  password: passwordSchema.optional(),
  phone: z.string().trim().max(40).optional(),
  vehicleType: z.enum(VEHICLE_TYPES).default('MOTORCYCLE'),
  licenseNumber: z.string().trim().max(60).optional(),
  availability: z.enum(DRIVER_AVAILABILITIES).default('OFFLINE'),
});

export type CreateDriverInput = z.infer<typeof createDriverSchema>;

export const updateDriverAvailabilitySchema = z.object({
  availability: z.enum(DRIVER_AVAILABILITIES),
});

export const driverLocationSchema = z.object({
  latitude: z.number().min(-90).max(90),
  longitude: z.number().min(-180).max(180),
  accuracy: z.number().min(0).max(100000).optional(),
  speed: z.number().min(0).optional(),
  heading: z.number().min(0).max(360).optional(),
  timestamp: z.number().int().positive().optional(),
});

export type DriverLocationInput = z.infer<typeof driverLocationSchema>;

/* ------------------------------ Clients ------------------------------ */

export const createCustomerSchema = z.object({
  name: z.string().trim().min(2).max(120),
  phone: z.string().trim().max(40).optional(),
  email: emailSchema.optional().or(z.literal('')).transform((v) => v || undefined),
  address: z.string().trim().max(240).optional(),
});

export type CreateCustomerInput = z.infer<typeof createCustomerSchema>;

export const updateCustomerSchema = createCustomerSchema.partial();

/* ------------------------------ Catalogue (services & produits) ------------------------------ */

export const createCatalogItemSchema = z.object({
  name: z.string().trim().min(2).max(120),
  description: z.string().trim().max(2000).optional(),
  type: z.enum(CATALOG_TYPES).default('SERVICE'),
  price: z.number().min(0).max(1_000_000).nullable().optional(),
  status: z.enum(CATALOG_STATUSES).default('ACTIVE'),
});

export type CreateCatalogItemInput = z.infer<typeof createCatalogItemSchema>;

export const updateCatalogItemSchema = createCatalogItemSchema.partial();

export const listCatalogQuerySchema = paginationSchema.extend({
  type: z.enum(CATALOG_TYPES).optional(),
  status: z.enum(CATALOG_STATUSES).optional(),
});

/* ------------------------------ Commandes ------------------------------ */

export const createOrderSchema = z.object({
  customerId: idSchema.optional(),
  customer: createCustomerSchema.optional(),
  pickupAddress: z.string().trim().min(3).max(240),
  deliveryAddress: z.string().trim().min(3).max(240),
  driverId: idSchema.nullish(),
  estimatedDeliveryAt: z.coerce.date().nullable().optional(),
  note: z.string().trim().max(1000).optional(),
});

export type CreateOrderInput = z.infer<typeof createOrderSchema>;

export const updateOrderSchema = z.object({
  pickupAddress: z.string().trim().min(3).max(240).optional(),
  deliveryAddress: z.string().trim().min(3).max(240).optional(),
  estimatedDeliveryAt: z.coerce.date().nullable().optional(),
  note: z.string().trim().max(1000).optional(),
});

export const assignOrderSchema = z.object({
  driverId: idSchema.nullish(),
});

export const updateOrderStatusSchema = z.object({
  status: z.enum(ORDER_STATUSES),
  note: z.string().trim().max(500).optional(),
  latitude: z.number().min(-90).max(90).optional(),
  longitude: z.number().min(-180).max(180).optional(),
});

export const listOrdersQuerySchema = paginationSchema.extend({
  status: z.enum(ORDER_STATUSES).optional(),
  driverId: idSchema.optional(),
  customerId: idSchema.optional(),
  dateFrom: z.coerce.date().optional(),
  dateTo: z.coerce.date().optional(),
});

/* ------------------------------ Recrutement ------------------------------ */

export const createJobOfferSchema = z.object({
  title: z.string().trim().min(2).max(160),
  description: z.string().trim().min(10).max(20000),
  requirements: z.string().trim().max(12000).optional(),
  location: z.string().trim().max(160).optional(),
  isDriverRole: z.boolean().default(false),
  status: z.enum(JOB_STATUSES).default('DRAFT'),
});

export type CreateJobOfferInput = z.infer<typeof createJobOfferSchema>;

export const updateJobOfferSchema = createJobOfferSchema.partial();

export const createCandidateSchema = z.object({
  jobOfferId: idSchema,
  name: z.string().trim().min(2).max(120),
  email: emailSchema,
  phone: z.string().trim().max(40).optional(),
  note: z.string().trim().max(4000).optional(),
});

export type CreateCandidateInput = z.infer<typeof createCandidateSchema>;

export const updateCandidateStatusSchema = z.object({
  status: z.enum(CANDIDATE_STATUSES),
});

/* ------------------------------ Tracking public ------------------------------ */

export const publicTrackingQuerySchema = z.object({
  token: z.string().trim().min(16).max(200),
});

export const chatMessageSchema = z.object({
  content: z.string().trim().min(1).max(4000),
  sessionId: z.string().uuid().optional(),
  trackingNumber: z.string().trim().max(64).optional(),
});

export type ChatMessageInput = z.infer<typeof chatMessageSchema>;

export const updateDriverSchema = z.object({
  phone: z.string().trim().max(40).optional(),
  vehicleType: z.enum(VEHICLE_TYPES).optional(),
  licenseNumber: z.string().trim().max(60).optional(),
  availability: z.enum(DRIVER_AVAILABILITIES).optional(),
});

export type UpdateDriverInput = z.infer<typeof updateDriverSchema>;

/* ------------------------------ Listes (portails) ------------------------------ */

export const listJobsQuerySchema = paginationSchema.extend({
  status: z.enum(JOB_STATUSES).optional(),
});

export const listCandidatesQuerySchema = paginationSchema.extend({
  status: z.enum(CANDIDATE_STATUSES).optional(),
  jobOfferId: idSchema.optional(),
});

export const updateCandidateSchema = z.object({
  status: z.enum(CANDIDATE_STATUSES).optional(),
  note: z.string().trim().max(4000).optional(),
});

export type UpdateCandidateInput = z.infer<typeof updateCandidateSchema>;

/* ------------------------------ Portail client ------------------------------ */

export const portalRegisterSchema = z.object({
  trackingNumber: trackingNumberSchema,
  email: emailSchema,
  password: passwordSchema,
});

export type PortalRegisterInput = z.infer<typeof portalRegisterSchema>;

export const portalLoginSchema = z.object({
  email: emailSchema,
  password: z.string().min(1, 'Mot de passe requis').max(128),
});

export const portalUpdateProfileSchema = z.object({
  name: z.string().trim().min(2).max(120).optional(),
  phone: z.string().trim().max(40).optional(),
  address: z.string().trim().max(240).optional(),
});

export const portalCreateOrderSchema = z.object({
  pickupAddress: z.string().trim().min(3).max(240),
  deliveryAddress: z.string().trim().min(3).max(240),
  senderName: z.string().trim().max(120).optional(),
  senderPhone: z.string().trim().max(40).optional(),
  recipientName: z.string().trim().max(120).optional(),
  recipientPhone: z.string().trim().max(40).optional(),
  recipientCity: z.string().trim().max(120).optional(),
  deliveryInstructions: z.string().trim().max(1000).optional(),
  description: z.string().trim().max(1000).optional(),
  quantity: z.coerce.number().int().min(1).max(100).optional(),
  codAmount: z.coerce.number().min(0).max(1_000_000).optional(),
  serviceId: idSchema.optional(),
  estimatedDeliveryAt: z.coerce.date().nullable().optional(),
  note: z.string().trim().max(1000).optional(),
});

export type PortalCreateOrderInput = z.infer<typeof portalCreateOrderSchema>;


export const portalChatSchema = z.object({
  message: z.string().trim().min(1).max(500),
});

export type PortalChatInput = z.infer<typeof portalChatSchema>;

export const portalSupportSchema = z.object({
  reason: z.string().trim().min(2).max(120),
  message: z.string().trim().min(1).max(4000),
  trackingNumber: trackingNumberSchema.optional(),
});

export type PortalSupportInput = z.infer<typeof portalSupportSchema>;

export const portalMessageSchema = z.object({
  content: z.string().trim().min(1).max(4000),
});

export type PortalMessageInput = z.infer<typeof portalMessageSchema>;

export const portalPasswordSchema = z.object({
  currentPassword: z.string().min(1, 'Mot de passe actuel requis').max(128),
  password: passwordSchema,
});

export type PortalPasswordInput = z.infer<typeof portalPasswordSchema>;
