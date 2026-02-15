import { useState, useEffect } from "react";
import { db, type DbWorkoutTemplate } from "@/db/index";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardContent,
} from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import type { WeekType } from "./types";

interface WorkoutSetupProps {
  onStart: (
    templateId: string | null,
    weekType: WeekType,
    templateName: string | null
  ) => void;
}

export function WorkoutSetup({ onStart }: WorkoutSetupProps) {
  const [templates, setTemplates] = useState<DbWorkoutTemplate[]>([]);
  const [selectedTemplateId, setSelectedTemplateId] = useState<string>("adhoc");
  const [weekType, setWeekType] = useState<WeekType>("normal");
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    void db.workoutTemplates.toArray().then((t) => {
      setTemplates(t);
      setIsLoading(false);
    });
  }, []);

  function handleStart() {
    const isAdhoc = selectedTemplateId === "adhoc";
    const template = templates.find((t) => t.id === selectedTemplateId);
    onStart(
      isAdhoc ? null : selectedTemplateId,
      weekType,
      template?.name ?? null
    );
  }

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-16">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-primary border-t-transparent" />
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-6">
      <h1 className="text-2xl font-bold">Start Workout</h1>

      <Card>
        <CardHeader>
          <CardTitle>Template</CardTitle>
          <CardDescription>
            Pick a template or start an ad-hoc workout
          </CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-4">
          <Select
            value={selectedTemplateId}
            onValueChange={setSelectedTemplateId}
          >
            <SelectTrigger className="min-h-[44px] w-full">
              <SelectValue placeholder="Select template" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="adhoc">Ad-hoc (no template)</SelectItem>
              {templates.map((t) => (
                <SelectItem key={t.id} value={t.id}>
                  {t.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          <div className="flex flex-col gap-2">
            <p className="text-sm font-medium">Week Type</p>
            <div className="flex gap-2">
              <Button
                variant={weekType === "normal" ? "default" : "outline"}
                className="flex-1 min-h-[44px]"
                onClick={() => setWeekType("normal")}
                type="button"
              >
                Normal
              </Button>
              <Button
                variant={weekType === "deload" ? "default" : "outline"}
                className="flex-1 min-h-[44px]"
                onClick={() => setWeekType("deload")}
                type="button"
              >
                Deload
              </Button>
            </div>
          </div>

          <Button
            className="min-h-[48px] text-base font-semibold"
            onClick={handleStart}
          >
            Start Workout
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
