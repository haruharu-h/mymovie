export type CurrentUser = {
  id: string
  name: string
  email: string | null
  birthdate: string | null
  snsUrl: string | null
}

export type UserSummary = {
  id: string
  name: string
  birthdate: string | null
}

export type UpdateProfileInput = {
  name: string
  birthdate: string | null
  snsUrl: string | null
}
