import type { PortalDatabase } from '../types/portal';

export const OFFICIAL_LOGO_URL =
  '/assets/aistudio/Gemini_Generated_Image_ipguhipguhipguhi_5afe4319.jpg';

export const ENTRY_PASS_TEMPLATE_URL =
  '/assets/aistudio/Gemini_Generated_Image_i9rcvai9rcvai9rc_1054d6c6.jpg';

export const SEED_DATABASE: PortalDatabase = {
  houses: [
    {
      id: '2c1c8762-4128-41eb-9df8-1cf5c4d31506',
      street: 'De Las Flores',
      number: '389',
      interiorNumber: null,
      familyName: 'Daniel Cruz',
      active: true,
    },
  ],
  users: [
    {
      id: 'usr-admin',
      name: 'Admin',
      email: 'admin@puertacantera.com',
      role: 'admin',
      houseId: null,
      active: true,
      qrCode: 'PC-USR-100001',
      carCount: 1,
      vehicleQrCodes: [{ index: 1, label: 'Auto 1', code: 'PC-A1-100001' }],
    },
    {
      id: 'd1f075f4-52c5-45a8-a397-7eebac71f55c',
      name: 'Daniel Cruz',
      email: 'daniel@appmrl.mx',
      role: 'admin',
      houseId: '2c1c8762-4128-41eb-9df8-1cf5c4d31506',
      active: true,
      qrCode: 'PC-USR-389001',
      carCount: 2,
      vehicleQrCodes: [
        { index: 1, label: 'Auto 1', code: 'PC-A1-389001' },
        { index: 2, label: 'Auto 2', code: 'PC-A2-389002' },
      ],
    },
  ],
  invitations: [],
  feeHistory: [
    {
      id: '51809eff-8590-4dbe-8d03-58a8a50b8bd5',
      monthlyMxn: 400,
      semiannualMxn: 2200,
      annualMxn: 4200,
      dueDay: 10,
      billingStartMonth: '2026-11',
      effectiveFrom: '2026-11-09',
      createdAt: '2026-11-09',
      createdBy: 'Daniel Cruz',
    },
  ],
  payments: [],
  notices: [],
  reports: [
    {
      id: '83fe6af3-f129-45e3-98e5-bd73a1b301f5',
      folio: '#R-0001',
      title: 'Fuga de agua en casa 82',
      category: 'Otro',
      description: 'Hay una fuga de agua en la casa 82',
      location: 'Casa 82',
      houseId: '2c1c8762-4128-41eb-9df8-1cf5c4d31506',
      authorName: 'Daniel Cruz',
      status: 'open',
      createdAt: '2026-11-09',
      comments: [
        {
          id: 'c-1',
          authorName: 'Administración',
          isAdmin: true,
          body: 'Todo bien',
          createdAt: '2026-11-16',
        },
      ],
    },
  ],
  passes: [
    {
      id: 'pass-seed-1',
      code: 'PC-389104',
      houseId: '2c1c8762-4128-41eb-9df8-1cf5c4d31506',
      createdByName: 'Daniel Cruz',
      visitorName: 'Visita familiar',
      accessType: 'multi',
      companions: 2,
      validFrom: '2026-11-09',
      validUntil: '2026-11-15',
      status: 'cancelled',
      createdAt: '2026-11-09',
      entries: [],
    },
  ],
  auditLog: [
    {
      id: '10',
      actorName: 'Admin',
      action: 'Aceptó una invitación',
      timestampLabel: '19 nov 2026, 20:14',
    },
    {
      id: '9',
      actorName: 'Daniel Cruz',
      action: 'Invitó a un usuario',
      timestampLabel: '19 nov 2026, 20:14',
      afterSummary: 'role: admin · email: admin@puertacantera.com · houseId: null',
    },
    {
      id: '8',
      actorName: 'Daniel Cruz',
      action: 'Comentó un reporte',
      timestampLabel: '16 nov 2026, 12:26',
    },
    {
      id: '7',
      actorName: 'Daniel Cruz',
      action: 'Creó un pase de visita',
      timestampLabel: '9 nov 2026, 23:15',
      afterSummary:
        'access: multi · houseId: 2c1c8762-4128-41eb-9df8-1cf5c4d31506 · validFrom: 2026-11-09T06:00:00.000Z · validUntil: 2026-11-10T06:00:00.000Z',
    },
    {
      id: '6',
      actorName: 'Daniel Cruz',
      action: 'Cambió las cuotas',
      timestampLabel: '9 nov 2026, 23:14',
      afterSummary:
        'id: 51809eff-8590-4dbe-8d03-58a8a50b8bd5 · dueDay: 10 · annualCents: 420000 · createdById: d1f075f4-52c5-45a8-a397-7eebac71f55c · billingStart: 2026-11-01 · monthlyCents: 40000 · effectiveFrom: 2026-11-09 · semiannualCents: 220000',
    },
    {
      id: '5',
      actorName: 'Daniel Cruz',
      action: 'Canceló un pase',
      timestampLabel: '9 nov 2026, 14:54',
    },
    {
      id: '4',
      actorName: 'Daniel Cruz',
      action: 'Levantó un reporte',
      timestampLabel: '9 nov 2026, 13:22',
      afterSummary: 'category: otro',
    },
    {
      id: '3',
      actorName: 'Daniel Cruz',
      action: 'Creó un pase de visita',
      timestampLabel: '9 nov 2026, 13:19',
      afterSummary:
        'access: multi · houseId: 2c1c8762-4128-41eb-9df8-1cf5c4d31506 · validFrom: 2026-11-09T06:00:00.000Z · validUntil: 2026-11-15T06:00:00.000Z',
    },
    {
      id: '2',
      actorName: 'Daniel Cruz',
      action: 'Cambió el acceso de un usuario',
      timestampLabel: '9 nov 2026, 13:08',
      beforeSummary: 'role: admin · active: true · houseId: null',
      afterSummary: 'role: admin · active: true · houseId: 2c1c8762-4128-41eb-9df8-1cf5c4d31506',
    },
    {
      id: '1',
      actorName: 'Daniel Cruz',
      action: 'Agregó una casa',
      timestampLabel: '9 nov 2026, 12:13',
      afterSummary:
        'id: 2c1c8762-4128-41eb-9df8-1cf5c4d31506 · lot: null · active: true · number: 389 · street: De Las Flores · familyName: Daniel Cruz',
    },
  ],
  pushEnabled: false,
};
