import { act, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, expect, it, vi } from "vitest";
import { AuthProvider, useAuth } from "../../app/context/AuthContext";
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
  fireEvent.change(screen.getByLabelText("Email"), { target: { value: "alice@example.test" } });
  fireEvent.change(screen.getByLabelText("Password"), { target: { value: "controlled-password" } });
  fireEvent.submit(screen.getByLabelText("Email").closest("form")!);
  await waitFor(() => expect(sdk.login).toHaveBeenCalledWith("alice@example.test", "controlled-password"));
});
it("signup sends name and credentials to the Firebase driver and keeps warnings actionable", async () => {
  const sdk = driver(); sdk.signup = vi.fn(async () => "Account created. Send a verification email from Account.");
  render(<AuthProvider driver={sdk}><AuthScreen route={parseHash("#/auth/signup")} /></AuthProvider>);
  fireEvent.change(screen.getByLabelText("Name"), { target: { value: "Alice" } }); fireEvent.change(screen.getByLabelText("Email"), { target: { value: "alice@example.test" } }); fireEvent.change(screen.getByLabelText("Password"), { target: { value: "controlled-password" } });
  fireEvent.submit(screen.getByLabelText("Name").closest("form")!);
  await waitFor(() => expect(sdk.signup).toHaveBeenCalledWith("Alice", "alice@example.test", "controlled-password"));
  expect(await screen.findByRole("status")).toHaveTextContent("verification email");
});
