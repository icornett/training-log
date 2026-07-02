import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { useAuth } from "../context/AuthContext";
import { api } from "../services/api";
import { LoginPage } from "./LoginPage";

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
    login: vi.fn(),
  },
}));

describe("LoginPage", () => {
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
      updateFavoriteTeam: vi.fn(async () => undefined),
    });
  });

  it("logs in and navigates to workouts", async () => {
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
      updateFavoriteTeam: vi.fn(async () => undefined),
    });

    render(
      <MemoryRouter
        future={{ v7_startTransition: true, v7_relativeSplatPath: true }}
      >
        <LoginPage />
      </MemoryRouter>,
    );

    await userEvent.type(screen.getByLabelText("Username"), "Jane Doe");
    await userEvent.type(screen.getByLabelText("Password"), "valid-password");
    await userEvent.click(screen.getByRole("button", { name: "Login" }));

    await waitFor(() => {
      expect(api.login).toHaveBeenCalledWith({
        username: "Jane Doe",
        password: "valid-password",
      });
      expect(refresh).toHaveBeenCalled();
      expect(navigateMock).toHaveBeenCalledWith("/training_log/1/workouts");
    });
  });

  it("shows API error on failed login", async () => {
    vi.mocked(api.login).mockRejectedValue(
      new Error("Incorrect login credentials. Please try again."),
    );

    render(
      <MemoryRouter
        future={{ v7_startTransition: true, v7_relativeSplatPath: true }}
      >
        <LoginPage />
      </MemoryRouter>,
    );

    await userEvent.type(screen.getByLabelText("Username"), "Jane Doe");
    await userEvent.type(screen.getByLabelText("Password"), "wrong-password");
    await userEvent.click(screen.getByRole("button", { name: "Login" }));

    expect(
      await screen.findByText("Incorrect login credentials. Please try again."),
    ).toBeInTheDocument();
  });

  it("redirects authenticated users", () => {
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
      updateFavoriteTeam: vi.fn(async () => undefined),
    });

    render(
      <MemoryRouter
        future={{ v7_startTransition: true, v7_relativeSplatPath: true }}
      >
        <LoginPage />
      </MemoryRouter>,
    );

    expect(navigateMock).toHaveBeenCalledWith("/training_log/1/workouts", {
      replace: true,
    });
  });
});
