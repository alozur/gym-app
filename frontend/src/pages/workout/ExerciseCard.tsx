import { useState, useEffect } from "react";
import { db, SYNC_STATUS, type DbWorkoutSet } from "@/db/index";
import { calculateWarmupSets } from "@/utils/warmup";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardHeader,
  CardTitle,
  CardContent,
} from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { SetRow } from "./SetRow";
import type { ExerciseEntry, SetEntry, SubstituteExercise } from "./types";

interface ExerciseCardProps {
  entry: ExerciseEntry;
  sessionId: string;
  onUpdateSets: (
    exerciseId: string,
    setType: "working",
    sets: SetEntry[]
  ) => void;
  onSubstitute: (
    exerciseId: string,
    newExercise: SubstituteExercise,
  ) => void;
}

export function ExerciseCard({
  entry,
  sessionId,
  onUpdateSets,
  onSubstitute,
}: ExerciseCardProps) {
  const [showNotes, setShowNotes] = useState(false);
  const [notesContent, setNotesContent] = useState<string | null>(null);
  const [noVideoMsg, setNoVideoMsg] = useState(false);
  const [isLogged, setIsLogged] = useState(false);
  const rx = entry.prescription;

  const slides = entry.substituteExercises;
  const hasSubstitutes = slides.length > 1;
  const mainExerciseId = slides[0]?.id;
  const isUsingSubstitute = hasSubstitutes && entry.exerciseId !== mainExerciseId;

  // The currently selected slide (for youtube/notes buttons)
  const activeSlide = slides.find((s) => s.id === entry.exerciseId) ?? slides[0];

  const prescriptionText = rx
    ? `${rx.working_sets}x${rx.min_reps}-${rx.max_reps} @ RPE ${rx.early_set_rpe_min}-${rx.last_set_rpe_max}, Rest: ${rx.rest_period}`
    : null;

  const warmupGuidance = entry.warmupCount > 0
    ? calculateWarmupSets(entry.warmupCount, entry.lastMaxWeight)
    : null;

  // Check if already logged on mount (resuming a session)
  const allSaved = entry.workingSets.length > 0 && entry.workingSets.every((s) => s.saved);
  useEffect(() => {
    if (allSaved) setIsLogged(true);
  }, [allSaved]);

  function handleSetChange(
    index: number,
    field: "weight" | "reps" | "rpe",
    value: string
  ) {
    const sets = [...entry.workingSets];
    sets[index] = { ...sets[index], [field]: value };
    onUpdateSets(entry.exerciseId, "working", sets);
  }

  async function handleLogExercise() {
    const updated = [...entry.workingSets];
    let savedAny = false;

    for (let i = 0; i < updated.length; i++) {
      const s = updated[i];
      if (s.saved) continue;

      const weight = parseFloat(s.weight);
      const reps = parseInt(s.reps, 10);
      const rpe = s.rpe ? parseFloat(s.rpe) : null;

      if (isNaN(weight) || weight <= 0) continue;
      if (isNaN(reps) || reps <= 0) continue;

      const record: DbWorkoutSet = {
        id: s.id,
        session_id: sessionId,
        exercise_id: entry.exerciseId,
        set_type: "working",
        set_number: s.setNumber,
        reps,
        weight,
        rpe,
        notes: null,
        created_at: new Date().toISOString(),
        sync_status: SYNC_STATUS.pending,
      };

      await db.workoutSets.put(record);
      updated[i] = { ...updated[i], saved: true };
      savedAny = true;
    }

    if (savedAny) {
      onUpdateSets(entry.exerciseId, "working", updated);
      setIsLogged(true);
    }
  }

  function handleYoutubeClick(url: string | null) {
    if (url) {
      window.open(url, "_blank", "noopener,noreferrer");
    } else {
      setNoVideoMsg(true);
      setTimeout(() => setNoVideoMsg(false), 2000);
    }
  }

  function handleNotesClick(notes: string | null) {
    if (notes) {
      setNotesContent(notes);
      setShowNotes(true);
    }
  }

  function handleSelectExercise(slide: SubstituteExercise) {
    if (slide.id === entry.exerciseId) return;
    onSubstitute(entry.exerciseId, slide);
  }

  function renderInfoButtons(youtubeUrl: string | null, notes: string | null) {
    return (
      <div className="flex items-center gap-1 shrink-0">
        <button
          type="button"
          onClick={() => handleYoutubeClick(youtubeUrl)}
          className="h-8 w-8 flex items-center justify-center rounded-md hover:bg-muted transition-colors"
          aria-label="Watch video"
        >
          <svg className="h-4 w-4 text-red-500" viewBox="0 0 24 24" fill="currentColor">
            <path d="M8 5v14l11-7z" />
          </svg>
        </button>
        {notes && (
          <button
            type="button"
            onClick={() => handleNotesClick(notes)}
            className="h-8 w-8 flex items-center justify-center rounded-md hover:bg-muted transition-colors"
            aria-label="View notes"
          >
            <svg className="h-4 w-4 text-muted-foreground" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="12" cy="12" r="10" />
              <line x1="12" y1="16" x2="12" y2="12" />
              <line x1="12" y1="8" x2="12.01" y2="8" />
            </svg>
          </button>
        )}
      </div>
    );
  }

  return (
    <>
      <Card className={isLogged ? "border-green-500/40 bg-green-500/5" : undefined}>
        <CardHeader className="pb-2">
          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-2 min-w-0">
              {isLogged && <span className="text-green-600 shrink-0">&#10003;</span>}
              {/* Exercise name + substitute pills */}
              {hasSubstitutes ? (
                <div className="flex flex-wrap gap-1.5">
                  {slides.map((slide, i) => {
                    const isSelected = slide.id === entry.exerciseId;
                    const isSub = i > 0;
                    return (
                      <button
                        key={slide.id}
                        type="button"
                        onClick={() => handleSelectExercise(slide)}
                        className={`rounded-full px-3 py-1 text-sm font-medium transition-colors ${
                          isSelected
                            ? "bg-primary text-primary-foreground"
                            : isSub
                              ? "bg-amber-500/15 text-amber-700 dark:text-amber-400 hover:bg-amber-500/25"
                              : "bg-muted text-muted-foreground hover:bg-muted/80"
                        }`}
                      >
                        {isSub && (
                          <span className="mr-1 text-[10px] font-bold uppercase">SUB</span>
                        )}
                        {slide.name}
                      </button>
                    );
                  })}
                </div>
              ) : (
                <CardTitle className="text-base truncate">{entry.exerciseName}</CardTitle>
              )}
            </div>
            {/* YouTube + Notes buttons for selected exercise */}
            {renderInfoButtons(activeSlide.youtubeUrl, activeSlide.notes)}
          </div>

          {/* Equipment line */}
          {activeSlide.equipment && (
            <p className="text-xs text-muted-foreground">{activeSlide.equipment}</p>
          )}

          {/* Using substitute indicator */}
          {isUsingSubstitute && (
            <p className="text-xs font-medium text-amber-600 dark:text-amber-400 mt-0.5">
              Using substitute for {slides[0].name}
            </p>
          )}

          {/* No video message pill */}
          {noVideoMsg && (
            <span className="inline-block rounded-full bg-muted px-2.5 py-0.5 text-xs text-muted-foreground mt-1">
              No video available
            </span>
          )}

          {prescriptionText && (
            <div className="flex flex-wrap gap-1.5 mt-1">
              <span className="inline-block rounded-full bg-primary/10 px-2.5 py-0.5 text-xs font-medium text-primary">
                {prescriptionText}
              </span>
              {rx?.intensity_technique && (
                <span className="inline-block rounded-full bg-orange-500/10 px-2.5 py-0.5 text-xs font-medium text-orange-600 dark:text-orange-400">
                  {rx.intensity_technique}
                </span>
              )}
            </div>
          )}
        </CardHeader>

        <CardContent className="flex flex-col gap-4">
          {/* Warmup Guidance */}
          {entry.warmupCount > 0 && (
            <div className="flex flex-col gap-1.5">
              <p className="text-sm font-medium">
                Warmup <span className="text-muted-foreground font-normal">({entry.warmupCount} sets)</span>
              </p>
              {warmupGuidance ? (
                <div className="flex flex-col gap-1">
                  {warmupGuidance.map((ws) => (
                    <div
                      key={ws.setNumber}
                      className="flex items-center gap-3 rounded-md bg-muted/50 px-3 py-1.5 text-xs"
                    >
                      <span className="w-4 text-center text-muted-foreground">{ws.setNumber}</span>
                      <span className="font-mono font-medium">{ws.weight} kg</span>
                      <span className="text-muted-foreground">&times; {ws.reps} reps</span>
                      <span className="ml-auto text-muted-foreground">{ws.percentage}%</span>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-xs text-muted-foreground italic">
                  No previous data — warm up as needed
                </p>
              )}
            </div>
          )}

          {/* Working Sets */}
          <div className="flex flex-col gap-2">
            <p className="text-sm font-medium">
              Working Sets
              {rx && (
                <span className="text-muted-foreground font-normal">
                  {" "}({rx.working_sets} sets, {rx.min_reps}-{rx.max_reps} reps)
                </span>
              )}
            </p>
            {entry.workingSets.map((s, i) => (
              <SetRow
                key={s.id}
                entry={s}
                onChange={(field, value) => handleSetChange(i, field, value)}
              />
            ))}
          </div>

          {/* Log Exercise button */}
          <Button
            variant={isLogged ? "secondary" : "default"}
            className="w-full min-h-[44px]"
            onClick={() => void handleLogExercise()}
            type="button"
          >
            {isLogged ? "Logged" : "Log Exercise"}
          </Button>
        </CardContent>
      </Card>

      {/* Notes dialog */}
      <Dialog
        open={showNotes}
        onOpenChange={(v) => !v && setShowNotes(false)}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Exercise Notes</DialogTitle>
            <DialogDescription>{entry.exerciseName}</DialogDescription>
          </DialogHeader>
          <p className="text-sm whitespace-pre-wrap">{notesContent}</p>
        </DialogContent>
      </Dialog>
    </>
  );
}
