import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { useAuth } from "../context/AuthContext";
import { api } from "../services/api";
import { SignupPage } from "./SignupPage";

const navigateMock = vi.fn();

vi.mock("react-router-dom", async () => {
  const actual =
    await vi.importActual<typeof import("react-router-dom")>(
      "react-router-dom",
    );
  return {
    ...actual,
    useNavigate: () => navigateMock,
  };
});

vi.mock("../context/AuthContext", () => ({
  useAuth: vi.fn(),
}));

vi.mock("../services/api", () => ({
  api: {
    signup: vi.fn(),
  },
}));

describe("SignupPage", () => {
  beforeEach(() => {
    vi.resetAllMocks();
    vi.mocked(useAuth).mockReturnValue({
      currentUser: null,
      loading: false,
      isOffline: false,
      pendingCount: 0,
      lastSyncError: null,
      refresh: vi.fn().mockResolvedValue(undefined),
      logout: vi.fn(),
      deleteAccount: vi.fn(),
      exportAccountData: vi.fn(),
    });
  });

  it("signs up and navigates to workouts", async () => {
    const refresh = vi.fn().mockResolvedValue(undefined);
    vi.mocked(useAuth).mockReturnValue({
      currentUser: null,
      loading: false,
      isOffline: false,
      pendingCount: 0,
      lastSyncError: null,
      refresh,
      logout: vi.fn(),
      deleteAccount: vi.fn(),
      exportAccountData: vi.fn(),
    });

    render(
      <MemoryRouter
        future={{ v7_startTransition: true, v7_relativeSplatPath: true }}
      >
        <SignupPage />
      </MemoryRouter>,
    );

    await userEvent.type(screen.getByLabelText("Username"), "New User");
    await userEvent.type(
      screen.getByLabelText("Password"),
      "super-secure-password",
    );
    await userEvent.click(
      screen.getByLabelText(/I agree to the privacy notice/i),
    );
    await userEvent.click(
      screen.getByRole("button", { name: "Create Account" }),
    );

    await waitFor(() => {
      expect(api.signup).toHaveBeenCalledWith({
        username: "New User",
        password: "super-secure-password",
        gdprConsentAccepted: true,
      });
      expect(refresh).toHaveBeenCalled();
      expect(navigateMock).toHaveBeenCalledWith("/training_log/1/workouts");
    });
  });

  it("shows API error on failed signup", async () => {
    vi.mocked(api.signup).mockRejectedValue(
      new Error("Username already exists."),
    );

    render(
      <MemoryRouter
        future={{ v7_startTransition: true, v7_relativeSplatPath: true }}
      >
        <SignupPage />
      </MemoryRouter>,
    );

    await userEvent.type(screen.getByLabelText("Username"), "Jane Doe");
    await userEvent.type(
      screen.getByLabelText("Password"),
      "super-secure-password",
    );
    await userEvent.click(
      screen.getByLabelText(/I agree to the privacy notice/i),
    );
    await userEvent.click(
      screen.getByRole("button", { name: "Create Account" }),
    );

    expect(
      await screen.findByText("Username already exists."),
    ).toBeInTheDocument();
  });

  it("renders a privacy notice link to the privacy policy page", () => {
    render(
      <MemoryRouter
        future={{ v7_startTransition: true, v7_relativeSplatPath: true }}
      >
        <SignupPage />
      </MemoryRouter>,
    );

    const privacyLink = screen.getByRole("link", { name: /privacy notice/i });
    expect(privacyLink).toHaveAttribute("href", "/privacy");
  });
});
