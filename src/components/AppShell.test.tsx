import { render, screen } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { useAuth } from "../context/AuthContext";
import { AppShell } from "./AppShell";

vi.mock("../context/AuthContext", () => ({
  useAuth: vi.fn(),
}));

vi.mock("./OfflineIndicator", () => ({
  OfflineIndicator: () => (
    <div data-testid="offline-indicator">Offline Indicator</div>
  ),
}));

describe("AppShell", () => {
  beforeEach(() => {
    vi.resetAllMocks();
  });

  it("displays offline indicator component for authenticated users", () => {
    vi.mocked(useAuth).mockReturnValue({
      currentUser: { username: "Jane Doe" },
      loading: false,
      refresh: vi.fn(),
      logout: vi.fn(),
      deleteAccount: vi.fn(),
      exportAccountData: vi.fn(),
    } as any);

    render(
      <MemoryRouter
        initialEntries={["/training_log/1/workouts"]}
        future={{ v7_startTransition: true, v7_relativeSplatPath: true }}
      >
        <Routes>
          <Route path="/" element={<AppShell />}>
            <Route
              path="training_log/:pageNumber/workouts"
              element={<div>Workouts</div>}
            />
          </Route>
        </Routes>
      </MemoryRouter>,
    );

    expect(screen.getByTestId("offline-indicator")).toBeInTheDocument();
  });

  it("does not display offline indicator for unauthenticated users", () => {
    vi.mocked(useAuth).mockReturnValue({
      currentUser: null,
      loading: false,
      refresh: vi.fn(),
      logout: vi.fn(),
      deleteAccount: vi.fn(),
      exportAccountData: vi.fn(),
    } as any);

    render(
      <MemoryRouter
        initialEntries={["/login"]}
        future={{ v7_startTransition: true, v7_relativeSplatPath: true }}
      >
        <Routes>
          <Route path="/" element={<AppShell />}>
            <Route path="login" element={<div>Login</div>} />
          </Route>
        </Routes>
      </MemoryRouter>,
    );

    expect(screen.queryByTestId("offline-indicator")).not.toBeInTheDocument();
  });
});
