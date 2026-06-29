import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { useAuth } from "../context/AuthContext";
import { AuthLandingPage } from "./AuthLandingPage";

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

describe("AuthLandingPage", () => {
  beforeEach(() => {
    navigateMock.mockReset();
  });

  it("renders login and sign up options for unauthenticated users", () => {
    vi.mocked(useAuth).mockReturnValue({
      currentUser: null,
      loading: false,
      isOffline: false,
      pendingCount: 0,
      lastSyncError: null,
      refresh: vi.fn(),
      logout: vi.fn(),
      deleteAccount: vi.fn(),
      exportAccountData: vi.fn(),
    });

    render(
      <MemoryRouter
        future={{ v7_startTransition: true, v7_relativeSplatPath: true }}
      >
        <AuthLandingPage />
      </MemoryRouter>,
    );

    expect(
      screen.getByRole("heading", { name: "Welcome to Training Log" }),
    ).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Login" })).toHaveAttribute(
      "href",
      "/login",
    );
    expect(screen.getByRole("link", { name: "Sign Up" })).toHaveAttribute(
      "href",
      "/signup",
    );
    expect(navigateMock).not.toHaveBeenCalled();
  });

  it("redirects authenticated users to workouts", () => {
    vi.mocked(useAuth).mockReturnValue({
      currentUser: { username: "Jane Doe" },
      loading: false,
      isOffline: false,
      pendingCount: 0,
      lastSyncError: null,
      refresh: vi.fn(),
      logout: vi.fn(),
      deleteAccount: vi.fn(),
      exportAccountData: vi.fn(),
    });

    render(
      <MemoryRouter
        future={{ v7_startTransition: true, v7_relativeSplatPath: true }}
      >
        <AuthLandingPage />
      </MemoryRouter>,
    );

    expect(navigateMock).toHaveBeenCalledWith("/training_log/1/workouts", {
      replace: true,
    });
  });
});
