export const OTP_LENGTH = 6 as const;
export const OTP_TTL_SECONDS = 600;
export const OTP_TTL_MINUTES = OTP_TTL_SECONDS / 60;
export const OTP_CODE_REGEX = new RegExp(`^\\d{${OTP_LENGTH}}$`);
