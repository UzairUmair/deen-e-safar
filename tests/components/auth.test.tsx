import { act, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, expect, it, vi } from "vitest";
import { AuthProvider, authError, useAuth } from "../../app/context/AuthContext";
import { authDestination, consumeGoogleReturn, normalizedEmail, rememberGoogleReturn, validateAuth } from "../../app/lib/authValidation";
import { AccountGate, AuthScreen } from "../../app/screens/Account";
import { parseHash } from "../../app/lib/router";
import type { AuthDriver, AuthIdentity } from "../../app/services/account/authTypes";
const api = vi.hoisted(() => vi.fn());
vi.mock("../../app/services/account/backendClient", async original => ({ ...await original<object>(), API_BASE: "https://api.example.test", backendRequest: api }));
let listener: (user: AuthIdentity | null) => void;
const identity: AuthIdentity = { uid: "alice", email: "alice@example.test", displayName: "Alice", emailVerified: false, providers: ["password"], getToken: vi.fn(async () => "controlled-token") };
function driver(): AuthDriver {
  return {
    subscribe: callback => { listener = callback; callback(null); return () => {}; },
    login: vi.fn(async () => listener(identity)), google: vi.fn(async () => listener({ ...identity, providers: ["google.com"] })),
    signup: vi.fn(async () => { listener(identity); return ""; }), logout: vi.fn(async () => listener(null)),
    verifyEmail: vi.fn(async () => {}), resetEmail: vi.fn(async () => {}), refresh: vi.fn(async () => identity), reauthenticate: vi.fn(async () => {}), linkGoogle: vi.fn(async () => {}), setName: vi.fn(async () => {}), action: vi.fn(async () => "Email verified."),
  };
}
function Inspector() { const auth = useAuth(); return <><span data-testid="identity">{auth.user?.uid || "guest"}</span><span data-testid="error">{auth.error}</span><button onClick={() => void auth.logout()}>Exit</button><AccountGate><p>Private dashboard</p></AccountGate></>; }
afterEach(() => { api.mockReset(); });
it("retains Firebase identity when profile sync fails and clears private screens on logout", async () => {
  api.mockRejectedValue(new Error("Account storage is temporarily unavailable.")); const sdk = driver();
  render(<AuthProvider driver={sdk}><Inspector /></AuthProvider>);
  expect(screen.queryByText("Private dashboard")).toBeNull();
  act(() => listener(identity));
  await waitFor(() => expect(screen.getByTestId("error")).toHaveTextContent("temporarily unavailable"));
  expect(screen.getByTestId("identity")).toHaveTextContent("alice"); expect(screen.getByText("Private dashboard")).toBeInTheDocument();
  fireEvent.click(screen.getByText("Exit")); await waitFor(() => expect(screen.getByTestId("identity")).toHaveTextContent("guest"));
  expect(screen.queryByText("Private dashboard")).toBeNull(); expect(sdk.logout).toHaveBeenCalledOnce();
});
it("submits email login and handles Google provider conflicts without losing guest access", async () => {
  api.mockRejectedValue(new Error("Account storage is temporarily unavailable.")); const sdk = driver();
  sdk.google = vi.fn(async () => { throw { code: "auth/account-exists-with-different-credential" }; });
  render(<AuthProvider driver={sdk}><AuthScreen route={parseHash("#/auth/login")} /></AuthProvider>);
  fireEvent.click(screen.getByText("Continue with Google"));
  expect(await screen.findByRole("alert")).toHaveTextContent("another sign-in method");
  expect(screen.getByText("Continue as Guest")).toHaveAttribute("href", "#/dashboard");
  fireEvent.change(screen.getByLabelText("Email Address"), { target: { value: "alice@example.test" } });
  fireEvent.change(screen.getByLabelText("Password", { exact: true }), { target: { value: "controlled-password" } });
  fireEvent.submit(screen.getByLabelText("Email Address").closest("form")!);
  await waitFor(() => expect(sdk.login).toHaveBeenCalledWith("alice@example.test", "controlled-password"));
});
it("signup sends name and credentials to the Firebase driver and keeps warnings actionable", async () => {
  const sdk = driver(); sdk.signup = vi.fn(async () => "Account created. Send a verification email from Account.");
  render(<AuthProvider driver={sdk}><AuthScreen route={parseHash("#/auth/signup")} /></AuthProvider>);
  fireEvent.change(screen.getByLabelText("Full Name"), { target: { value: "Alice" } }); fireEvent.change(screen.getByLabelText("Email Address"), { target: { value: "alice@example.test" } }); fireEvent.change(screen.getByLabelText("Password", { exact: true }), { target: { value: "controlled-password" } });
  fireEvent.change(screen.getByLabelText("Confirm Password", { exact: true }), { target: { value: "controlled-password" } });
  fireEvent.submit(screen.getByLabelText("Full Name").closest("form")!);
  await waitFor(() => expect(sdk.signup).toHaveBeenCalledWith("Alice", "alice@example.test", "controlled-password"));
  expect(await screen.findByRole("status")).toHaveTextContent("verification email");
});

