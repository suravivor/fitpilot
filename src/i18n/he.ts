// Hebrew is the default, first-class locale (spec §1). Keep every
// user-facing string here rather than inline, so language is swappable
// from Settings without touching component code.
const he = {
  appName: "FitPilot",
  tagline: "המאמן האישי החכם שלך",

  // Auth
  login: "התחברות",
  signup: "הרשמה",
  email: "אימייל",
  password: "סיסמה",
  loginCta: "התחבר",
  signupCta: "צור חשבון",
  noAccount: "אין לך חשבון?",
  haveAccount: "כבר יש לך חשבון?",
  logout: "התנתקות",
  authError: "אימייל או סיסמה שגויים",
  emailTaken: "כתובת האימייל הזו כבר רשומה",

  // Onboarding
  onboardingWelcome: "בוא נכיר אותך קצת",
  onboardingWelcomeSub: "כמה שאלות קצרות כדי שנוכל להתחיל לעזור לך היום",
  goalQuestion: "מה המטרה המרכזית שלך?",
  goalWeightLoss: "ירידה במשקל",
  goalMuscleGain: "עלייה במסת שריר",
  goalRecomposition: "הרזיה + בניית שריר (Recomp)",
  goalMaintenance: "שמירה על המצב הנוכחי",
  currentWeight: "משקל נוכחי (ק\"ג)",
  targetWeight: "משקל יעד (ק\"ג)",
  height: "גובה (ס\"מ)",
  age: "גיל",
  trackingDepthQuestion: "כמה פירוט אתה רוצה מ-FitPilot?",
  trackingMinimal: "מינימלי",
  trackingMinimalDesc: "רק מה שחיוני, כמה שפחות הקלדה",
  trackingBalanced: "מאוזן",
  trackingBalancedDesc: "מעקב שימושי בלי עומס מיותר (מומלץ)",
  trackingDetailed: "מפורט",
  trackingDetailedDesc: "מדידות מלאות ואנליטיקה מעמיקה",
  continueBtn: "המשך",
  finishOnboarding: "סיים והתחל",

  // Home dashboard
  whatNow: "מה כדאי לעשות עכשיו?",
  todayStatus: "מצב היום",
  calories: "קלוריות",
  protein: "חלבון",
  carbs: "פחמימות",
  fat: "שומן",
  remaining: "נותרו",
  overTarget: "מעבר למטרה",
  of: "מתוך",
  logMeal: "רשום ארוחה",
  logWeight: "רשום משקל",
  weightTrend: "מגמת משקל",
  sevenDayAvg: "ממוצע 7 ימים",
  weeklyChange: "שינוי שבועי",
  noInsightYet: "עדיין אין תובנה להיום — רשום ארוחה או משקל כדי להתחיל",
  onTrack: "במסלול",
  needsAttention: "דורש תשומת לב",
  offTrack: "לא במסלול",

  // Meal logging
  addFood: "הוסף מאכל",
  foodName: "שם המאכל",
  quantity: "כמות",
  unit: "יחידה",
  grams: "גרם",
  addToMeal: "הוסף לארוחה",
  saveMeal: "שמור ארוחה",
  mealSaved: "הארוחה נשמרה",
  estimatedValue: "ערך משוער",
  confirmedValue: "ערך מאומת",
  breakfast: "בוקר",
  lunch: "צהריים",
  dinner: "ערב",
  snack: "נשנוש",

  // Weight logging
  weightSaved: "המשקל נשמר",
  weightValue: "משקל (ק\"ג)",
  date: "תאריך",

  // Coach
  coachInsight: "תובנת קוד\"ץ",
  approve: "אשר",
  reject: "דחה",
  pendingApproval: "ממתין לאישורך",
  getInsight: "קבל תובנה",
  recommendationLabel: "המלצה",
  whyLabel: "למה",
  recommendationApplied: "השינוי בוצע ונשמר",
  recommendationRejectedNote: "ההמלצה נדחתה — שום דבר לא השתנה",
  dataUsedLabel: "הנתונים ששימשו לתובנה",

  // Tracking depth — surfaced UX
  showMacros: "הצג פירוט מאקרו",
  hideMacros: "הסתר פירוט מאקרו",
  macroBreakdownDetailed: "פילוח קלוריות לפי מאקרו",
  showWeeklyTools: "הצג כלים שבועיים",
  hideWeeklyTools: "הסתר כלים שבועיים",
  measurementHistory: "היסטוריית מדידות",

  // Meal Vision — raw/cooked
  preparation: "הכנה",
  prepRaw: "חי",
  prepCooked: "מבושל",
  prepUnspecified: "לא צוין",

  // Nav
  navHome: "בית",
  navNutrition: "תזונה",
  navWorkout: "אימון",
  navProgress: "התקדמות",
  navCoach: "קוד\"ץ",

  // Generic
  save: "שמור",
  cancel: "ביטול",
  loading: "טוען...",
  error: "שגיאה",
  retry: "נסה שוב",

  // Workout
  navWorkoutFull: "אימון",
  logWorkout: "רשום אימון",
  addSet: "הוסף סט",
  exercise: "תרגיל",
  set: "סט",
  reps: "חזרות",
  weight: "משקל (ק\"ג)",
  rir: "RIR",
  saveWorkout: "שמור אימון",
  workoutSaved: "האימון נשמר",
  lastTime: "בפעם הקודמת",
  noWorkoutsYet: "עדיין לא נרשמו אימונים",
  recentWorkouts: "אימונים אחרונים",

  // Measurements
  waist: "מותניים",
  chest: "חזה",
  arm: "זרוע",
  thigh: "ירך",
  hip: "מותן",
  addMeasurement: "הוסף מדידה",
  measurementSaved: "המדידה נשמרה",

  // Check-in / weekly review
  weeklyCheckIn: "צ'ק-אין שבועי",
  energyLevel: "רמת אנרגיה",
  sleepQuality: "איכות שינה",
  stressLevel: "רמת סטרס",
  hungerLevel: "רמת רעב",
  freeTextFeedback: "הערות חופשיות",
  submitCheckIn: "שלח צ'ק-אין",
  checkInSaved: "הצ'ק-אין נשמר",
  weeklyReview: "סיכום שבועי",
  generateReview: "הפק סיכום שבועי",

  // Meal photo
  photoMeal: "צלם ארוחה",
  takePhoto: "צלם תמונה",
  analyzingPhoto: "מנתח את התמונה...",
  clarificationNeeded: "צריך עזרה קטנה",
  confirmFoods: "אשר את המאכלים",
  noFoodsDetected: "לא זוהו מאכלים",
  addToToday: "הוסף להיום",
  photoAnalysisFailed: "לא הצלחתי לנתח את התמונה. אפשר לנסות שוב או להזין את הארוחה ידנית.",
  photoSaveFailed: "לא הצלחתי לשמור את הארוחה. שום דבר לא נמחק — אפשר לנסות שוב.",
  enterManually: "הזן ידנית",

  // Settings
  settings: "הגדרות",
  language: "שפה",
  hebrew: "עברית",
  english: "English",
  notifications: "התראות",
  proactiveCoaching: "קואצ'ינג פרואקטיבי",
  saveSettings: "שמור הגדרות",
  settingsSaved: "ההגדרות נשמרו",

  // Feedback on AI
  wasThisHelpful: "האם זה היה שימושי?",
  helpful: "שימושי",
  notHelpful: "לא שימושי",

  navSettings: "הגדרות",
};

export default he;
// Same key set as `he`, but typed as `string` for every value so `en.ts`
// (and any other translation) can supply different literal strings without
// TypeScript treating Hebrew text as the "correct" literal type.
export type Dictionary = { [K in keyof typeof he]: string };
