export type GitHubUser = {
  id: number
  name: string | null
  login: string
}

export type GitHubEmail = {
  email: string
  primary: boolean
  verified: boolean
}

export class GitHubApiClient {
  private readonly headers = (accessToken: string) => ({
    Authorization: `Bearer ${accessToken}`,
    'User-Agent': 'mymovie-app',
  })

  async getUser(accessToken: string): Promise<GitHubUser> {
    const res = await fetch('https://api.github.com/user', { headers: this.headers(accessToken) })
    return res.json() as Promise<GitHubUser>
  }

  async getUserEmails(accessToken: string): Promise<GitHubEmail[]> {
    const res = await fetch('https://api.github.com/user/emails', { headers: this.headers(accessToken) })
    return res.json() as Promise<GitHubEmail[]>
  }
}
