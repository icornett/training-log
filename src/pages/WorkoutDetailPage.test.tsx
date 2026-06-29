import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter, Route, Routes, useParams } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { useAuth } from "../context/AuthContext";
import { api } from "../services/api";
import type { WorkoutDetails } from "../types/domain";
import { WorkoutDetailPage } from "./WorkoutDetailPage";

vi.mock("../services/api", () => ({
  api: {
    getWorkout: vi.fn(),
    updateWorkout: vi.fn(),
    deleteWorkout: vi.fn(),
    createExercise: vi.fn(),
    updateExercise: vi.fn(),
    deleteExercise: vi.fn(),
    createWorkoutWithExercise: vi.fn(),
  },
}));

vi.mock("../context/AuthContext", () => ({
  useAuth: vi.fn(),
}));

const workoutFixture: WorkoutDetails = {
  id: 1,
  name: "Upper Body",
  date: "2026-05-15",
  username: "Jane Doe",
  numSets: 4,
  numReps: 8,
  weightDescription: "95 lbs",
  exercises: [
    {
      id: 11,
      description: "Bench Press",
      exerciseType: "strength",
      numSets: 3,
      numReps: 8,
      weightDescription: "65 lbs",
      durationMinutes: null,
      speedMph: null,
      notes: null,
    },
  ],
};

const renderPage = (): void => {
  render(
    <MemoryRouter
      initialEntries={["/training_log/1/workouts/1"]}
      future={{ v7_startTransition: true, v7_relativeSplatPath: true }}
    >
      <Routes>
        <Route
          path="/training_log/:pageNumber/workouts/:workoutId"
          element={<WorkoutDetailPage />}
        />
      </Routes>
    </MemoryRouter>,
  );
};

