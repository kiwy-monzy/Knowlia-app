export interface UserPreferences {
  language: string
  notifications: boolean
  themes: string
}

export interface UserProfile {
  _id?: string
  username: string
  fullName: string
  phoneNumber: string
  email: string
  password?: string
  profileImage?: string
  preferences: UserPreferences
  dateOfBirth: string
  goals: string[]
  activities: string[]
  preferredAppTime: string
  role?: string
  isEmailVerified?: boolean
  currentOTP?: string
  otpExpires?: string
  emailVerificationToken?: string
  emailVerificationTokenExpires?: string
}

export interface ApiResponse<T> {
  success: boolean
  data: T
  message?: string
}
