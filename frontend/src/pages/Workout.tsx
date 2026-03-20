import { useState, useEffect } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { v4 as uuidv4 } from "uuid";
import {
  db,
  SYNC_STATUS,
  type DbWorkoutSession,
  type DbProgram,
  type DbUserProgram,
} from "@/db/index";
import { useAuthContext } from "@/context/AuthContext";
import { Button } from "@/components/ui/button";
import { WorkoutSetup } from "./workout/WorkoutSetup";
import { ActiveWorkout } from "./workout/ActiveWorkout";
import { TodayScreen } from "./workout/TodayScreen";
import { PhasedTodayScreen } from "./workout/PhasedTodayScreen";
import { getYearWeek } from "./workout/types";
import type { WeekType } from "./workout/types";

interface WorkoutOverrides {
  overrideRoutineIndex?: number;
  overrideWeekType?: "normal" | "deload";
  overridePhaseIndex?: number;
  overrideWeekInPhase?: number;
  overrideDayIndex?: number;
}

export default function Workout() {
  const navigate = useNavigate();
  const location = useLocation();
  const { state: authState } = useAuthContext();
  const userId = authState.user?.id ?? "";

  // Capture overrides from Programs page: location.state (legacy) or localStorage
  const [workoutOverrides] = useState<WorkoutOverrides | null>(() => {
    if (location.state) return location.state as WorkoutOverrides;
    try {
      const stored = localStorage.getItem("workout-selection-override");
      if (stored) return JSON.parse(stored) as WorkoutOverrides;
    } catch {
      /* ignore */
    }
    return null;
  });
  useEffect(() => {
    if (location.state) {
      navigate(location.pathname, { replace: true, state: null });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps -- intentional: only clear state on mount
  }, []);

  const [session, setSession] = useState<DbWorkoutSession | null>(null);
  const [templateName, setTemplateName] = useState<string | null>(null);
  const [activeProgram, setActiveProgram] = useState<DbProgram | null>(null);
  const [activeEnrollment, setActiveEnrollment] =
    useState<DbUserProgram | null>(null);
  const [checkingActive, setCheckingActive] = useState(true);
  const [showAdHoc, setShowAdHoc] = useState(false);

  // Check for an active (unfinished) session and active program on mount
  useEffect(() => {
    void (async () => {
      try {
        if (!userId) {
          setCheckingActive(false);
          return;
        }

        // Check for unfinished session first
        const active = await db.workoutSessions
          .where("user_id")
          .equals(userId)
          .and((s) => s.finished_at === null)
          .first();

        if (active) {
          setSession(active);
          if (active.template_id) {
            const template = await db.workoutTemplates.get(active.template_id);
            setTemplateName(template?.name ?? null);
          } else if (active.phase_workout_id) {
            const phaseWorkout = await db.phaseWorkouts.get(
              active.phase_workout_id,
            );
            setTemplateName(phaseWorkout?.name ?? null);
          }
          setCheckingActive(false);
          return;
        }

        // Check for active enrollment
        const allEnrollments = await db.userPrograms
          .where("user_id")
          .equals(userId)
          .toArray();
        const enrollment = allEnrollments.find((e) => e.is_active);

        if (enrollment) {
          const program = await db.programs.get(enrollment.program_id);
          if (program) {
            setActiveProgram(program);
            setActiveEnrollment(enrollment);
          }
        }
      } catch {
        // Dexie query failed — just show setup screen
      } finally {
        setCheckingActive(false);
      }
    })();
  }, [userId]);

  async function handleStart(
    templateId: string | null,
    weekType: WeekType,
    name: string | null,
    programId?: string,
    phaseWorkoutId?: string,
    userProgramId?: string,
  ) {
    const newSession: DbWorkoutSession = {
      id: uuidv4(),
      user_id: userId,
      template_id: templateId,
      year_week: getYearWeek(new Date()),
      week_type: weekType,
      started_at: new Date().toISOString(),
      finished_at: null,
      notes: null,
      program_id: programId ?? null,
      phase_workout_id: phaseWorkoutId ?? null,
      user_program_id: userProgramId ?? null,
      sync_status: SYNC_STATUS.pending,
    };

    await db.workoutSessions.put(newSession);
    setSession(newSession);
    setTemplateName(name);
  }

  function handleWorkoutFinished() {
    setSession(null);
    setTemplateName(null);
    setShowAdHoc(false);
    // Reload active enrollment/program
    void (async () => {
      try {
        const allEnrollments = await db.userPrograms
          .where("user_id")
          .equals(userId)
          .toArray();
        const enrollment = allEnrollments.find((e) => e.is_active);
        if (enrollment) {
          const program = await db.programs.get(enrollment.program_id);
          setActiveProgram(program ?? null);
          setActiveEnrollment(enrollment);
        } else {
          setActiveProgram(null);
          setActiveEnrollment(null);
        }
      } catch {
        setActiveProgram(null);
        setActiveEnrollment(null);
      }
    })();
  }

  if (checkingActive) {
    return (
      <div className="min-h-screen bg-background text-foreground">
        <main className="mx-auto max-w-md px-4 py-8">
          <div className="flex flex-col gap-4">
            <div className="h-8 w-40 rounded bg-muted animate-pulse" />
            <div className="h-10 w-full rounded-lg bg-muted animate-pulse" />
            {[1, 2, 3].map((n) => (
              <div
                key={n}
                className="rounded-lg border border-border p-3 flex flex-col gap-2"
              >
                <div className="h-4 w-32 rounded bg-muted animate-pulse" />
                <div className="h-3 w-48 rounded bg-muted animate-pulse" />
              </div>
            ))}
          </div>
        </main>
      </div>
    );
  }

  // State machine: 1) Active session, 2) Active program, 3) No program / Ad-hoc
  let content: React.ReactNode;

  if (session) {
    content = (
      <ActiveWorkout
        session={session}
        templateName={templateName}
        onFinished={handleWorkoutFinished}
      />
    );
  } else if (activeProgram && activeEnrollment && !showAdHoc) {
    content =
      activeProgram.program_type === "phased" ? (
        <PhasedTodayScreen
          program={activeProgram}
          enrollment={activeEnrollment}
          overridePhaseIndex={workoutOverrides?.overridePhaseIndex}
          overrideWeekInPhase={workoutOverrides?.overrideWeekInPhase}
          overrideDayIndex={workoutOverrides?.overrideDayIndex}
          onStartWorkout={(phaseWorkoutId, programId, workoutName) =>
            void handleStart(
              null,
              "normal",
              workoutName,
              programId,
              phaseWorkoutId,
              activeEnrollment.id,
            )
          }
          onAdHoc={() => setShowAdHoc(true)}
        />
      ) : (
        <TodayScreen
          program={activeProgram}
          enrollment={activeEnrollment}
          overrideRoutineIndex={workoutOverrides?.overrideRoutineIndex}
          overrideWeekType={workoutOverrides?.overrideWeekType}
          onStartWorkout={(templateId, weekType, name, programId) =>
            void handleStart(
              templateId,
              weekType,
              name,
              programId,
              undefined,
              activeEnrollment.id,
            )
          }
          onAdHoc={() => setShowAdHoc(true)}
        />
      );
  } else if (showAdHoc) {
    content = (
      <WorkoutSetup
        onStart={(tid, wt, name) => void handleStart(tid, wt, name)}
      />
    );
  } else {
    // No active program — prompt the user to create one
    content = (
      <div className="flex flex-col items-center gap-6 py-12">
        <div className="text-center">
          <h1 className="text-2xl font-bold mb-2">No Active Program</h1>
          <p className="text-muted-foreground">
            Create a program and activate it to see your daily routine here.
          </p>
        </div>
        <Button
          className="min-h-[48px] w-full max-w-xs text-base font-semibold"
          onClick={() => navigate("/programs")}
        >
          Go to Programs
        </Button>
        <button
          type="button"
          className="text-sm text-muted-foreground underline"
          onClick={() => setShowAdHoc(true)}
        >
          Start an ad-hoc workout instead
        </button>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background text-foreground pb-28">
      <main className="mx-auto max-w-md px-4 py-8">{content}</main>
    </div>
  );
}
