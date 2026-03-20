import { useState, useEffect } from "react";
import { useParams } from "react-router-dom";
import { db } from "@/db/index";
import ProgramBuilder from "./ProgramBuilder";
import PhasedProgramView from "./PhasedProgramView";

export default function ProgramDetail() {
  const { id: programId } = useParams<{ id: string }>();
  const [programType, setProgramType] = useState<"rotating" | "phased" | null>(
    null,
  );
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!programId) {
      setLoading(false);
      return;
    }
    void db.programs.get(programId).then((prog) => {
      setProgramType(prog?.program_type ?? "rotating");
      setLoading(false);
    });
  }, [programId]);

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
      </div>
    );
  }

  if (programType === "phased") {
    return <PhasedProgramView />;
  }

  return <ProgramBuilder />;
}
