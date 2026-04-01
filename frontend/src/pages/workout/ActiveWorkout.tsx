import { useState, useEffect, useCallback, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { v4 as uuidv4 } from "uuid";
import {
  db,
  SYNC_STATUS,
  type DbTemplateExercise,
  type DbExercise,
  type DbWorkoutSession,
  type DbExerciseSubstitution,
} from "@/db/index";
import { useAuthContext } from "@/context/AuthContext";
import { api } from "@/api/client";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { ExercisePicker } from "@/components/ExercisePicker";
import { ExerciseCard } from "./ExerciseCard";
import { getYearWeek, parseRepsDisplay } from "./types";
import type {
  ExerciseEntry,
  LastSetInfo,
  SetEntry,
  SubstituteExercise,
} from "./types";

interface ActiveWorkoutProps {
  session: DbWorkoutSession;
  templateName: string | null;
  onFinished?: () => void;
}

// sessionStorage key for draft workout inputs
function draftKey(sessionId: string) {
  return `workout-draft-${sessionId}`;
}

interface DraftSetData {
  setNumber: number;
  weight: string;
  reps: string;
  rpe: string;
}

export function ActiveWorkout({
  session,
  templateName,
  onFinished,
}: ActiveWorkoutProps) {
  const navigate = useNavigate();
  const { state: authState } = useAuthContext();
  const userId = authState.user?.id ?? "";

  const [exercises, setExercises] = useState<ExerciseEntry[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [showExercisePicker, setShowExercisePicker] = useState(false);
  const [isFinishing, setIsFinishing] = useState(false);
  const [unloggedExercises, setUnloggedExercises] = useState<string[]>([]);
  const [showUnloggedDialog, setShowUnloggedDialog] = useState(false);
  const [showCancelDialog, setShowCancelDialog] = useState(false);

  // Elapsed timer
  const [elapsed, setElapsed] = useState(() => {
    const start = new Date(session.started_at).getTime();
    return Math.max(0, Math.floor((Date.now() - start) / 1000));
  });

  useEffect(() => {
    const start = new Date(session.started_at).getTime();
    const id = setInterval(() => {
      setElapsed(Math.max(0, Math.floor((Date.now() - start) / 1000)));
    }, 1000);
    return () => clearInterval(id);
  }, [session.started_at]);

  const elapsedDisplay = useMemo(() => {
    const h = Math.floor(elapsed / 3600);
    const m = Math.floor((elapsed % 3600) / 60);
    const s = elapsed % 60;
    const mm = String(m).padStart(2, "0");
    const ss = String(s).padStart(2, "0");
    return h > 0 ? `${h}:${mm}:${ss}` : `${mm}:${ss}`;
  }, [elapsed]);

  const existingExerciseIds = useMemo(
    () => exercises.map((e) => e.exerciseId),
    [exercises],
  );

  /** Restore already-logged sets from Dexie + draft inputs from sessionStorage */
  async function restoreSessionState(
    entries: ExerciseEntry[],
  ): Promise<ExerciseEntry[]> {
    // 1. Load all logged sets for this session from Dexie
    const loggedSets = await db.workoutSets
      .where("session_id")
      .equals(session.id)
      .toArray();

    const loggedByExercise = new Map<string, typeof loggedSets>();
    for (const s of loggedSets) {
      const arr = loggedByExercise.get(s.exercise_id) ?? [];
      arr.push(s);
      loggedByExercise.set(s.exercise_id, arr);
    }

    // 2. Load draft inputs from sessionStorage
    let draftState: Record<string, DraftSetData[]> = {};
    try {
      const raw = sessionStorage.getItem(draftKey(session.id));
      if (raw) draftState = JSON.parse(raw);
    } catch {
      /* ignore parse errors */
    }

    // 3. Overlay onto entries
    return entries.map((entry) => {
      const logged = loggedByExercise.get(entry.exerciseId) ?? [];
      const drafts = draftState[entry.exerciseId] ?? [];

      // Determine how many sets we need
      const maxLoggedSet =
        logged.length > 0 ? Math.max(...logged.map((s) => s.set_number)) : 0;
      const maxDraftSet =
        drafts.length > 0 ? Math.max(...drafts.map((s) => s.setNumber)) : 0;
      const neededSets = Math.max(
        entry.workingSets.length,
        maxLoggedSet,
        maxDraftSet,
      );

      // Extend workingSets array if needed (e.g. user added extra sets before refresh)
      const workingSets = [...entry.workingSets];
      while (workingSets.length < neededSets) {
        workingSets.push({
          id: uuidv4(),
          setType: "working",
          setNumber: workingSets.length + 1,
          weight: "",
          reps: "",
          rpe: "",
          saved: false,
        });
      }

      // Apply logged sets (from Dexie)
      for (const ls of logged) {
        const idx = workingSets.findIndex((s) => s.setNumber === ls.set_number);
        if (idx !== -1) {
          workingSets[idx] = {
            ...workingSets[idx],
            id: ls.id,
            weight: ls.weight.toString(),
            reps: ls.reps.toString(),
            rpe: ls.rpe != null ? ls.rpe.toString() : "",
            saved: true,
          };
        }
      }

      // Apply draft inputs for unsaved sets (from sessionStorage)
      for (const draft of drafts) {
        const idx = workingSets.findIndex(
          (s) => s.setNumber === draft.setNumber,
        );
        if (idx !== -1 && !workingSets[idx].saved) {
          workingSets[idx] = {
            ...workingSets[idx],
            weight: draft.weight,
            reps: draft.reps,
            rpe: draft.rpe,
          };
        }
      }

      return { ...entry, workingSets };
    });
  }

  async function loadPhasedExercises(cancelled: boolean) {
    // Load sections for this workout
    const sections = await db.phaseWorkoutSections
      .where("workout_id")
      .equals(session.phase_workout_id!)
      .toArray();
    sections.sort((a, b) => a.order - b.order);

    const sectionIds = sections.map((s) => s.id);
    const allPWEs =
      sectionIds.length > 0
        ? await db.phaseWorkoutExercises
            .where("section_id")
            .anyOf(sectionIds)
            .toArray()
        : [];

    // Build section lookup
    const sectionMap = new Map(sections.map((s) => [s.id, s]));

    // Collect all exercise IDs
    const allExIds = [
      ...new Set([
        ...allPWEs.map((e) => e.exercise_id),
        ...(allPWEs
          .map((e) => e.substitute1_exercise_id)
          .filter(Boolean) as string[]),
        ...(allPWEs
          .map((e) => e.substitute2_exercise_id)
          .filter(Boolean) as string[]),
      ]),
    ];
    const exercisesData =
      allExIds.length > 0
        ? await db.exercises.where("id").anyOf(allExIds).toArray()
        : [];
    const exerciseMap = new Map(exercisesData.map((e) => [e.id, e]));

    // Progress for warmup guidance
    const allProgress =
      allExIds.length > 0
        ? await db.exerciseProgress
            .where("exercise_id")
            .anyOf(allExIds)
            .toArray()
        : [];
    const maxWeightMap = new Map<string, number>();
    for (const p of allProgress) {
      const cur = maxWeightMap.get(p.exercise_id) ?? 0;
      if (p.max_weight > cur) maxWeightMap.set(p.exercise_id, p.max_weight);
    }

    // Look up last working sets per exercise across all previous sessions
    const mainExIds = [...new Set(allPWEs.map((e) => e.exercise_id))];
    const lastSetsMap = new Map<string, LastSetInfo[]>();
    if (mainExIds.length > 0) {
      const allPrevSets = await db.workoutSets
        .where("exercise_id")
        .anyOf(mainExIds)
        .and((s) => s.set_type === "working" && s.session_id !== session.id)
        .toArray();
      // Group by exercise_id → session_id → sets
      const byExSession = new Map<string, Map<string, typeof allPrevSets>>();
      for (const s of allPrevSets) {
        let sessions = byExSession.get(s.exercise_id);
        if (!sessions) {
          sessions = new Map();
          byExSession.set(s.exercise_id, sessions);
        }
        let sets = sessions.get(s.session_id);
        if (!sets) {
          sets = [];
          sessions.set(s.session_id, sets);
        }
        sets.push(s);
      }
      // For each exercise, find most recent session with sets
      const sessionCache = new Map<string, string>(); // session_id → started_at
      for (const [exId, sessions] of byExSession) {
        let bestSessionId = "";
        let bestDate = "";
        for (const sid of sessions.keys()) {
          let startedAt = sessionCache.get(sid);
          if (startedAt === undefined) {
            const sess = await db.workoutSessions.get(sid);
            startedAt = sess?.started_at ?? "";
            sessionCache.set(sid, startedAt);
          }
          if (startedAt > bestDate) {
            bestDate = startedAt;
            bestSessionId = sid;
          }
        }
        if (bestSessionId) {
          const sets = sessions.get(bestSessionId)!;
          sets.sort((a, b) => a.set_number - b.set_number);
          lastSetsMap.set(
            exId,
            sets.map((s) => ({
              setNumber: s.set_number,
              weight: s.weight,
              reps: s.reps,
              rpe: s.rpe,
            })),
          );
        }
      }
    }

    // Sort by section order, then exercise order
    const sortedPWEs = allPWEs.sort((a, b) => {
      const sa = sectionMap.get(a.section_id);
      const sb = sectionMap.get(b.section_id);
      const sOrd = (sa?.order ?? 0) - (sb?.order ?? 0);
      return sOrd !== 0 ? sOrd : a.order - b.order;
    });

    const entries: ExerciseEntry[] = sortedPWEs.map((pwe) => {
      const ex = exerciseMap.get(pwe.exercise_id);
      const section = sectionMap.get(pwe.section_id);
      const parsed = parseRepsDisplay(pwe.reps_display);
      const exType = parsed.isTimed
        ? ("timed" as const)
        : (ex?.exercise_type ?? ("reps" as const));

      // Build substitute slides
      const slides: SubstituteExercise[] = [
        {
          id: pwe.exercise_id,
          name: ex?.name ?? "Unknown",
          equipment: ex?.equipment ?? null,
          youtubeUrl: ex?.youtube_url ?? null,
          notes: ex?.notes ?? null,
          exerciseType: exType,
          prescription: null,
          lastMaxWeight: maxWeightMap.get(pwe.exercise_id) ?? null,
        },
      ];

      if (pwe.substitute1_exercise_id) {
        const sub1 = exerciseMap.get(pwe.substitute1_exercise_id);
        if (sub1) {
          slides.push({
            id: sub1.id,
            name: sub1.name,
            equipment: sub1.equipment,
            youtubeUrl: sub1.youtube_url,
            notes: sub1.notes,
            exerciseType: sub1.exercise_type ?? "reps",
            prescription: null,
            lastMaxWeight: maxWeightMap.get(sub1.id) ?? null,
          });
        }
      }
      if (pwe.substitute2_exercise_id) {
        const sub2 = exerciseMap.get(pwe.substitute2_exercise_id);
        if (sub2) {
          slides.push({
            id: sub2.id,
            name: sub2.name,
            equipment: sub2.equipment,
            youtubeUrl: sub2.youtube_url,
            notes: sub2.notes,
            exerciseType: sub2.exercise_type ?? "reps",
            prescription: null,
            lastMaxWeight: maxWeightMap.get(sub2.id) ?? null,
          });
        }
      }

      const prevExSets = lastSetsMap.get(pwe.exercise_id) ?? [];
      const workingSets: SetEntry[] = Array.from(
        { length: pwe.working_sets },
        (_, i) => ({
          id: uuidv4(),
          setType: "working" as const,
          setNumber: i + 1,
          weight: prevExSets[i]?.weight?.toString() ?? "",
          reps: "",
          rpe: "",
          saved: false,
        }),
      );

      return {
        prescriptionId: pwe.id,
        exerciseId: pwe.exercise_id,
        exerciseName: ex?.name ?? "Unknown Exercise",
        equipment: ex?.equipment ?? null,
        youtubeUrl: ex?.youtube_url ?? null,
        exerciseNotes: pwe.notes ?? ex?.notes ?? null,
        exerciseType: exType,
        prescription: null,
        lastMaxWeight: maxWeightMap.get(pwe.exercise_id) ?? null,
        warmupCount: pwe.warmup_sets,
        workingSets,
        lastSets: prevExSets,
        substitutions: [],
        substituteExercises: slides,
        sectionName: section?.name,
        sectionNotes: section?.notes ?? undefined,
        repsDisplay: pwe.reps_display,
        isEachSide: parsed.isEachSide,
        restPeriod: pwe.rest_period,
      };
    });

    if (!cancelled) {
      const restored = await restoreSessionState(entries);
      setExercises(restored);
      setIsLoading(false);
    }
  }

  // Load template exercises or phased exercises or empty for ad-hoc
  useEffect(() => {
    let cancelled = false;

    async function load() {
      // Phased program path
      if (session.phase_workout_id) {
        await loadPhasedExercises(cancelled);
        return;
      }

      if (!session.template_id) {
        setIsLoading(false);
        return;
      }

      // Load ALL template exercises for this template + week type
      const allTEs = await db.templateExercises
        .where("template_id")
        .equals(session.template_id)
        .and((te) => te.week_type === session.week_type)
        .sortBy("order");

      // Separate main (no parent) from substitute TEs
      const mainTEs = allTEs.filter((te) => !te.parent_exercise_id);
      const subTEs = allTEs.filter((te) => !!te.parent_exercise_id);

      // Group substitute TEs by parent_exercise_id
      const subsByParent = new Map<string, DbTemplateExercise[]>();
      for (const te of subTEs) {
        const arr = subsByParent.get(te.parent_exercise_id!) ?? [];
        arr.push(te);
        subsByParent.set(te.parent_exercise_id!, arr);
      }

      // Collect all exercise IDs we need to look up
      const allExerciseIds = [...new Set(allTEs.map((te) => te.exercise_id))];
      const exercisesData = await db.exercises
        .where("id")
        .anyOf(allExerciseIds)
        .toArray();
      const exerciseMap = new Map(exercisesData.map((e) => [e.id, e]));

      // Look up last max weights for warmup guidance
      const allProgress = await db.exerciseProgress
        .where("exercise_id")
        .anyOf(allExerciseIds)
        .toArray();
      const maxWeightMap = new Map<string, number>();
      for (const p of allProgress) {
        const current = maxWeightMap.get(p.exercise_id) ?? 0;
        if (p.max_weight > current) {
          maxWeightMap.set(p.exercise_id, p.max_weight);
        }
      }

      // For fallback: load old exerciseSubstitutions
      const mainExerciseIds = mainTEs.map((te) => te.exercise_id);
      const allOldSubs = await db.exerciseSubstitutions
        .where("exercise_id")
        .anyOf(mainExerciseIds)
        .toArray();
      const oldSubsMap = new Map<string, DbExerciseSubstitution[]>();
      for (const s of allOldSubs) {
        const arr = oldSubsMap.get(s.exercise_id) ?? [];
        arr.push(s);
        oldSubsMap.set(s.exercise_id, arr);
      }

      // Eagerly fetch exercise data for old-format substitutes
      const oldSubExIds = [
        ...new Set(allOldSubs.map((s) => s.substitute_exercise_id)),
      ];
      const oldSubExData =
        oldSubExIds.length > 0
          ? await db.exercises.where("id").anyOf(oldSubExIds).toArray()
          : [];
      const oldSubExMap = new Map(oldSubExData.map((e) => [e.id, e]));

      // Look up last session's working sets for each exercise
      const lastSetsMap = new Map<string, LastSetInfo[]>();
      const prevSessions = await db.workoutSessions
        .where("template_id")
        .equals(session.template_id!)
        .and((s) => s.id !== session.id && s.finished_at !== null)
        .toArray();
      // Sort descending by started_at to find the most recent
      prevSessions.sort((a, b) => b.started_at.localeCompare(a.started_at));
      const lastSession = prevSessions[0];
      if (lastSession) {
        const prevSets = await db.workoutSets
          .where("session_id")
          .equals(lastSession.id)
          .and((s) => s.set_type === "working")
          .toArray();
        for (const s of prevSets) {
          const arr = lastSetsMap.get(s.exercise_id) ?? [];
          arr.push({
            setNumber: s.set_number,
            weight: s.weight,
            reps: s.reps,
            rpe: s.rpe,
          });
          lastSetsMap.set(s.exercise_id, arr);
        }
        // Sort each exercise's sets by set number
        for (const arr of lastSetsMap.values()) {
          arr.sort((a, b) => a.setNumber - b.setNumber);
        }
      }

      const entries: ExerciseEntry[] = mainTEs.map((te) => {
        const ex = exerciseMap.get(te.exercise_id);

        // Build substitute slides from new-format TEs
        const childTEs = subsByParent.get(te.id) ?? [];
        let substituteSlides: SubstituteExercise[];

        if (childTEs.length > 0) {
          // New format: each child TE carries its own prescription
          substituteSlides = childTEs.map((childTE) => {
            const subEx = exerciseMap.get(childTE.exercise_id);
            return {
              id: childTE.exercise_id,
              name: subEx?.name ?? "Unknown",
              equipment: subEx?.equipment ?? null,
              youtubeUrl: subEx?.youtube_url ?? null,
              notes: subEx?.notes ?? null,
              exerciseType: subEx?.exercise_type ?? "reps",
              prescription: childTE,
              lastMaxWeight: maxWeightMap.get(childTE.exercise_id) ?? null,
            };
          });
        } else {
          // Fallback: old exerciseSubstitutions (no per-sub prescription)
          const oldSubs = oldSubsMap.get(te.exercise_id) ?? [];
          substituteSlides = oldSubs.map((s) => {
            const subEx = oldSubExMap.get(s.substitute_exercise_id);
            return {
              id: s.substitute_exercise_id,
              name: subEx?.name ?? "Unknown",
              equipment: subEx?.equipment ?? null,
              youtubeUrl: subEx?.youtube_url ?? null,
              notes: subEx?.notes ?? null,
              exerciseType: subEx?.exercise_type ?? "reps",
              prescription: null,
              lastMaxWeight: maxWeightMap.get(s.substitute_exercise_id) ?? null,
            };
          });
        }

        const exType = ex?.exercise_type ?? "reps";
        const prevExSets = lastSetsMap.get(te.exercise_id) ?? [];
        const workingSets: SetEntry[] = Array.from(
          { length: te.working_sets },
          (_, i) => ({
            id: uuidv4(),
            setType: "working" as const,
            setNumber: i + 1,
            weight: prevExSets[i]?.weight?.toString() ?? "",
            reps: "",
            rpe: "",
            saved: false,
          }),
        );

        return {
          prescriptionId: te.id,
          exerciseId: te.exercise_id,
          exerciseName: ex?.name ?? "Unknown Exercise",
          equipment: ex?.equipment ?? null,
          youtubeUrl: ex?.youtube_url ?? null,
          exerciseNotes: ex?.notes ?? null,
          exerciseType: exType,
          prescription: te,
          lastMaxWeight: maxWeightMap.get(te.exercise_id) ?? null,
          warmupCount: te.warmup_sets,
          workingSets,
          lastSets: prevExSets,
          substitutions: oldSubsMap.get(te.exercise_id) ?? [],
          substituteExercises: [
            {
              id: te.exercise_id,
              name: ex?.name ?? "Unknown Exercise",
              equipment: ex?.equipment ?? null,
              youtubeUrl: ex?.youtube_url ?? null,
              notes: ex?.notes ?? null,
              exerciseType: exType,
              prescription: te,
              lastMaxWeight: maxWeightMap.get(te.exercise_id) ?? null,
            },
            ...substituteSlides,
          ],
        };
      });

      if (!cancelled) {
        const restored = await restoreSessionState(entries);
        setExercises(restored);
        setIsLoading(false);
      }
    }

    void load();
    return () => {
      cancelled = true;
    };
  }, [session.template_id, session.week_type, session.phase_workout_id]);

  // Persist unsaved set inputs to sessionStorage on every change
  useEffect(() => {
    if (exercises.length === 0) return;
    const state: Record<string, DraftSetData[]> = {};
    for (const entry of exercises) {
      const unsaved = entry.workingSets
        .filter((s) => !s.saved)
        .map((s) => ({
          setNumber: s.setNumber,
          weight: s.weight,
          reps: s.reps,
          rpe: s.rpe,
        }));
      if (unsaved.length > 0) {
        state[entry.exerciseId] = unsaved;
      }
    }
    sessionStorage.setItem(draftKey(session.id), JSON.stringify(state));
  }, [exercises, session.id]);

  const handleUpdateSets = useCallback(
    (exerciseId: string, _setType: "working", sets: SetEntry[]) => {
      setExercises((prev) =>
        prev.map((e) => {
          if (e.exerciseId !== exerciseId) return e;
          return { ...e, workingSets: sets };
        }),
      );
    },
    [],
  );

  const handleSubstitute = useCallback(
    async (oldExerciseId: string, newExercise: SubstituteExercise) => {
      // Look up last sets for the new exercise
      const prevSets = await db.workoutSets
        .where("exercise_id")
        .equals(newExercise.id)
        .and((s) => s.set_type === "working" && s.session_id !== session.id)
        .toArray();
      let newLastSets: LastSetInfo[] = [];
      if (prevSets.length > 0) {
        // Group by session, find most recent
        const bySession = new Map<string, typeof prevSets>();
        for (const s of prevSets) {
          let arr = bySession.get(s.session_id);
          if (!arr) {
            arr = [];
            bySession.set(s.session_id, arr);
          }
          arr.push(s);
        }
        let bestId = "";
        let bestDate = "";
        for (const sid of bySession.keys()) {
          const sess = await db.workoutSessions.get(sid);
          const d = sess?.started_at ?? "";
          if (d > bestDate) {
            bestDate = d;
            bestId = sid;
          }
        }
        if (bestId) {
          const sets = bySession.get(bestId)!;
          sets.sort((a, b) => a.set_number - b.set_number);
          newLastSets = sets.map((s) => ({
            setNumber: s.set_number,
            weight: s.weight,
            reps: s.reps,
            rpe: s.rpe,
          }));
        }
      }

      setExercises((prev) =>
        prev.map((e) => {
          if (e.exerciseId !== oldExerciseId) return e;

          const newRx = newExercise.prescription;
          const newWarmup = newRx?.warmup_sets ?? e.warmupCount;
          const newSetCount = newRx?.working_sets ?? e.workingSets.length;

          // Regenerate working sets if count changed, otherwise just reset saved flags
          let workingSets: SetEntry[];
          if (newSetCount !== e.workingSets.length) {
            workingSets = Array.from({ length: newSetCount }, (_, i) => ({
              id: uuidv4(),
              setType: "working" as const,
              setNumber: i + 1,
              weight: newLastSets[i]?.weight?.toString() ?? "",
              reps: "",
              rpe: "",
              saved: false,
            }));
          } else {
            workingSets = e.workingSets.map((s, i) => ({
              ...s,
              saved: false,
              weight: newLastSets[i]?.weight?.toString() ?? "",
              reps: "",
              rpe: "",
            }));
          }

          return {
            ...e,
            exerciseId: newExercise.id,
            exerciseName: newExercise.name,
            equipment: newExercise.equipment,
            youtubeUrl: newExercise.youtubeUrl,
            exerciseNotes: newExercise.notes,
            exerciseType: newExercise.exerciseType,
            prescription: newRx ?? e.prescription,
            lastMaxWeight: newExercise.lastMaxWeight,
            warmupCount: newWarmup,
            workingSets,
            lastSets: newLastSets,
          };
        }),
      );
    },
    [session.id],
  );

  async function handleAddExercise(ex: DbExercise) {
    // Look up last max weight for warmup guidance
    const progressRecords = await db.exerciseProgress
      .where("exercise_id")
      .equals(ex.id)
      .toArray();
    const lastMaxWeight =
      progressRecords.length > 0
        ? Math.max(...progressRecords.map((p) => p.max_weight))
        : null;

    const exType = ex.exercise_type ?? "reps";
    const newEntry: ExerciseEntry = {
      prescriptionId: null,
      exerciseId: ex.id,
      exerciseName: ex.name,
      equipment: ex.equipment,
      youtubeUrl: ex.youtube_url,
      exerciseNotes: ex.notes,
      exerciseType: exType,
      prescription: null,
      lastMaxWeight,
      warmupCount: lastMaxWeight ? 2 : 0,
      workingSets: [
        {
          id: uuidv4(),
          setType: "working",
          setNumber: 1,
          weight: "",
          reps: "",
          rpe: "",
          saved: false,
        },
      ],
      substitutions: [],
      lastSets: [],
      substituteExercises: [
        {
          id: ex.id,
          name: ex.name,
          equipment: ex.equipment,
          youtubeUrl: ex.youtube_url,
          notes: ex.notes,
          exerciseType: exType,
          prescription: null,
          lastMaxWeight,
        },
      ],
    };
    setExercises((prev) => [...prev, newEntry]);
    setShowExercisePicker(false);
  }

  function handleAddWorkingSet(exerciseId: string) {
    setExercises((prev) =>
      prev.map((e) => {
        if (e.exerciseId !== exerciseId) return e;
        const newSet: SetEntry = {
          id: uuidv4(),
          setType: "working",
          setNumber: e.workingSets.length + 1,
          weight: "",
          reps: "",
          rpe: "",
          saved: false,
        };
        return { ...e, workingSets: [...e.workingSets, newSet] };
      }),
    );
  }

  function handleRemoveWorkingSet(exerciseId: string) {
    setExercises((prev) =>
      prev.map((e) => {
        if (e.exerciseId !== exerciseId) return e;
        if (e.workingSets.length <= 1) return e;
        const sets = e.workingSets.slice(0, -1);
        return { ...e, workingSets: sets };
      }),
    );
  }

  function handleRemoveWorkingSetAt(exerciseId: string, index: number) {
    setExercises((prev) =>
      prev.map((e) => {
        if (e.exerciseId !== exerciseId) return e;
        if (e.workingSets.length <= 1) return e;
        const sets = e.workingSets
          .filter((_, i) => i !== index)
          .map((s, i) => ({ ...s, setNumber: i + 1 }));
        return { ...e, workingSets: sets };
      }),
    );
  }

  async function handleCancelWorkout() {
    // Delete all sets for this session, then delete the session itself
    await db.workoutSets.where("session_id").equals(session.id).delete();
    await db.workoutSessions.delete(session.id);
    sessionStorage.removeItem(draftKey(session.id));
    setShowCancelDialog(false);
    if (onFinished) {
      onFinished();
    } else {
      navigate("/", { replace: true });
    }
  }

  /** Auto-log any unsaved sets that have valid weight+reps filled in. */
  async function autoLogUnsavedSets() {
    for (const entry of exercises) {
      const unsaved = entry.workingSets.filter((s) => {
        if (s.saved) return false;
        const w = parseFloat(s.weight || "0");
        const r = parseInt(s.reps, 10);
        return !isNaN(w) && w >= 0 && !isNaN(r) && r > 0;
      });

      for (const s of unsaved) {
        const record: import("@/db/index").DbWorkoutSet = {
          id: s.id,
          session_id: session.id,
          exercise_id: entry.exerciseId,
          set_type: "working",
          set_number: s.setNumber,
          reps: parseInt(s.reps, 10),
          weight: parseFloat(s.weight || "0"),
          rpe: s.rpe ? parseFloat(s.rpe) : null,
          notes: null,
          created_at: new Date().toISOString(),
          sync_status: SYNC_STATUS.pending,
        };
        await db.workoutSets.put(record);
      }

      // Mark them saved in state
      if (unsaved.length > 0) {
        const savedIds = new Set(unsaved.map((s) => s.id));
        const updated = entry.workingSets.map((s) =>
          savedIds.has(s.id) ? { ...s, saved: true } : s,
        );
        setExercises((prev) =>
          prev.map((e) =>
            e.exerciseId === entry.exerciseId
              ? { ...e, workingSets: updated }
              : e,
          ),
        );
      }
    }
  }

  /** Check which exercises have zero loggable data. */
  function getEmptyExerciseNames(): string[] {
    return exercises
      .filter((entry) => {
        const hasAnySaved = entry.workingSets.some((s) => s.saved);
        const hasAnyFilled = entry.workingSets.some((s) => {
          const w = parseFloat(s.weight || "0");
          const r = parseInt(s.reps, 10);
          return !isNaN(w) && w >= 0 && !isNaN(r) && r > 0;
        });
        return !hasAnySaved && !hasAnyFilled;
      })
      .map((e) => e.exerciseName);
  }

  async function handleFinishWorkout(skipWarning = false) {
    // Auto-log any filled but unsaved sets first
    await autoLogUnsavedSets();

    // Check for completely empty exercises
    if (!skipWarning) {
      const empty = getEmptyExerciseNames();
      if (empty.length > 0) {
        setUnloggedExercises(empty);
        setShowUnloggedDialog(true);
        return;
      }
    }

    setIsFinishing(true);
    sessionStorage.removeItem(draftKey(session.id));
    const finishedAt = new Date().toISOString();

    await db.workoutSessions.update(session.id, {
      finished_at: finishedAt,
      sync_status: SYNC_STATUS.pending,
    });

    // Calculate and save exercise_progress
    for (const entry of exercises) {
      const workingSets = await db.workoutSets
        .where("session_id")
        .equals(session.id)
        .and(
          (s) => s.exercise_id === entry.exerciseId && s.set_type === "working",
        )
        .toArray();

      if (workingSets.length === 0) continue;

      const maxWeight = Math.max(...workingSets.map((s) => s.weight));
      const yearWeek = session.year_week ?? getYearWeek(new Date());

      // Check for existing progress record
      const existing = await db.exerciseProgress
        .where("[user_id+exercise_id+year_week]")
        .equals([userId, entry.exerciseId, yearWeek])
        .first();

      const progressRecord = {
        id: existing?.id ?? uuidv4(),
        user_id: userId,
        exercise_id: entry.exerciseId,
        year_week: yearWeek,
        max_weight: existing
          ? Math.max(existing.max_weight, maxWeight)
          : maxWeight,
        created_at: existing?.created_at ?? new Date().toISOString(),
        sync_status: SYNC_STATUS.pending,
      };

      await db.exerciseProgress.put(progressRecord);
    }

    // Advance user program enrollment if this session is linked to one
    if (session.user_program_id) {
      const enrollment = await db.userPrograms.get(session.user_program_id);
      if (enrollment) {
        const program = await db.programs.get(enrollment.program_id);

        if (program?.program_type === "phased") {
          // Phased advancement
          const phases = await db.programPhases
            .where("program_id")
            .equals(program.id)
            .toArray();
          phases.sort((a, b) => a.order - b.order);

          const currentPhase =
            phases[enrollment.current_phase_index % phases.length];

          const phaseWorkoutDays = currentPhase
            ? await db.phaseWorkouts
                .where("phase_id")
                .equals(currentPhase.id)
                .toArray()
            : [];
          const daysPerWeek =
            new Set(phaseWorkoutDays.map((w) => w.day_index)).size || 1;

          let newDay = enrollment.current_day_index + 1;
          let newWeek = enrollment.current_week_in_phase;
          let newPhase = enrollment.current_phase_index;
          let newStartedAt = enrollment.started_at;

          if (newDay >= daysPerWeek) {
            newDay = 0;
            newWeek += 1;
            if (currentPhase && newWeek >= currentPhase.duration_weeks) {
              newWeek = 0;
              newPhase += 1;
              if (newPhase >= phases.length) {
                newPhase = 0;
                newStartedAt = finishedAt;
              }
            }
          }

          await db.userPrograms.update(enrollment.id, {
            current_day_index: newDay,
            current_week_in_phase: newWeek,
            current_phase_index: newPhase,
            started_at: newStartedAt,
            last_workout_at: finishedAt,
            sync_status: SYNC_STATUS.pending,
          });

          if (navigator.onLine) {
            try {
              await api.post(`/programs/${program.id}/advance-phased`);
            } catch {
              // Will sync later
            }
          }
        } else if (program) {
          // Rotating advancement — determine which routine was actually completed
          const routines = await db.programRoutines
            .where("program_id")
            .equals(program.id)
            .toArray();
          routines.sort((a, b) => a.order - b.order);
          const routineCount = routines.length;

          // Find the routine index that was just completed by matching template_id
          const completedIdx = session.template_id
            ? routines.findIndex((r) => r.template_id === session.template_id)
            : -1;

          let newIndex: number;
          let newWeeksCompleted = enrollment.weeks_completed;

          if (
            completedIdx >= 0 &&
            completedIdx >= enrollment.current_routine_index
          ) {
            // User completed a routine at or ahead of current — advance past it
            newIndex = completedIdx + 1;
          } else {
            // User redid an earlier routine or couldn't determine — just advance by 1
            newIndex = enrollment.current_routine_index + 1;
          }

          if (newIndex >= routineCount) {
            newIndex = 0;
            newWeeksCompleted = enrollment.weeks_completed + 1;
          }

          await db.userPrograms.update(enrollment.id, {
            current_routine_index: newIndex,
            weeks_completed: newWeeksCompleted,
            last_workout_at: finishedAt,
            sync_status: SYNC_STATUS.pending,
          });

          if (navigator.onLine) {
            try {
              await api.post(`/programs/${program.id}/advance`);
            } catch {
              // Will sync later
            }
          }
        }
      }
    }

    setIsFinishing(false);
    if (onFinished) {
      onFinished();
    } else {
      navigate("/", { replace: true });
    }
  }

  if (isLoading) {
    return (
      <div className="flex flex-col gap-4 py-4">
        {[1, 2, 3].map((n) => (
          <div
            key={n}
            className="rounded-xl border border-border p-4 flex flex-col gap-3"
          >
            <div className="h-5 w-40 rounded bg-muted animate-pulse" />
            <div className="flex gap-2">
              <div className="h-4 w-20 rounded-full bg-muted animate-pulse" />
              <div className="h-4 w-16 rounded-full bg-muted animate-pulse" />
            </div>
            <div className="flex flex-col gap-2 mt-1">
              {[1, 2, 3].map((s) => (
                <div key={s} className="flex gap-2">
                  <div className="h-[44px] w-6 rounded bg-muted animate-pulse" />
                  <div className="h-[44px] flex-1 rounded bg-muted animate-pulse" />
                  <div className="h-[44px] flex-1 rounded bg-muted animate-pulse" />
                </div>
              ))}
            </div>
            <div className="h-[44px] w-full rounded bg-muted animate-pulse" />
          </div>
        ))}
      </div>
    );
  }

  const totalSets = exercises.reduce((sum, e) => sum + e.workingSets.length, 0);
  const savedSets = exercises.reduce(
    (sum, e) => sum + e.workingSets.filter((s) => s.saved).length,
    0,
  );
  const progressPct =
    totalSets > 0 ? Math.round((savedSets / totalSets) * 100) : 0;

  return (
    <div className="flex flex-col gap-4">
      {/* Fixed header: timer + progress */}
      <div className="fixed top-0 left-0 right-0 z-40 bg-background border-b border-border px-4 py-2 flex flex-col gap-1.5">
        <div className="flex items-center justify-center">
          <span className="font-mono text-lg font-semibold tabular-nums tracking-wider">
            {elapsedDisplay}
          </span>
        </div>
        <div className="relative h-5 rounded-full bg-muted overflow-hidden">
          <div
            className="h-full rounded-full bg-primary transition-all duration-300"
            style={{ width: `${progressPct}%` }}
          />
          <span className="absolute inset-0 flex items-center justify-center text-xs font-semibold tabular-nums mix-blend-difference text-white">
            {progressPct}%
          </span>
        </div>
      </div>

      {/* Spacer for fixed header */}
      <div className="h-16" />

      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-bold">
            {templateName ?? "Ad-hoc Workout"}
          </h1>
          <p className="text-sm text-muted-foreground">
            {session.week_type === "deload" ? "Deload" : "Normal"} Week
            {session.year_week && ` - ${session.year_week}`}
          </p>
        </div>
        <Button
          variant="ghost"
          size="sm"
          className="text-muted-foreground"
          onClick={() => setShowCancelDialog(true)}
          type="button"
        >
          Cancel
        </Button>
      </div>

      {(() => {
        // Group exercises by section if they have section names (phased)
        const hasSections = exercises.some((e) => e.sectionName);
        if (hasSections) {
          const groups: {
            name: string;
            notes?: string;
            entries: ExerciseEntry[];
          }[] = [];
          for (const entry of exercises) {
            const sName = entry.sectionName ?? "Exercises";
            const last = groups[groups.length - 1];
            if (last && last.name === sName) {
              last.entries.push(entry);
            } else {
              groups.push({
                name: sName,
                notes: entry.sectionNotes,
                entries: [entry],
              });
            }
          }
          return groups.map((group, idx) => (
            <div key={group.name} className="flex flex-col gap-3">
              {idx > 0 && <hr className="border-border my-1" />}
              <div className="mt-1">
                <h2 className="text-lg font-semibold">{group.name}</h2>
                {group.notes && (
                  <p className="text-xs text-muted-foreground">{group.notes}</p>
                )}
              </div>
              {group.entries.map((entry) => (
                <ExerciseCard
                  key={entry.prescriptionId ?? entry.exerciseId}
                  entry={entry}
                  sessionId={session.id}
                  onUpdateSets={handleUpdateSets}
                  onSubstitute={handleSubstitute}
                  onAddSet={() => handleAddWorkingSet(entry.exerciseId)}
                  onRemoveSet={() => handleRemoveWorkingSet(entry.exerciseId)}
                  onRemoveSetAt={(i) =>
                    handleRemoveWorkingSetAt(entry.exerciseId, i)
                  }
                />
              ))}
            </div>
          ));
        }

        return exercises.map((entry) => (
          <ExerciseCard
            key={entry.prescriptionId ?? entry.exerciseId}
            entry={entry}
            sessionId={session.id}
            onUpdateSets={handleUpdateSets}
            onSubstitute={handleSubstitute}
            onAddSet={() => handleAddWorkingSet(entry.exerciseId)}
            onRemoveSet={() => handleRemoveWorkingSet(entry.exerciseId)}
            onRemoveSetAt={(i) => handleRemoveWorkingSetAt(entry.exerciseId, i)}
          />
        ));
      })()}

      {/* Ad-hoc: add exercise button */}
      {!session.template_id && (
        <Button
          variant="outline"
          className="min-h-[48px]"
          onClick={() => setShowExercisePicker(true)}
          type="button"
        >
          + Add Exercise
        </Button>
      )}

      {/* Finish Workout */}
      <Button
        className="w-full min-h-[48px] text-base font-semibold mt-4"
        onClick={() => void handleFinishWorkout()}
        disabled={isFinishing}
        type="button"
      >
        {isFinishing ? "Finishing..." : "Finish Workout"}
      </Button>

      {/* Exercise picker for ad-hoc */}
      <Dialog
        open={showExercisePicker}
        onOpenChange={(v) => !v && setShowExercisePicker(false)}
      >
        <DialogContent className="max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Add Exercise</DialogTitle>
          </DialogHeader>
          <ExercisePicker
            onSelect={handleAddExercise}
            excludeIds={existingExerciseIds}
          />
        </DialogContent>
      </Dialog>

      {/* Cancel workout confirmation */}
      <Dialog
        open={showCancelDialog}
        onOpenChange={(v) => !v && setShowCancelDialog(false)}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Cancel workout?</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-muted-foreground">
            This will discard all logged sets for this session. This cannot be
            undone.
          </p>
          <div className="flex gap-2 mt-4">
            <Button
              variant="outline"
              className="flex-1 min-h-[44px]"
              onClick={() => setShowCancelDialog(false)}
            >
              Keep Going
            </Button>
            <Button
              variant="destructive"
              className="flex-1 min-h-[44px]"
              onClick={() => void handleCancelWorkout()}
            >
              Discard Workout
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Unlogged exercises warning */}
      <Dialog
        open={showUnloggedDialog}
        onOpenChange={(v) => !v && setShowUnloggedDialog(false)}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Exercises not logged</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-muted-foreground mb-2">
            The following exercises have no data recorded:
          </p>
          <ul className="list-disc pl-5 text-sm space-y-1">
            {unloggedExercises.map((name) => (
              <li key={name}>{name}</li>
            ))}
          </ul>
          <div className="flex gap-2 mt-4">
            <Button
              variant="outline"
              className="flex-1 min-h-[44px]"
              onClick={() => setShowUnloggedDialog(false)}
            >
              Go Back
            </Button>
            <Button
              variant="destructive"
              className="flex-1 min-h-[44px]"
              onClick={() => {
                setShowUnloggedDialog(false);
                void handleFinishWorkout(true);
              }}
            >
              Finish Anyway
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
