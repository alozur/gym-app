import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { v4 as uuidv4 } from "uuid";
import { db, SYNC_STATUS, type DbWorkoutSession, type DbProgram } from "@/db/index";
import { useAuthContext } from "@/context/AuthContext";
import { Button } from "@/components/ui/button";
import { WorkoutSetup } from "./workout/WorkoutSetup";
import { ActiveWorkout } from "./workout/ActiveWorkout";
import { TodayScreen } from "./workout/TodayScreen";
import { getYearWeek } from "./workout/types";
import type { WeekType } from "./workout/types";

export default function Workout() {
  const navigate = useNavigate();
  const { state: authState } = useAuthContext();
  const userId = authState.user?.id ?? "";

  const [session, setSession] = useState<DbWorkoutSession | null>(null);
  const [templateName, setTemplateName] = useState<string | null>(null);
  const [activeProgram, setActiveProgram] = useState<DbProgram | null>(null);
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
          }
          setCheckingActive(false);
          return;
        }

        // Check for active program — scan all and filter since Dexie
        // indexes booleans inconsistently across environments
        const allPrograms = await db.programs.toArray();
        const program = allPrograms.find((p) => p.is_active);

        if (program) {
          setActiveProgram(program);
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
    // Reload active program
    void (async () => {
      try {
        const allPrograms = await db.programs.toArray();
        const program = allPrograms.find((p) => p.is_active);
        setActiveProgram(program ?? null);
      } catch {
        setActiveProgram(null);
      }
    })();
  }

  if (checkingActive) {
    return (
      <div className="min-h-screen bg-background text-foreground">
        <main className="mx-auto max-w-md px-4 py-8">
          <div className="flex items-center justify-center py-16">
            <div className="h-8 w-8 animate-spin rounded-full border-2 border-primary border-t-transparent" />
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
  } else if (activeProgram && !showAdHoc) {
    content = (
      <TodayScreen
        program={activeProgram}
        onStartWorkout={(templateId, weekType, name, programId) =>
          void handleStart(templateId, weekType, name, programId)
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
