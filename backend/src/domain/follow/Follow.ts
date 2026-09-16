export class Follow {
  constructor(
    readonly followerId: string,
    readonly followeeId: string,
    readonly createdAt: Date,
  ) {}
}
