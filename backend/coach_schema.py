# JSON schema for the coach's structured output.
# Keys are camelCase to match the app's zod schema (src/lib/validation.ts) exactly,
# so the Lambda can return the model's JSON verbatim.
COACH_SCHEMA = {
    "type": "object",
    "properties": {
        "coachingNotes": {
            "type": "string",
            "description": "Concise coaching notes for the athlete, under 250 words.",
        },
        "adjustments": {
            "type": "array",
            "description": "Target changes for upcoming sessions. Empty if no changes are warranted.",
            "items": {
                "type": "object",
                "properties": {
                    "dayId": {"type": "string"},
                    "exerciseId": {"type": "string"},
                    "changes": {
                        "type": "object",
                        "properties": {
                            "targetWeightKg": {"type": "number"},
                            "targetSets": {"type": "integer"},
                            "repRangeMin": {"type": "integer"},
                            "repRangeMax": {"type": "integer"},
                            "targetRpe": {"type": "number"},
                        },
                        "additionalProperties": False,
                    },
                    "reason": {
                        "type": "string",
                        "description": "One-line rationale grounded in the logged data.",
                    },
                },
                "required": ["dayId", "exerciseId", "changes", "reason"],
                "additionalProperties": False,
            },
        },
    },
    "required": ["coachingNotes", "adjustments"],
    "additionalProperties": False,
}
