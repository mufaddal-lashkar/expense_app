import { createHash, randomBytes } from "crypto";

// Generate a cryptographically secure raw token to send in the invite link
export function generateInviteToken(): string {
    return randomBytes(32).toString("hex");
}

// Hash the raw token for DB storage — we never store the raw token
export function hashToken(rawToken: string): string {
    return createHash("sha256").update(rawToken).digest("hex");
}

// Invite TTL — 24 hours from now
export function inviteExpiresAt(): Date {
    const d = new Date();
    d.setHours(d.getHours() + 24);
    return d;
}