import { useAuthContext } from "@/context/AuthContext";

interface UseUnitPreferenceReturn {
  unit: string;
  displayWeight: (kg: number) => string;
  convertWeight: (value: number, fromUnit: string) => number;
}

const KG_TO_LBS = 2.20462;

export function useUnitPreference(): UseUnitPreferenceReturn {
  const { state } = useAuthContext();
  const unit = state.user?.preferred_unit ?? "kg";

  function displayWeight(kg: number): string {
    if (unit === "lbs") {
      const lbs = Math.round(kg * KG_TO_LBS * 10) / 10;
      return `${lbs} lbs`;
    }
    return `${kg} kg`;
  }

  function convertWeight(value: number, fromUnit: string): number {
    if (fromUnit === "kg" && unit === "lbs") {
      return Math.round(value * KG_TO_LBS * 10) / 10;
    }
    if (fromUnit === "lbs" && unit === "kg") {
      return Math.round((value / KG_TO_LBS) * 10) / 10;
    }
    return value;
  }

  return { unit, displayWeight, convertWeight };
}
