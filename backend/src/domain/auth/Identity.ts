export class Identity {
  constructor(
    readonly id: string,
    readonly userId: string,
    readonly provider: 'email' | 'google' | 'github',
    readonly providerId: string,
    readonly passwordHash: string | null,
    readonly createdAt: Date,
  ) {}
}