describe("WorkoutDetailPage", () => {
  beforeEach(() => {
    vi.resetAllMocks();
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
    vi.mocked(api.getWorkout).mockResolvedValue(workoutFixture);
  });

  it("submits workout edits for the owner", async () => {
    const updatedWorkout: WorkoutDetails = {
      ...workoutFixture,
      name: "Upper Strength",
    };
    vi.mocked(api.updateWorkout).mockResolvedValue(updatedWorkout);

    renderPage();

    await screen.findByRole("heading", { name: "Upper Body" });
    await userEvent.click(screen.getByRole("button", { name: "Edit Workout" }));

    const workoutName = screen.getByLabelText("Workout Name");
    await userEvent.clear(workoutName);
    await userEvent.type(workoutName, "Upper Strength");
    await userEvent.click(screen.getByRole("button", { name: "Save Workout" }));

    await waitFor(() => {
      expect(api.updateWorkout).toHaveBeenCalledWith({
        id: 1,
        name: "Upper Strength",
        date: "2026-05-15",
      });
    });
    expect(await screen.findByText("Workout updated.")).toBeInTheDocument();
  });

  it("creates a new exercise for the owner", async () => {
    const updatedWorkout: WorkoutDetails = {
      ...workoutFixture,
      exercises: [
        ...workoutFixture.exercises,
        {
          id: 12,
          description: "Pull Ups",
          exerciseType: "strength",
          numSets: 4,
          numReps: 10,
          weightDescription: "bodyweight",
          durationMinutes: null,
          speedMph: null,
          notes: null,
        },
      ],
    };
    vi.mocked(api.createExercise).mockResolvedValue(updatedWorkout);

    renderPage();

    await screen.findByRole("heading", { name: "Upper Body" });

    await userEvent.clear(screen.getByLabelText("Description"));
    await userEvent.type(screen.getByLabelText("Description"), "Pull Ups");
    await userEvent.clear(screen.getByLabelText("Sets"));
    await userEvent.type(screen.getByLabelText("Sets"), "4");
    await userEvent.clear(screen.getByLabelText("Reps"));
    await userEvent.type(screen.getByLabelText("Reps"), "10");
    await userEvent.clear(screen.getByLabelText("Weight"));
    await userEvent.type(screen.getByLabelText("Weight"), "bodyweight");
    await userEvent.click(screen.getByRole("button", { name: "Add Exercise" }));

    await waitFor(() => {
      expect(api.createExercise).toHaveBeenCalledWith(
        1,
        {
          description: "Pull Ups",
          exerciseType: "strength",
          speedUnit: undefined,
          numSets: 4,
          numReps: 10,
          weightDescription: "bodyweight",
          durationMinutes: undefined,
          speedMph: undefined,
          speedKph: undefined,
          notes: "",
        },
        expect.objectContaining({ id: 1 }),
      );
    });
    expect(await screen.findByText("Exercise added.")).toBeInTheDocument();
  });

  it("defaults strength unit to lbs when no unit is typed", async () => {
    const updatedWorkout: WorkoutDetails = {
      ...workoutFixture,
      exercises: [
        ...workoutFixture.exercises,
        {
          id: 15,
          description: "Dumbbell Press",
          exerciseType: "strength",
          numSets: 3,
          numReps: 12,
          weightDescription: "40 lbs",
          durationMinutes: null,
          speedMph: null,
          notes: null,
        },
      ],
    };
    vi.mocked(api.createExercise).mockResolvedValue(updatedWorkout);

    renderPage();

    await screen.findByRole("heading", { name: "Upper Body" });
    await userEvent.clear(screen.getByLabelText("Description"));
    await userEvent.type(
      screen.getByLabelText("Description"),
      "Dumbbell Press",
    );
    await userEvent.clear(screen.getByLabelText("Sets"));
    await userEvent.type(screen.getByLabelText("Sets"), "3");
    await userEvent.clear(screen.getByLabelText("Reps"));
    await userEvent.type(screen.getByLabelText("Reps"), "12");
    await userEvent.clear(screen.getByLabelText("Weight"));
    await userEvent.type(screen.getByLabelText("Weight"), "40");
    await userEvent.click(screen.getByRole("button", { name: "Add Exercise" }));

    await waitFor(() => {
      expect(api.createExercise).toHaveBeenCalledWith(
        1,
        {
          description: "Dumbbell Press",
          exerciseType: "strength",
          speedUnit: undefined,
          numSets: 3,
          numReps: 12,
          weightDescription: "40 lbs",
          durationMinutes: undefined,
          speedMph: undefined,
          speedKph: undefined,
          notes: "",
        },
        expect.objectContaining({ id: 1 }),
      );
    });
  });

  it("submits metric strength weight when kg unit is selected", async () => {
    const updatedWorkout: WorkoutDetails = {
      ...workoutFixture,
      exercises: [
        ...workoutFixture.exercises,
        {
          id: 16,
          description: "Leg Press",
          exerciseType: "strength",
          numSets: 4,
          numReps: 10,
          weightDescription: "80 kgs",
          durationMinutes: null,
          speedMph: null,
          notes: null,
        },
      ],
    };
    vi.mocked(api.createExercise).mockResolvedValue(updatedWorkout);

    renderPage();

    await screen.findByRole("heading", { name: "Upper Body" });
    await userEvent.clear(screen.getByLabelText("Description"));
    await userEvent.type(screen.getByLabelText("Description"), "Leg Press");
    await userEvent.clear(screen.getByLabelText("Sets"));
    await userEvent.type(screen.getByLabelText("Sets"), "4");
    await userEvent.clear(screen.getByLabelText("Reps"));
    await userEvent.type(screen.getByLabelText("Reps"), "10");
    await userEvent.selectOptions(screen.getByLabelText("Weight Unit"), "kg");
    await userEvent.clear(screen.getByLabelText("Weight"));
    await userEvent.type(screen.getByLabelText("Weight"), "80");
    await userEvent.click(screen.getByRole("button", { name: "Add Exercise" }));

    await waitFor(() => {
      expect(api.createExercise).toHaveBeenCalledWith(
        1,
        {
          description: "Leg Press",
          exerciseType: "strength",
          speedUnit: undefined,
          numSets: 4,
          numReps: 10,
          weightDescription: "80 kgs",
          durationMinutes: undefined,
          speedMph: undefined,
          speedKph: undefined,
          notes: "",
        },
        expect.objectContaining({ id: 1 }),
      );
    });
  });

  it("blocks adding a duplicate exercise description", async () => {
    renderPage();

    await screen.findByRole("heading", { name: "Upper Body" });

    await userEvent.clear(screen.getByLabelText("Description"));
    await userEvent.type(screen.getByLabelText("Description"), "Bench Press");
    await userEvent.click(screen.getByRole("button", { name: "Add Exercise" }));

    expect(
      await screen.findByText("This exercise already exists for the workout."),
    ).toBeInTheDocument();
    expect(api.createExercise).not.toHaveBeenCalled();
  });

  it("deletes the workout and navigates to the list", async () => {
    vi.mocked(api.deleteWorkout).mockResolvedValue(undefined as never);
    render(
      <MemoryRouter
        initialEntries={["/training_log/1/workouts/1"]}
        future={{ v7_startTransition: true, v7_relativeSplatPath: true }}
      >
        <Routes>
          <Route
            path="/training_log/:pageNumber/workouts/:workoutId"
            element={<WorkoutDetailPage />}
          />
          <Route
            path="/training_log/:pageNumber/workouts"
            element={<div>Workout List</div>}
          />
        </Routes>
      </MemoryRouter>,
    );
    await screen.findByRole("heading", { name: "Upper Body" });
    await userEvent.click(
      screen.getByRole("button", { name: "Delete Workout" }),
    );
    await waitFor(() => {
      expect(api.deleteWorkout).toHaveBeenCalledWith(1);
    });
    expect(await screen.findByText("Workout List")).toBeInTheDocument();
  });

  it("shows an error when workout deletion fails", async () => {
    vi.mocked(api.deleteWorkout).mockRejectedValue(new Error("Network error"));
    renderPage();
    await screen.findByRole("heading", { name: "Upper Body" });
    await userEvent.click(
      screen.getByRole("button", { name: "Delete Workout" }),
    );
    expect(await screen.findByText("Network error")).toBeInTheDocument();
  });

  it("populates the exercise form when clicking Edit on an exercise", async () => {
    renderPage();
    await screen.findByRole("heading", { name: "Upper Body" });
    await userEvent.click(screen.getByRole("button", { name: "Edit" }));
    expect(screen.getByLabelText("Description")).toHaveValue("Bench Press");
    expect(
      screen.getByRole("button", { name: "Save Exercise" }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "Cancel Edit" }),
    ).toBeInTheDocument();
  });

  it("resets the exercise form when Cancel Edit is clicked", async () => {
    renderPage();
    await screen.findByRole("heading", { name: "Upper Body" });
    await userEvent.click(screen.getByRole("button", { name: "Edit" }));
    expect(screen.getByLabelText("Description")).toHaveValue("Bench Press");
    await userEvent.click(screen.getByRole("button", { name: "Cancel Edit" }));
    expect(screen.getByLabelText("Description")).toHaveValue("");
    expect(
      screen.getByRole("button", { name: "Add Exercise" }),
    ).toBeInTheDocument();
  });

  it("updates an existing exercise after clicking Edit", async () => {
    const updatedWorkout: WorkoutDetails = {
      ...workoutFixture,
      exercises: [
        { ...workoutFixture.exercises[0], description: "Incline Bench Press" },
      ],
    };
    vi.mocked(api.updateExercise).mockResolvedValue(updatedWorkout);
    renderPage();
    await screen.findByRole("heading", { name: "Upper Body" });
    await userEvent.click(screen.getByRole("button", { name: "Edit" }));
    const descInput = screen.getByLabelText("Description");
    await userEvent.clear(descInput);
    await userEvent.type(descInput, "Incline Bench Press");
    await userEvent.click(
      screen.getByRole("button", { name: "Save Exercise" }),
    );
    await waitFor(() => {
      expect(api.updateExercise).toHaveBeenCalledWith(
        {
          workoutId: 1,
          exerciseId: 11,
          description: "Incline Bench Press",
          exerciseType: "strength",
          speedUnit: undefined,
          numSets: 3,
          numReps: 8,
          weightDescription: "65 lbs",
          durationMinutes: undefined,
          speedMph: undefined,
          speedKph: undefined,
          notes: "",
        },
        expect.objectContaining({ id: 1 }),
      );
    });
    expect(await screen.findByText("Exercise updated.")).toBeInTheDocument();
  });

  it("deletes an exercise from the workout", async () => {
    const updatedWorkout: WorkoutDetails = { ...workoutFixture, exercises: [] };
    vi.mocked(api.deleteExercise).mockResolvedValue(updatedWorkout);
    renderPage();
    await screen.findByRole("heading", { name: "Upper Body" });
    await userEvent.click(screen.getByRole("button", { name: "Delete" }));
    await waitFor(() => {
      expect(api.deleteExercise).toHaveBeenCalledWith(
        1,
        11,
        expect.objectContaining({ id: 1 }),
      );
    });
    expect(await screen.findByText("Exercise deleted.")).toBeInTheDocument();
  });

  it("shows an error when exercise deletion fails", async () => {
    vi.mocked(api.deleteExercise).mockRejectedValue(
      new Error("Unable to delete"),
    );
    renderPage();
    await screen.findByRole("heading", { name: "Upper Body" });
    await userEvent.click(screen.getByRole("button", { name: "Delete" }));
    expect(await screen.findByText("Unable to delete")).toBeInTheDocument();
  });

  it("resets the form when deleting the exercise currently being edited", async () => {
    const updatedWorkout: WorkoutDetails = { ...workoutFixture, exercises: [] };
    vi.mocked(api.deleteExercise).mockResolvedValue(updatedWorkout);
    renderPage();
    await screen.findByRole("heading", { name: "Upper Body" });
    await userEvent.click(screen.getByRole("button", { name: "Edit" }));
    expect(
      screen.getByRole("button", { name: "Save Exercise" }),
    ).toBeInTheDocument();
    await userEvent.click(screen.getByRole("button", { name: "Delete" }));
    await waitFor(() => {
      expect(
        screen.queryByRole("button", { name: "Save Exercise" }),
      ).not.toBeInTheDocument();
    });
    expect(
      screen.getByRole("button", { name: "Add Exercise" }),
    ).toBeInTheDocument();
  });

  it("submits a cardio exercise with duration and speed", async () => {
    const updatedWorkout: WorkoutDetails = {
      ...workoutFixture,
      exercises: [
        ...workoutFixture.exercises,
        {
          id: 12,
          description: "Treadmill",
          exerciseType: "cardio",
          numSets: null,
          numReps: null,
          weightDescription: null,
          durationMinutes: 30,
          speedMph: 6,
          notes: null,
        },
      ],
    };
    vi.mocked(api.createExercise).mockResolvedValue(updatedWorkout);
    renderPage();
    await screen.findByRole("heading", { name: "Upper Body" });
    await userEvent.type(screen.getByLabelText("Description"), "Treadmill");
    await userEvent.selectOptions(
      screen.getByLabelText("Exercise Type"),
      "Cardio",
    );
    await userEvent.type(screen.getByLabelText("Duration (minutes)"), "30");
    await userEvent.type(screen.getByLabelText("Speed (mph)"), "6");
    await userEvent.click(screen.getByRole("button", { name: "Add Exercise" }));
    await waitFor(() => {
      expect(api.createExercise).toHaveBeenCalledWith(
        1,
        {
          description: "Treadmill",
          exerciseType: "cardio",
          speedUnit: "mph",
          numSets: undefined,
          numReps: undefined,
          weightDescription: undefined,
          durationMinutes: 30,
          speedMph: 6,
          speedKph: undefined,
          notes: "",
        },
        expect.objectContaining({ id: 1 }),
      );
    });
    expect(await screen.findByText("Exercise added.")).toBeInTheDocument();
  });

  it("submits a cardio exercise in km/h and sends speedKph", async () => {
    const updatedWorkout: WorkoutDetails = {
      ...workoutFixture,
      exercises: [
        ...workoutFixture.exercises,
        {
          id: 13,
          description: "Bike",
          exerciseType: "cardio",
          numSets: null,
          numReps: null,
          weightDescription: null,
          durationMinutes: 20,
          speedMph: 12.43,
          notes: null,
        },
      ],
    };
    vi.mocked(api.createExercise).mockResolvedValue(updatedWorkout);
    renderPage();
    await screen.findByRole("heading", { name: "Upper Body" });
    await userEvent.type(screen.getByLabelText("Description"), "Bike");
    await userEvent.selectOptions(
      screen.getByLabelText("Exercise Type"),
      "Cardio",
    );
    await userEvent.selectOptions(screen.getByLabelText("Speed Unit"), "km/h");
    await userEvent.type(screen.getByLabelText("Duration (minutes)"), "20");
    await userEvent.type(screen.getByLabelText("Speed (km/h)"), "20");
    await userEvent.click(screen.getByRole("button", { name: "Add Exercise" }));
    await waitFor(() => {
      expect(api.createExercise).toHaveBeenCalledWith(
        1,
        {
          description: "Bike",
          exerciseType: "cardio",
          speedUnit: "kmh",
          numSets: undefined,
          numReps: undefined,
          weightDescription: undefined,
          durationMinutes: 20,
          speedMph: undefined,
          speedKph: 20,
          notes: "",
        },
        expect.objectContaining({ id: 1 }),
      );
    });
  });

  it("shows km/h conversion in cardio exercise display", async () => {
    const cardioWorkout: WorkoutDetails = {
      ...workoutFixture,
      exercises: [
        {
          id: 14,
          description: "Treadmill",
          exerciseType: "cardio",
          numSets: null,
          numReps: null,
          weightDescription: null,
          durationMinutes: 30,
          speedMph: 6,
          notes: null,
        },
      ],
    };
    vi.mocked(api.getWorkout).mockResolvedValue(cardioWorkout);
    renderPage();
    expect(
      await screen.findByText("30 min @ 6 mph (9.7 km/h)"),
    ).toBeInTheDocument();
  });

  it("shows sync state markers for pending workout and exercises", async () => {
    vi.mocked(api.getWorkout).mockResolvedValue({
      ...workoutFixture,
      pendingState: "pending",
      exercises: [
        {
          ...workoutFixture.exercises[0],
          pendingState: "pending",
        },
      ],
    });

    renderPage();

    expect((await screen.findAllByText("Pending sync")).length).toBeGreaterThan(
      1,
    );
  });

  it("shows conflict markers for conflicting workout changes", async () => {
    vi.mocked(api.getWorkout).mockResolvedValue({
      ...workoutFixture,
      pendingState: "conflict",
      exercises: [
        {
          ...workoutFixture.exercises[0],
          pendingState: "conflict",
        },
      ],
    });

    renderPage();

    expect(
      (await screen.findAllByText("Sync conflict")).length,
    ).toBeGreaterThan(1);
  });
});

