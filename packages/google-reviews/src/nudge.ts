export type ReviewNudgeState = {
  sentAt: Date | null;
  /** When the customer clicked through or dismissed. Suppresses both channels. */
  doneAt: Date | null;
};

export type ReviewNudgeStore = {
  get(email: string): Promise<ReviewNudgeState | undefined>;
  markSent(email: string): Promise<void>;
  markDone(email: string): Promise<void>;
};

export function shouldNudge(state: ReviewNudgeState | undefined): boolean {
  if (!state) return true;
  return state.sentAt === null && state.doneAt === null;
}

// ponytail: the emailed link itself is untracked — a click here never reaches markDone,
// unlike the in-app card. Tracking it needs a redirect route with a signed (HMAC'd) token
// per recipient, since the link goes to an unauthenticated inbox. Add if click analytics
// on the email channel ever matter; until then the in-app card is the only tracked path.
export function writeReviewUrl(placeId: string): string {
  return `https://search.google.com/local/writereview?placeid=${encodeURIComponent(placeId)}`;
}
