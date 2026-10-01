-- Seed a small global exercise library (user_id NULL) covering the
-- standard A/B/C/D split mentioned in the product brief. Not exhaustive —
-- enough to make workout logging usable on day one; users can add more
-- via food/exercise creation endpoints later.

INSERT INTO exercises (id, user_id, name, muscle_groups, equipment, instructions, difficulty) VALUES
('ex_bench_press', NULL, 'לחיצת חזה (Bench Press)', 'chest,triceps,shoulders', 'barbell', 'שכיבה על ספסל, הורדת המוט לחזה ודחיפה למעלה בשליטה.', 'intermediate'),
('ex_incline_db_press', NULL, 'לחיצת חזה בשיפוע (Incline DB Press)', 'chest,shoulders,triceps', 'dumbbell', 'ספסל בזווית 30-45 מעלות, דחיפת המשקולות למעלה.', 'intermediate'),
('ex_pushup', NULL, 'שכיבות סמיכה (Push-up)', 'chest,triceps,shoulders', 'bodyweight', 'גוף ישר, הורדה ועלייה בשליטה.', 'beginner'),
('ex_deadlift', NULL, 'הרמת מתים (Deadlift)', 'back,glutes,hamstrings', 'barbell', 'גב ישר, הרמת המוט מהרצפה בעזרת הרגליים והגב התחתון.', 'advanced'),
('ex_pullup', NULL, 'מתח (Pull-up)', 'back,biceps', 'bodyweight', 'משיכת הגוף למעלה עד שהסנטר עובר את המוט.', 'intermediate'),
('ex_barbell_row', NULL, 'חתירה עם מוט (Barbell Row)', 'back,biceps', 'barbell', 'גוף בהטיה קדימה, משיכת המוט לבטן.', 'intermediate'),
('ex_lat_pulldown', NULL, 'פולי עליון (Lat Pulldown)', 'back,biceps', 'machine', 'משיכת המוט למטה לכיוון החזה העליון.', 'beginner'),
('ex_squat', NULL, 'סקוואט (Squat)', 'quads,glutes,hamstrings', 'barbell', 'ירידה עם גב ישר עד שהירכיים מתחת לברכיים, עלייה בשליטה.', 'intermediate'),
('ex_leg_press', NULL, 'לחיצת רגליים (Leg Press)', 'quads,glutes,hamstrings', 'machine', 'דחיפת המשקל בעזרת הרגליים תוך שמירה על גב צמוד למשענת.', 'beginner'),
('ex_lunge', NULL, 'צעד פיסוח (Lunge)', 'quads,glutes,hamstrings', 'dumbbell', 'צעד קדימה, ירידה עד שהברך האחורית קרובה לרצפה.', 'beginner'),
('ex_overhead_press', NULL, 'לחיצת כתפיים (Overhead Press)', 'shoulders,triceps', 'barbell', 'דחיפת המוט מהכתפיים למעלה עד ידיים ישרות.', 'intermediate'),
('ex_lateral_raise', NULL, 'הרחקת כתפיים (Lateral Raise)', 'shoulders', 'dumbbell', 'הרמת המשקולות לצדדים עד גובה הכתפיים.', 'beginner'),
('ex_bicep_curl', NULL, 'כפיפת מרפק (Bicep Curl)', 'biceps', 'dumbbell', 'כיפוף המרפק תוך שמירה על יציבות הגוף.', 'beginner'),
('ex_tricep_pushdown', NULL, 'פשיטת מרפק בפולי (Tricep Pushdown)', 'triceps', 'machine', 'פשיטת המרפק למטה תוך שמירה על המרפקים צמודים לגוף.', 'beginner'),
('ex_plank', NULL, 'פלאנק (Plank)', 'core', 'bodyweight', 'שמירה על גוף ישר בתנוחת שכיבת סמיכה על המרפקים.', 'beginner');
