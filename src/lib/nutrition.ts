// Deterministic nutrition math (spec §54: use normal code for arithmetic,
// not the model). This produces the INITIAL target only; the AI coach may
// later recommend changes, but those always go through the approval gate
// in db.ts (setNutritionTarget is only ever called from server code that
// the user triggered or approved).

export type Sex = "male" | "female" | "other";

export interface BaselineInput {
  weightKg: number;
  heightCm: number;
  age: number;
  sex: Sex;
  goalType: "weight_loss" | "muscle_gain" | "recomposition" | "maintenance";
  activityFactor?: number; // default 1.4 (lightly active) when unknown
}

export interface NutritionPlan {
  calories: number;
  protein: number;
  carbs: number;
  fat: number;
  bmr: number;
  tdee: number;
  rationale: string;
}

// Mifflin-St Jeor — a reasonable, well-documented default. Framed as an
// estimate, never a medical fact (spec §43).
export function calculateBaselinePlan(input: BaselineInput): NutritionPlan {
  const { weightKg, heightCm, age, sex, goalType } = input;
  const activityFactor = input.activityFactor ?? 1.4;

  const sexOffset = sex === "male" ? 5 : sex === "female" ? -161 : -78; // midpoint for 'other'
  const bmr = 10 * weightKg + 6.25 * heightCm - 5 * age + sexOffset;
  const tdee = bmr * activityFactor;

  let calorieAdjustment = 0;
  let proteinPerKg = 1.8;
  let rationale = "";

  switch (goalType) {
    case "weight_loss":
      calorieAdjustment = -Math.min(0.2 * tdee, 600); // cap deficit at ~600 kcal/day
      proteinPerKg = 2.0; // higher protein to protect lean mass in a deficit
      rationale = "Moderate deficit (~15-20% below maintenance) with higher protein to preserve muscle.";
      break;
    case "muscle_gain":
      calorieAdjustment = Math.min(0.12 * tdee, 350);
      proteinPerKg = 1.8;
      rationale = "Small surplus to support muscle growth while limiting fat gain.";
      break;
    case "recomposition":
      calorieAdjustment = -Math.min(0.12 * tdee, 400); // mild deficit
      proteinPerKg = 2.0;
      rationale = "Mild deficit with high protein — favors simultaneous fat loss and muscle retention.";
      break;
    case "maintenance":
    default:
      calorieAdjustment = 0;
      proteinPerKg = 1.6;
      rationale = "Calories set at estimated maintenance.";
  }

  const calories = Math.round(tdee + calorieAdjustment);
  const protein = Math.round(weightKg * proteinPerKg);
  const fat = Math.round((calories * 0.25) / 9); // 25% of calories from fat
  const proteinCals = protein * 4;
  const fatCals = fat * 9;
  const carbs = Math.max(0, Math.round((calories - proteinCals - fatCals) / 4));

  return {
    calories,
    protein,
    carbs,
    fat,
    bmr: Math.round(bmr),
    tdee: Math.round(tdee),
    rationale,
  };
}
