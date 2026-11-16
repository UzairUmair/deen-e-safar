export type AuthIdentity = { uid: string; email: string | null; displayName: string | null; emailVerified: boolean; providers: string[]; getToken: (refresh?: boolean) => Promise<string> };
export type AuthDriver = {
  redirected?: boolean;
  redirectError?: unknown;
  subscribe: (callback: (user: AuthIdentity | null) => void, error: (error: unknown) => void) => () => void;
  login: (email: string, password: string) => Promise<void>;
  signup: (name: string, email: string, password: string) => Promise<string | void>;
  google: (flow?: "popup" | "redirect") => Promise<void>;
  logout: () => Promise<void>;
  verifyEmail: () => Promise<void>;
  resetEmail: (email: string) => Promise<void>;
  refresh: () => Promise<AuthIdentity | null>;
  reauthenticate: (password?: string) => Promise<void>;
  linkGoogle: () => Promise<void>;
  setName: (name: string) => Promise<void>;
  action: (mode: string, code: string, password?: string) => Promise<string>;
};
