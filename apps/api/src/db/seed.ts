/**
 * ============================================================
 *  DONNÉES DE DÉMONSTRATION — NE JAMAIS UTILISER EN PRODUCTION
 * ============================================================
 *  Toutes les données créées ici sont fictives et servent à
 *  explorer l'application localement.
 *
 *  Comptes (mot de passe unique pour tous : `Demo!Pass123`) :
 *    super@demo.test      SUPER_ADMIN   (contexte plateforme)
 *    admin@demo.test      COMPANY_ADMIN (LogiSmart Demo)
 *    dispatch@demo.test   DISPATCHER
 *    recruteur@demo.test  RECRUITER
 *    livreur1@demo.test   DRIVER
 *    livreur2@demo.test   DRIVER
 *    admin@acme.test      COMPANY_ADMIN (Acme Livraison — isolation tenant)
 * ============================================================
 */
import { PrismaClient, type OrderStatus, type CandidateStatus } from '@prisma/client';
import { generateTrackingNumber, generateSecureToken } from '../lib/ids.js';
import { hashPassword } from '../modules/auth/auth.service.js';

const prisma = new PrismaClient();

const DEMO_PASSWORD = 'Demo!Pass123';
const DEMO_SLUG_A = 'logismart-demo';
const DEMO_SLUG_B = 'acme-livraison';

/**
 * Jeton de suivi public fixe (≥ 16 caractères, requis par le validateur de l'API).
 * Rattaché à la commande `LS-CMLL-DEMO-01` pour offrir un lien stable.
 * Doit rester synchronisé avec `DEMO_TRACKING_TOKEN` dans la page de connexion web.
 */
const DEMO_TRACKING_TOKEN = 'demo-suivi-ls-cmll-01';

const daysFromNow = (days: number, hours = 0) =>
  new Date(Date.now() + days * 86_400_000 + hours * 3_600_000);
const daysAgo = (days: number) => new Date(Date.now() - days * 86_400_000);

interface Seeded {
  companyId: string;
  drivers: string[];
}