function fillSignup() {
  fireEvent.change(screen.getByLabelText("Full Name"), { target: { value: "  Alice  " } });
  fireEvent.change(screen.getByLabelText("Email Address"), { target: { value: "  ALICE@example.test  " } });
  for (const label of ["Password", "Confirm Password"]) fireEvent.change(screen.getByLabelText(label, { exact: true }), { target: { value: "controlled-password" } });
}
it("preserves a created account when the subsequent Firebase refresh fails", async () => {
  api.mockRejectedValue(new Error("Account storage is temporarily unavailable."));
  const sdk = driver(); sdk.refresh = vi.fn(async () => { throw { code: "auth/network-request-failed" }; });
  render(<AuthProvider driver={sdk}><AuthScreen route={parseHash("#/auth/signup")} /></AuthProvider>);
  fillSignup(); fireEvent.submit(screen.getByLabelText("Full Name").closest("form")!);
  expect(await screen.findByText("Your journey starts here")).toBeInTheDocument();
  expect(screen.getByText("Your account was created. Refresh your account to finish syncing your profile.")).toBeInTheDocument();
  expect(sdk.signup).toHaveBeenCalledOnce();
  expect(screen.getByRole("link", { name: "Continue to dashboard" })).toHaveAttribute("href", "#/account/dashboard");
});
it("validates signup fields inline before making any Firebase request", () => {
  const sdk = driver(); render(<AuthProvider driver={sdk}><AuthScreen route={parseHash("#/auth/signup")} /></AuthProvider>);
  fireEvent.submit(screen.getByLabelText("Full Name").closest("form")!);
  expect(screen.getByText("Enter your full name.")).toBeInTheDocument();
  expect(screen.getByText("Enter a valid email address.")).toBeInTheDocument();
  expect(screen.getByText("Use at least 8 characters.")).toBeInTheDocument();
  expect(screen.getByLabelText("Full Name")).toHaveFocus();
  expect(sdk.signup).not.toHaveBeenCalled();
  fillSignup(); fireEvent.change(screen.getByLabelText("Confirm Password", { exact: true }), { target: { value: "mismatched-password" } });
  fireEvent.submit(screen.getByLabelText("Full Name").closest("form")!);
  expect(screen.getByText("Passwords do not match.")).toBeInTheDocument(); expect(sdk.signup).not.toHaveBeenCalled();
});
it("blocks duplicate submissions immediately and normalizes email without altering passwords", async () => {
  const sdk = driver(); let finish!: () => void;
  sdk.signup = vi.fn(() => new Promise<void>(resolve => { finish = resolve; }));
  render(<AuthProvider driver={sdk}><AuthScreen route={parseHash("#/auth/signup")} /></AuthProvider>);
  fillSignup(); const form = screen.getByLabelText("Full Name").closest("form")!;
  fireEvent.submit(form); fireEvent.submit(form);
  expect(sdk.signup).toHaveBeenCalledExactlyOnceWith("Alice", "alice@example.test", "controlled-password");
  expect(screen.getByRole("button", { name: "Please wait…" })).toBeDisabled();
  expect(screen.getByRole("button", { name: "Continue with Google" })).toBeDisabled();
  await act(async () => finish());
});
it.each([
  ["auth/popup-closed-by-user", "The sign-in window was closed. Try again when ready."],
  ["auth/popup-blocked", "Allow the sign-in popup and try again."],
  ["auth/unauthorized-domain", "Sign-in is unavailable on this domain. Continue as Guest."],
  ["auth/network-request-failed", "The connection failed. Please retry."],
  ["auth/account-exists-with-different-credential", "This email uses another sign-in method. Sign in with that method, then link Google from Account."],
])("handles Google error %s safely and releases loading state", async (code, message) => {
  const sdk = driver(); sdk.google = vi.fn(async () => { throw { code, message: "Private upstream diagnostics" }; });
  render(<AuthProvider driver={sdk}><AuthScreen route={parseHash("#/auth/login")} /></AuthProvider>);
  fireEvent.click(screen.getByRole("button", { name: "Continue with Google" }));
  expect(await screen.findByRole("alert")).toHaveTextContent(message);
  expect(screen.queryByText("Private upstream diagnostics")).toBeNull();
  expect(screen.getByRole("button", { name: "Continue with Google" })).toBeEnabled();
});
it("shows accessible password toggles without changing either input value", () => {
  render(<AuthProvider driver={driver()}><AuthScreen route={parseHash("#/auth/signup")} /></AuthProvider>);
  fillSignup(); fireEvent.click(screen.getByRole("button", { name: "Show password" }));
  expect(screen.getByLabelText("Password", { exact: true })).toHaveAttribute("type", "text");
  expect(screen.getByRole("button", { name: "Hide password" })).toHaveAttribute("aria-pressed", "true");
  expect(screen.getByLabelText("Confirm Password", { exact: true })).toHaveAttribute("type", "password");
  expect(screen.getByLabelText("Password", { exact: true })).toHaveValue("controlled-password");
});
it("password reset uses a neutral confirmation and offers a return to login", async () => {
  const sdk = driver(); render(<AuthProvider driver={sdk}><AuthScreen route={parseHash("#/auth/reset")} /></AuthProvider>);
  fireEvent.change(screen.getByLabelText("Email Address"), { target: { value: " READER@example.test " } });
  fireEvent.submit(screen.getByLabelText("Email Address").closest("form")!);
  expect(await screen.findByText("Check your inbox")).toBeInTheDocument();
  expect(sdk.resetEmail).toHaveBeenCalledWith("reader@example.test");
  expect(screen.getByText("If an account exists, a password reset email has been sent.")).toBeInTheDocument();
  expect(screen.getByRole("link", { name: "Back to Sign In" })).toHaveAttribute("href", "#/auth/login");
});
it("preserves a valid requested destination and rejects external or auth-loop destinations", async () => {
  const sdk = driver(); render(<AuthProvider driver={sdk}><AuthScreen route={parseHash("#/auth/login?next=%2Faccount")} /></AuthProvider>);
  fireEvent.change(screen.getByLabelText("Email Address"), { target: { value: "alice@example.test" } });
  fireEvent.change(screen.getByLabelText("Password", { exact: true }), { target: { value: "controlled-password" } });
  fireEvent.submit(screen.getByLabelText("Email Address").closest("form")!);
  await waitFor(() => expect(window.location.hash).toBe("#/account"));
  for (const value of ["https://evil.example", "//evil.example", "/\\evil", "/auth/login", "/unknown", "/account\n"]) expect(authDestination(value)).toBe("/account/dashboard");
  expect(authDestination("/quran/2?ayah=5")).toBe("/quran/2?ayah=5");
});
it("maps login errors consistently without confirming whether an email exists", () => {
  for (const code of ["auth/invalid-credential", "auth/user-not-found", "auth/wrong-password"]) expect(authError({ code })).toBe("Email or password is incorrect.");
  expect(authError({ code: "auth/internal-error", message: "private" })).toBe("Sign-in failed. Please retry.");
  expect(normalizedEmail(" User@Example.test ")).toBe("user@example.test");
  expect(validateAuth("action", { name: "", email: "", password: "", confirm: "" }, "verifyEmail")).toEqual({});
});
it.each(["auth/invalid-credential", "auth/user-disabled", "auth/network-request-failed"])("login failure %s keeps the form usable", async code => {
  const sdk = driver(); sdk.login = vi.fn(async () => { throw { code }; });
  render(<AuthProvider driver={sdk}><AuthScreen route={parseHash("#/auth/login")} /></AuthProvider>);
  const form = screen.getByLabelText("Email Address").closest("form")!;
  fireEvent.submit(form); expect(sdk.login).not.toHaveBeenCalled();
  fireEvent.change(screen.getByLabelText("Email Address"), { target: { value: "reader@example.test" } });
  fireEvent.change(screen.getByLabelText("Password", { exact: true }), { target: { value: "controlled-password" } });
  fireEvent.submit(form);
  expect(await screen.findByRole("alert")).toHaveTextContent(authError({ code }));
  expect(screen.getByRole("button", { name: "Sign In" })).toBeEnabled();
});
it("reset validates email and recovers from a network failure", async () => {
  const sdk = driver(); sdk.resetEmail = vi.fn(async () => { throw { code: "auth/network-request-failed" }; });
  render(<AuthProvider driver={sdk}><AuthScreen route={parseHash("#/auth/reset")} /></AuthProvider>);
  const form = screen.getByLabelText("Email Address").closest("form")!;
  fireEvent.change(screen.getByLabelText("Email Address"), { target: { value: "invalid" } });
  fireEvent.submit(form); expect(sdk.resetEmail).not.toHaveBeenCalled();
  fireEvent.change(screen.getByLabelText("Email Address"), { target: { value: "reader@example.test" } });
  fireEvent.submit(form); expect(await screen.findByRole("alert")).toHaveTextContent("The connection failed.");
  expect(screen.getByRole("button", { name: "Send reset email" })).toBeEnabled();
  expect(screen.queryByText("Check your inbox")).toBeNull();
});
it("existing-email rejection does not claim an account was created", async () => {
  const sdk = driver(); sdk.signup = vi.fn(async () => { throw { code: "auth/email-already-in-use" }; });
  render(<AuthProvider driver={sdk}><AuthScreen route={parseHash("#/auth/signup")} /></AuthProvider>);
  fillSignup(); fireEvent.submit(screen.getByLabelText("Full Name").closest("form")!);
  expect(await screen.findByRole("alert")).toHaveTextContent("Try signing in or resetting your password.");
  expect(screen.queryByText("Your journey starts here")).toBeNull();
});
it("email verification actions remain available in an existing session", async () => {
  const sdk = driver();
  render(<AuthProvider driver={sdk}><AuthScreen route={parseHash("#/auth/action?mode=verifyEmail&oobCode=controlled-code")} /></AuthProvider>);
  act(() => listener(identity));
  fireEvent.submit(screen.getByRole("form", { name: "Complete email action" }));
  await waitFor(() => expect(sdk.action).toHaveBeenCalledWith("verifyEmail", "controlled-code", ""));
  expect(await screen.findByText("All set")).toBeInTheDocument();
});
it("offers Firebase redirect after a blocked popup and preserves only a safe return path", async () => {
  const sdk = driver(); sdk.google = vi.fn(async flow => { if (flow !== "redirect") throw { code: "auth/popup-blocked" }; });
  render(<AuthProvider driver={sdk}><AuthScreen route={parseHash("#/auth/login?next=%2Faccount")} /></AuthProvider>);
  fireEvent.click(screen.getByRole("button", { name: "Continue with Google" }));
  fireEvent.click(await screen.findByRole("button", { name: "Continue with Google in this tab" }));
  await waitFor(() => expect(sdk.google).toHaveBeenLastCalledWith("redirect"));
  expect(consumeGoogleReturn()).toBe("/account"); expect(consumeGoogleReturn()).toBeNull();
  rememberGoogleReturn("//external.example"); expect(consumeGoogleReturn()).toBe("/account/dashboard");
});
it("redirect completion restores the requested route once without retaining credentials", async () => {
  const sdk = driver(); sdk.redirected = true;
  rememberGoogleReturn("/preferences");
  render(<AuthProvider driver={sdk}><AuthScreen route={parseHash("#/auth/login")} /></AuthProvider>);
  act(() => listener(identity));
  await waitFor(() => expect(window.location.hash).toBe("#/preferences"));
  expect(sessionStorage.getItem("deen-auth-return")).toBeNull();
});
