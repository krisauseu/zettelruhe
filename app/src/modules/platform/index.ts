/**
 * Modul: platform
 * Auth, Session-Gate, Setup, App-Shell — Bauabschnitt 1.
 */
export const MODULE_ID = "platform" as const;
export { loginAction, logoutAction, setupAction } from "./auth-actions";