async function seedCompany(options: {
  name: string;
  slug: string;
  email: string;
  adminEmail: string;
  withDemoContent: boolean;
}): Promise<Seeded> {
  // Idempotent : on repart d'une base propre pour ce tenant.
  const existing = await prisma.company.findUnique({ where: { slug: options.slug } });
  if (existing) await prisma.company.delete({ where: { id: existing.id } });

  const passwordHash = await hashPassword(DEMO_PASSWORD);

  const company = await prisma.company.create({
    data: {
      name: options.name,
      slug: options.slug,
      email: options.email,
      phone: '+33 1 00 00 00 00',
      address: '12 rue de la Livraison, 75001 Paris',
    },
  });

  const admin = await prisma.user.create({
    data: {
      companyId: company.id,
      name: 'Admin Demo',
      email: options.adminEmail,
      passwordHash,
      role: 'COMPANY_ADMIN',
      status: 'ACTIVE',
    },
  });
  await admin;

  if (!options.withDemoContent) return { companyId: company.id, drivers: [] };

  const dispatcher = await prisma.user.create({
    data: { companyId: company.id, name: 'Dispatch Demo', email: 'dispatch@demo.test', passwordHash, role: 'DISPATCHER', status: 'ACTIVE' },
  });
  const recruiter = await prisma.user.create({
    data: { companyId: company.id, name: 'Recruteur Demo', email: 'recruteur@demo.test', passwordHash, role: 'RECRUITER', status: 'ACTIVE' },
  });

  const driverUsers = await Promise.all(
    [
      { name: 'Livreur Un', email: 'livreur1@demo.test', lat: 48.8566, lng: 2.3522, vehicle: 'MOTORCYCLE' as const, availability: 'ONLINE' as const },
      { name: 'Livreur Deux', email: 'livreur2@demo.test', lat: 48.8666, lng: 2.3333, vehicle: 'VAN' as const, availability: 'BUSY' as const },
    ].map(async (d, index) => {
      const user = await prisma.user.create({
        data: { companyId: company.id, name: d.name, email: d.email, passwordHash, role: 'DRIVER', status: 'ACTIVE' },
      });
      const profile = await prisma.driverProfile.create({
        data: {
          userId: user.id,
          companyId: company.id,
          phone: `+33 6 00 00 00 ${index + 1}`,
          vehicleType: d.vehicle,
          licenseNumber: `PERM-${1000 + index}`,
          availability: d.availability,
          currentLatitude: d.lat,
          currentLongitude: d.lng,
          lastLocationAt: new Date(),
        },
      });
      return profile.id;
    }),
  );

  const customers = await Promise.all(
    [
      { name: 'Camille Martin', phone: '+33 6 11 22 33 44', email: 'camille@example.test', address: '10 av. des Champs, 75008 Paris' },
      { name: 'Julien Bernard', phone: '+33 6 22 33 44 55', email: 'julien@example.test', address: '5 bd Saint-Michel, 75005 Paris' },
      { name: 'Sofia Petit', phone: '+33 6 33 44 55 66', email: 'sofia@example.test', address: '22 rue de Rivoli, 75004 Paris' },
      { name: 'Marc Leroy', phone: '+33 6 44 55 66 77', email: 'marc@example.test', address: '3 place de la République, 75011 Paris' },
    ].map((c) => ({
      // Seule Camille est "activée" : les autres passent par la revendication
      // du portail client (register avec numéro de suivi + e-mail).
      ...c,
      passwordHash: c.email === 'camille@example.test' ? passwordHash : null,
    })),
  ).then((rows) =>
    Promise.all(
      rows.map((data) =>
        prisma.customer.create({ data: { ...data, companyId: company.id } }),
      ),
    ),
  );

  const catalogPlan: Array<{
    name: string;
    description: string;
    type: 'SERVICE' | 'PRODUCT';
    price: number | null;
    status: 'ACTIVE' | 'INACTIVE';
  }> = [
    {
      name: 'Livraison express J+1',
      description: 'Prise en charge le jour même, livraison sous 24 h en Île-de-France.',
      type: 'SERVICE',
      price: 12.9,
      status: 'ACTIVE',
    },
    {
      name: 'Livraison standard 48 h',
      description: 'Livraison en 48 h ouvrées, suivi inclus à chaque étape.',
      type: 'SERVICE',
      price: 6.5,
      status: 'ACTIVE',
    },
    {
      name: 'Course urgente intra-ville',
      description: 'Un livreur dédié, course départ-à-arrivée dans la même ville.',
      type: 'SERVICE',
      price: 19.9,
      status: 'ACTIVE',
    },
    {
      name: 'Abonnement logistique mensuel',
      description: 'Volume garanti, tarifs dégressifs et interlocuteur dédié.',
      type: 'SERVICE',
      price: 149,
      status: 'ACTIVE',
    },
    {
      name: 'Emballage renforcé — colis fragile',
      description: 'Protection double paroi et calage intégré pour objets sensibles.',
      type: 'PRODUCT',
      price: 4.5,
      status: 'ACTIVE',
    },
    {
      name: 'Assurance colis jusqu\'à 500 €',
      description: 'Indemnisation en cas de perte ou de dommage (offre en test).',
      type: 'PRODUCT',
      price: 8.9,
      status: 'INACTIVE',
    },
  ];

  await prisma.catalogItem.createMany({
    data: catalogPlan.map((item) => ({ ...item, companyId: company.id })),
  });

  const orderPlan: Array<{
    status: OrderStatus;
    driverIndex: number | null;
    ageDays: number;
    estimatedIn?: number;
    customerIndex?: number;
    createdHoursAgo?: number;
    deliveredHoursAgo?: number;
    /** Numéro fixe pour la démo du portail client. */
    trackingNumber?: string;
  }> = [
    { status: 'PREPARED', driverIndex: null, ageDays: 0, customerIndex: 0 },
    { status: 'ASSIGNED', driverIndex: 0, ageDays: 0, estimatedIn: 3, customerIndex: 1, trackingNumber: 'LS-JULI-DEMO-01' },
    { status: 'PICKED_UP', driverIndex: 1, ageDays: 0, estimatedIn: 5, customerIndex: 2 },
    { status: 'IN_TRANSIT', driverIndex: 0, ageDays: 0, estimatedIn: 1, customerIndex: 3 },
    { status: 'DELIVERED', driverIndex: 1, ageDays: 0, createdHoursAgo: 4, deliveredHoursAgo: 2, customerIndex: 0 },
    { status: 'FAILED', driverIndex: 0, ageDays: 3, customerIndex: 1 },
    // Profil client démonstration : plusieurs livraisons pour Camille (portail client).
    { status: 'IN_TRANSIT', driverIndex: 1, ageDays: 0, estimatedIn: 2, customerIndex: 0, trackingNumber: 'LS-CMLL-DEMO-01' },
    { status: 'DELIVERED', driverIndex: 0, ageDays: 1, createdHoursAgo: 28, deliveredHoursAgo: 26, customerIndex: 0 },
  ];

  const statusPath: Record<OrderStatus, OrderStatus[]> = {
    PREPARED: ['PREPARED'],
    ASSIGNED: ['PREPARED', 'ASSIGNED'],
    PICKED_UP: ['PREPARED', 'ASSIGNED', 'PICKED_UP'],
    IN_TRANSIT: ['PREPARED', 'ASSIGNED', 'PICKED_UP', 'IN_TRANSIT'],
    DELIVERED: ['PREPARED', 'ASSIGNED', 'PICKED_UP', 'IN_TRANSIT', 'DELIVERED'],
    FAILED: ['PREPARED', 'ASSIGNED', 'FAILED'],
    CANCELLED: ['PREPARED', 'CANCELLED'],
  };

  for (const [index, plan] of orderPlan.entries()) {
    const customer = customers[(plan.customerIndex ?? index) % customers.length]!;
    const driverId = plan.driverIndex === null ? null : (driverUsers[plan.driverIndex] ?? null);
    const createdAt = plan.createdHoursAgo != null ? new Date(Date.now() - plan.createdHoursAgo * 3_600_000) : daysAgo(plan.ageDays);
    const deliveredAt =
      plan.status === 'DELIVERED'
        ? plan.deliveredHoursAgo != null
          ? new Date(Date.now() - plan.deliveredHoursAgo * 3_600_000)
          : daysAgo(plan.ageDays - 1)
        : null;
    const estimatedDeliveryAt = plan.estimatedIn
      ? daysFromNow(0, plan.estimatedIn)
      : deliveredAt
        ? new Date(deliveredAt.getTime() - 30 * 60_000)
        : daysAgo(plan.ageDays - 1);
    const trackingNumber = plan.trackingNumber ?? generateTrackingNumber();

    const order = await prisma.order.create({
      data: {
        companyId: company.id,
        trackingNumber,
        customerId: customer.id,
        driverId,
        pickupAddress: 'Entrepôt LogiSmart, 8 rue du Dépôt, 75012 Paris',
        deliveryAddress: customer.address ?? 'Adresse de démonstration',
        status: plan.status,
        estimatedDeliveryAt,
        deliveredAt,
        note: 'Commande de démonstration',
        createdAt,
        history: {
          create: statusPath[plan.status].map((status, i) => ({
            status,
            note: i === 0 ? 'Commande créée (démo)' : undefined,
            latitude: i > 0 ? 48.85 + i * 0.004 : undefined,
            longitude: i > 0 ? 2.35 + i * 0.003 : undefined,
            // Borné à « maintenant » : des événements futurs resteraient non lus à vie.
            createdAt: new Date(Math.min(createdAt.getTime() + i * 30 * 60_000, Date.now())),
          })),
        },
      },
    });

    await prisma.trackingToken.create({
      data: {
        orderId: order.id,
        // Lien de suivi public fixe pour la commande de démo (cf. DEMO_TRACKING_TOKEN).
        token: trackingNumber === 'LS-CMLL-DEMO-01' ? DEMO_TRACKING_TOKEN : generateSecureToken(24),
        expiresAt: daysFromNow(30),
      },
    });

    if (plan.status === 'DELIVERED') {
      await prisma.deliveryProof.create({
        data: { orderId: order.id, type: 'SIGNATURE', signatureData: null },
      });
    }
  }

  await Promise.all(
    driverUsers.map((driverId, i) =>
      prisma.driverLocation.createMany({
        data: Array.from({ length: 5 }, (_, k) => ({
          driverId,
          companyId: company.id,
          latitude: 48.85 + i * 0.01 + k * 0.001,
          longitude: 2.35 + i * 0.01 + k * 0.001,
          accuracy: 12,
          timestamp: new Date(Date.now() - k * 5 * 60_000),
        })),
      }),
    ),
  );

  const jobDriver = await prisma.jobOffer.create({
    data: {
      companyId: company.id,
      title: 'Livreur / Livreuse CDI — Île-de-France',
      description:
        "Nous cherchons des livreurs motivés pour effectuer des livraisons urbaines. Véhicule fourni possible, permis B exigé.",
      requirements: 'Permis B, bonne connaissance de Paris, disponibilité week-end',
      location: 'Paris',
      isDriverRole: true,
      status: 'PUBLISHED',
      createdAt: daysAgo(21),
    },
  });

  const jobOps = await prisma.jobOffer.create({
    data: {
      companyId: company.id,
      title: 'Responsable d\'exploitation logistique',
      description: "Pilotage des tournées, suivi des KPIs et coordination de l'équipe de livraison.",
      requirements: 'Expérience 3 ans en logistique, maîtrise des outils de dispatch',
      location: 'Paris (hybride)',
      isDriverRole: false,
      status: 'PUBLISHED',
      createdAt: daysAgo(14),
    },
  });

  const candidatePlan: Array<{ name: string; email: string; job: string; status: CandidateStatus; score: number }> = [
    { name: 'Nadia Moreau', email: 'nadia@example.test', job: jobDriver.id, status: 'HIRED', score: 92 },
    { name: 'Thomas Roux', email: 'thomas@example.test', job: jobDriver.id, status: 'INTERVIEW', score: 78 },
    { name: 'Aïcha Diallo', email: 'aicha@example.test', job: jobOps.id, status: 'SHORTLISTED', score: 85 },
    { name: 'Hugo Fontaine', email: 'hugo@example.test', job: jobOps.id, status: 'RECEIVED', score: 61 },
    { name: 'Léa Girard', email: 'lea@example.test', job: jobDriver.id, status: 'REJECTED', score: 42 },
  ];

  for (const [index, plan] of candidatePlan.entries()) {
    const candidate = await prisma.candidate.create({
      data: {
        companyId: company.id,
        jobOfferId: plan.job,
        name: plan.name,
        email: plan.email,
        phone: `+33 6 55 00 00 ${index}`,
        status: plan.status,
        compatibilityScore: plan.score,
        scoreBreakdown: {
          skills: Math.min(35, Math.round(plan.score * 0.35)),
          experience: Math.min(25, Math.round(plan.score * 0.25)),
          requirements: Math.min(25, Math.round(plan.score * 0.25)),
          certifications: Math.min(15, Math.round(plan.score * 0.15)),
        },
        aiSummary: `Candidat de démonstration — profil ${plan.status.toLowerCase()} avec un score de ${plan.score}/100.`,
        createdAt: daysAgo(20 - index * 2),
        skills: {
          create: [
            { skill: 'Conduite urbaine', level: 'Avancé', score: 88 },
            { skill: 'Gestion des délais', level: 'Intermédiaire', score: 72 },
            { skill: 'Relation client', level: 'Intermédiaire', score: 65 },
          ],
        },
        questions: {
          create: [
            { question: 'Décrivez une situation de livraison sous tension et comment vous l\'avez gérée.', category: 'situationnel' },
            { question: 'Quelles sont vos disponibilités réelles sur les 3 prochains mois ?', category: 'poste' },
          ],
        },
      },
    });

    if (plan.status === 'HIRED' && index === 0) {
      const hiredUser = await prisma.user.create({
        data: {
          companyId: company.id,
          name: candidate.name,
          email: candidate.email,
          passwordHash,
          role: 'DRIVER',
          status: 'ACTIVE',
        },
      });
      const profile = await prisma.driverProfile.create({
        data: {
          userId: hiredUser.id,
          companyId: company.id,
          phone: candidate.phone,
          vehicleType: 'MOTORCYCLE',
          availability: 'OFFLINE',
        },
      });
      await prisma.candidate.update({
        where: { id: candidate.id },
        data: { userId: hiredUser.id, driverProfileId: profile.id },
      });
      driverUsers.push(profile.id);
    }
  }

  void dispatcher;
  void recruiter;

  return { companyId: company.id, drivers: driverUsers };
}

