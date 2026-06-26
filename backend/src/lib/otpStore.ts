interface OTPEntry {
  otp: string;
  expiresAt: number;
}

const store = new Map<string, OTPEntry>();

export const otpStore = {
  set(email: string, otp: string) {
    store.set(email, {
      otp,
      expiresAt: Date.now() + 10 * 60 * 1000, // 10 mins
    });
  },

  verify(email: string, otp: string): 'valid' | 'expired' | 'invalid' {
    const entry = store.get(email);
    if (!entry) return 'invalid';
    if (Date.now() > entry.expiresAt) { store.delete(email); return 'expired'; }
    if (entry.otp !== otp) return 'invalid';
    store.delete(email); // one-time use
    return 'valid';
  },
};