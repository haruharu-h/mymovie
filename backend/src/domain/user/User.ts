export class User {
  constructor(
    readonly id: string,
    readonly name: string,
    readonly email: string | null,
    readonly birthdate: string | null,
    readonly snsUrl: string | null,
    readonly avatarUrl: string | null,
    readonly createdAt: Date,
  ) {}
}
