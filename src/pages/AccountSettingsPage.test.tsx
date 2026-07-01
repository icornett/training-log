import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { useAuth } from "../context/AuthContext";
import { AccountSettingsPage } from "./AccountSettingsPage";

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

describe("AccountSettingsPage", () => {
  beforeEach(() => {
    vi.resetAllMocks();
    vi.stubGlobal(
      "confirm",
      vi.fn(() => true),
    );
    Object.defineProperty(URL, "createObjectURL", {
      value: vi.fn(() => "blob://test"),
      configurable: true,
    });
    Object.defineProperty(URL, "revokeObjectURL", {
      value: vi.fn(),
      configurable: true,
    });

    // Mock HTMLAnchorElement.click() to prevent jsdom navigation errors on blob URLs
    HTMLAnchorElement.prototype.click = vi.fn(() => {
      // Prevent jsdom navigation error
    });

    vi.mocked(useAuth).mockReturnValue({
      currentUser: { username: "demo" },
      loading: false,
      isOffline: false,
      pendingCount: 0,
      lastSyncError: null,
      refresh: vi.fn(),
      logout: vi.fn(),
      deleteAccount: vi.fn(),
      exportAccountData: vi.fn(async () => '{"ok":true}'),
      updateFavoriteTeam: vi.fn(async () => undefined),
    });
  });

  it("exports JSON data", async () => {
    const exportAccountData = vi.fn(async () => '{"ok":true}');
    vi.mocked(useAuth).mockReturnValue({
      currentUser: { username: "demo" },
      loading: false,
      isOffline: false,
      pendingCount: 0,
      lastSyncError: null,
      refresh: vi.fn(),
      logout: vi.fn(),
      deleteAccount: vi.fn(),
      exportAccountData,
      updateFavoriteTeam: vi.fn(async () => undefined),
    });

    render(
      <MemoryRouter
        initialEntries={["/training_log/1/account"]}
        future={{ v7_startTransition: true, v7_relativeSplatPath: true }}
      >
        <Routes>
          <Route
            path="/training_log/:pageNumber/account"
            element={<AccountSettingsPage />}
          />
        </Routes>
      </MemoryRouter>,
    );

    await userEvent.click(screen.getByRole("button", { name: "Export JSON" }));

    await waitFor(() => {
      expect(exportAccountData).toHaveBeenCalledWith("json");
      expect(
        screen.getByText(/Exported account data as JSON/i),
      ).toBeInTheDocument();
    });
  });

  it("deletes account after confirmation", async () => {
    const deleteAccount = vi.fn(async () => undefined);
    vi.mocked(useAuth).mockReturnValue({
      currentUser: { username: "demo" },
      loading: false,
      isOffline: false,
      pendingCount: 0,
      lastSyncError: null,
      refresh: vi.fn(),
      logout: vi.fn(),
      deleteAccount,
      exportAccountData: vi.fn(async () => '{"ok":true}'),
      updateFavoriteTeam: vi.fn(async () => undefined),
    });

    render(
      <MemoryRouter
        initialEntries={["/training_log/1/account"]}
        future={{ v7_startTransition: true, v7_relativeSplatPath: true }}
      >
        <Routes>
          <Route
            path="/training_log/:pageNumber/account"
            element={<AccountSettingsPage />}
          />
        </Routes>
      </MemoryRouter>,
    );

    await userEvent.click(
      screen.getByRole("button", { name: "Delete Account" }),
    );

    await waitFor(() => {
      expect(deleteAccount).toHaveBeenCalled();
      expect(navigateMock).toHaveBeenCalledWith("/signup");
    });
  });

  const renderPage = () =>
    render(
      <MemoryRouter
        initialEntries={["/training_log/1/account"]}
        future={{ v7_startTransition: true, v7_relativeSplatPath: true }}
      >
        <Routes>
          <Route
            path="/training_log/:pageNumber/account"
            element={<AccountSettingsPage />}
          />
        </Routes>
      </MemoryRouter>,
    );

  it("renders the Favorite Team selector", () => {
    renderPage();
    expect(
      screen.getByRole("combobox", { name: /favorite team/i }),
    ).toBeInTheDocument();
  });

  it("pre-selects the stored team preference", () => {
    vi.mocked(useAuth).mockReturnValue({
      currentUser: { username: "demo", favoriteTeamKey: "nhl:kraken" },
      loading: false,
      isOffline: false,
      pendingCount: 0,
      lastSyncError: null,
      refresh: vi.fn(),
      logout: vi.fn(),
      deleteAccount: vi.fn(),
      exportAccountData: vi.fn(async () => "{}"),
      updateFavoriteTeam: vi.fn(async () => undefined),
    });

    renderPage();

    expect(
      (screen.getByRole("combobox", { name: /favorite team/i }) as HTMLSelectElement).value,
    ).toBe("nhl:kraken");
  });

  it("calls updateFavoriteTeam when user picks a new team", async () => {
    const updateFavoriteTeam = vi.fn(async () => undefined);
    vi.mocked(useAuth).mockReturnValue({
      currentUser: { username: "demo" },
      loading: false,
      isOffline: false,
      pendingCount: 0,
      lastSyncError: null,
      refresh: vi.fn(),
      logout: vi.fn(),
      deleteAccount: vi.fn(),
      exportAccountData: vi.fn(async () => "{}"),
      updateFavoriteTeam,
    });

    renderPage();

    await userEvent.selectOptions(
      screen.getByRole("combobox", { name: /favorite team/i }),
      "mlb:mariners",
    );

    await waitFor(() => {
      expect(updateFavoriteTeam).toHaveBeenCalledWith("mlb:mariners");
    });
  });
});