describe("WorkoutDetailPage — pending mode", () => {
  beforeEach(() => {
    vi.resetAllMocks();
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
  });

  const WorkoutOrSavedPage = (): JSX.Element => {
    const { workoutId } = useParams<{ workoutId: string }>();
    if (workoutId === "pending") return <WorkoutDetailPage />;
    return <div data-testid="saved-workout-page">Saved Workout</div>;
  };

  const renderPendingPage = (): void => {
    render(
      <MemoryRouter
        initialEntries={["/training_log/1/workouts/pending"]}
        future={{ v7_startTransition: true, v7_relativeSplatPath: true }}
      >
        <Routes>
          <Route
            path="/training_log/:pageNumber/workouts/new"
            element={<div>New Workout Page</div>}
          />
          <Route
            path="/training_log/:pageNumber/workouts/:workoutId"
            element={<WorkoutOrSavedPage />}
          />
        </Routes>
      </MemoryRouter>,
    );
  };

  it("redirects to /new when no pending workout is in localStorage", async () => {
    renderPendingPage();
    expect(await screen.findByText("New Workout Page")).toBeInTheDocument();
    expect(api.getWorkout).not.toHaveBeenCalled();
  });

  it("shows workout name and exercise form when localStorage has pending data", async () => {
    localStorage.setItem(
      "trainingLog:pendingWorkout",
      JSON.stringify({ name: "Legs Day", date: "2026-06-01" }),
    );
    renderPendingPage();
    expect(
      await screen.findByRole("heading", { name: "Legs Day" }),
    ).toBeInTheDocument();
    expect(screen.getByLabelText("Description")).toBeInTheDocument();
    expect(api.getWorkout).not.toHaveBeenCalled();
  });

  it("calls createWorkoutWithExercise and navigates to the saved workout on first exercise submit", async () => {
    const savedWorkout: WorkoutDetails = {
      id: 7,
      name: "Legs Day",
      date: "2026-06-01",
      username: "Jane Doe",
      numSets: 0,
      numReps: 0,
      weightDescription: "bodyweight",
      exercises: [
        {
          id: 20,
          description: "Squats",
          exerciseType: "strength",
          numSets: 3,
          numReps: 10,
          weightDescription: "bodyweight",
          durationMinutes: null,
          speedMph: null,
          notes: null,
        },
      ],
    };
    vi.mocked(api.createWorkoutWithExercise).mockResolvedValue(savedWorkout);
    localStorage.setItem(
      "trainingLog:pendingWorkout",
      JSON.stringify({ name: "Legs Day", date: "2026-06-01" }),
    );
    renderPendingPage();

    await screen.findByRole("heading", { name: "Legs Day" });
    await userEvent.type(screen.getByLabelText("Description"), "Squats");
    await userEvent.click(screen.getByRole("button", { name: "Add Exercise" }));

    await waitFor(() => {
      expect(api.createWorkoutWithExercise).toHaveBeenCalledWith(
        { name: "Legs Day", date: "2026-06-01" },
        expect.objectContaining({
          description: "Squats",
          exerciseType: "strength",
        }),
      );
    });

    expect(localStorage.getItem("trainingLog:pendingWorkout")).toBeNull();
    expect(await screen.findByTestId("saved-workout-page")).toBeInTheDocument();
  });
});
