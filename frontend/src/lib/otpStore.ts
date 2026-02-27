// Shared in-memory OTP store (singleton via globalThis)
// Both send-otp and verify-otp routes import from here

interface OtpEntry {
    otp: string;
    expiresAt: number;
}

const GLOBAL_KEY = "__interior_otp_store";

function getStore(): Map<string, OtpEntry> {
    const g = globalThis as any;
    if (!g[GLOBAL_KEY]) {
        g[GLOBAL_KEY] = new Map<string, OtpEntry>();
    }
    return g[GLOBAL_KEY];
}

export function setOtp(email: string, otp: string, ttlMs = 5 * 60 * 1000): void {
    const store = getStore();
    store.set(email.toLowerCase().trim(), { otp, expiresAt: Date.now() + ttlMs });

    // Cleanup expired
    for (const [key, val] of store.entries()) {
        if (val.expiresAt < Date.now()) store.delete(key);
    }
}

export function verifyOtp(email: string, otp: string): { valid: boolean; error?: string } {
    const store = getStore();
    const key = email.toLowerCase().trim();
    const entry = store.get(key);

    if (!entry) {
        return { valid: false, error: "No OTP found. Please request a new one." };
    }

    if (entry.expiresAt < Date.now()) {
        store.delete(key);
        return { valid: false, error: "OTP expired. Please request a new one." };
    }

    if (entry.otp !== otp.trim()) {
        return { valid: false, error: "Incorrect OTP. Please try again." };
    }

    // Valid — delete (one-time use)
    store.delete(key);
    return { valid: true };
}
