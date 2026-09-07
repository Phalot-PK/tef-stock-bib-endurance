export type AccessRole = 'owner' | 'secret-admin' | 'manager' | 'viewer';

export type AllowedUser = {
  email: string;
  name: string;
  role: AccessRole;
  displayRole: 'ผู้ใช้งานทั่วไป' | 'ผู้ใช้งานระดับสูง';
  canEnterAdminMode: boolean;
  canComment: boolean;
};

const users: AllowedUser[] = [
  {
    email: 'phalot.k@tefthailand.com',
    name: 'Phalot Kerdsin',
    role: 'owner',
    displayRole: 'ผู้ใช้งานทั่วไป',
    canEnterAdminMode: true,
    canComment: true,
  },
  {
    email: 'wannisa.j@tefthailand.com',
    name: 'Wannisa Jitwattananon',
    role: 'secret-admin',
    displayRole: 'ผู้ใช้งานทั่วไป',
    canEnterAdminMode: true,
    canComment: true,
  },
  ...[
    ['nara.k@tefthailand.com', 'Nara Ketusingha'],
    ['piyathida.y@tefthailand.com', 'Piyathida Yodteerak'],
    ['surakij.u@tefthailand.com', 'Surakij Udomphuech'],
    ['davin.s@tefthailand.com', 'Davin S.'],
    ['angela.a@tefthailand.com', 'Angela A.'],
  ].map(([email, name]) => ({
    email,
    name,
    role: 'manager' as const,
    displayRole: 'ผู้ใช้งานระดับสูง' as const,
    canEnterAdminMode: false,
    canComment: true,
  })),
  {
    email: 'gunwalada.m@tefthailand.com',
    name: 'Gunwalada M.',
    role: 'viewer',
    displayRole: 'ผู้ใช้งานทั่วไป',
    canEnterAdminMode: false,
    canComment: false,
  },
  {
    email: 'ryan.e@tefthailand.com',
    name: 'Ryan E.',
    role: 'viewer',
    displayRole: 'ผู้ใช้งานทั่วไป',
    canEnterAdminMode: false,
    canComment: false,
  },
];

export function getAllowedUser(email: string) {
  const normalized = email.trim().toLowerCase();
  return users.find((user) => user.email === normalized) ?? null;
}

export function listAllowedEmails() {
  return users.map((user) => user.email);
}

