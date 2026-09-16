import type { Identity } from './Identity.js'

export interface IIdentityRepository {
  save(identity: Identity): Promise<void>
  findByProviderAndProviderId(
    provider: 'email' | 'google' | 'github',
    providerId: string,
  ): Promise<Identity | null>
}