async function seedPlatform(): Promise<void> {
  const existing = await prisma.user.findUnique({ where: { email: 'super@demo.test' } });
  if (existing) return;
  await prisma.user.create({
    data: {
      companyId: null,
      name: 'Super Admin',
      email: 'super@demo.test',
      passwordHash: await hashPassword(DEMO_PASSWORD),
      role: 'SUPER_ADMIN',
      status: 'ACTIVE',
    },
  });
}

async function main(): Promise<void> {
  console.log('▶ Seed LogiSmart — DONNÉES DE DÉMONSTRATION uniquement');

  await seedPlatform();
  const a = await seedCompany({
    name: 'LogiSmart Demo',
    slug: DEMO_SLUG_A,
    email: 'contact@logismart-demo.test',
    adminEmail: 'admin@demo.test',
    withDemoContent: true,
  });
  const b = await seedCompany({
    name: 'Acme Livraison',
    slug: DEMO_SLUG_B,
    email: 'contact@acme.test',
    adminEmail: 'admin@acme.test',
    withDemoContent: false,
  });

  const [users, orders, candidates, jobs, catalogItems] = await Promise.all([
    prisma.user.count(),
    prisma.order.count(),
    prisma.candidate.count(),
    prisma.jobOffer.count(),
    prisma.catalogItem.count(),
  ]);

  console.log('✔ Seed terminé');
  console.log(`  - entreprises   : 2 (${a.companyId}, ${b.companyId})`);
  console.log(`  - utilisateurs  : ${users}`);
  console.log(`  - livreurs      : ${a.drivers.length}`);
  console.log(`  - commandes     : ${orders}`);
  console.log(`  - candidats     : ${candidates}`);
  console.log(`  - offres        : ${jobs}`);
  console.log(`  - catalogue     : ${catalogItems}`);
  console.log(`  - connexion     : admin@demo.test / ${DEMO_PASSWORD}`);
}

main()
  .catch((err) => {
    console.error('✖ Seed en échec :', err);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
