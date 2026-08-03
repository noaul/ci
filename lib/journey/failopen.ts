/**
 * How long the document waits for the journey before taking its own scripts
 * back.
 *
 * Long enough that a slow but working bundle is not thrown away, short enough
 * that a broken one is not a closed door. Kept apart from the rest of the
 * journey so the root layout can inline the number without pulling a client
 * module into every route.
 */
export const SCREEN_FAIL_OPEN_MS = 2400;
