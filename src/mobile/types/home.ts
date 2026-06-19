export interface MobileAuthSession {
  isLoggedIn: boolean
  account: string
  token: string
}

export interface MobileHostItem {
  id: string
  name: string
  host: string
  port: number
  username: string
}

export interface MobileEnvironmentItem {
  id: string
  name: string
}

export interface AddHostPayload {
  name: string
  host: string
  port: number
  username: string
}

export interface LoginPayload {
  account: string
  password: string
}

export interface LoginResult {
  token: string
  account: string
}
