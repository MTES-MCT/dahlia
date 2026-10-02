import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, fireEvent, cleanup } from "@testing-library/react";
import { ProConnectLoginButton } from "./proconnect-login-button";

// The button triggers the ProConnect OAuth2 flow via the better-auth client;
// mock it so no real auth client is instantiated and the call is observable.
const mockSocial = vi.fn();

vi.mock("@/app/lib/auth-client", () => ({
  signIn: { social: (...args: unknown[]) => mockSocial(...args) },
}));

describe("ProConnectLoginButton", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    cleanup();
  });

  it("rend le bouton ProConnect", () => {
    render(<ProConnectLoginButton />);

    expect(screen.getByRole("button")).toBeTruthy();
  });

  it("déclenche le flux OAuth2 proconnect au clic, avec redirection vers /case_files", () => {
    render(<ProConnectLoginButton />);

    fireEvent.click(screen.getByRole("button"));

    expect(mockSocial).toHaveBeenCalledTimes(1);
    expect(mockSocial).toHaveBeenCalledWith({
      provider: "proconnect",
      callbackURL: "/case_files",
    });
  });
});
