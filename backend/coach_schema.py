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
    "required": ["coachingNotes", "adjustments", "programChanges"],
    "additionalProperties": False,
}

_NEW_EXERCISE_SCHEMA = {
    "type": "object",
    "description": "Full spec for a new or replacement exercise.",
    "properties": {
        "id": {"type": "string", "description": "New unique kebab-case slug, e.g. 'front-squat'"},
        "name": {"type": "string"},
        "targetSets": {"type": "integer"},
        "repRangeMin": {"type": "integer"},
        "repRangeMax": {"type": "integer"},
        "targetRpe": {"type": "number"},
        "restSeconds": {"type": "integer"},
        "targetWeightKg": {"type": "number"},
        "loadIncrementKg": {"type": "number"},
        "progression": {"type": "string", "enum": ["double", "hold", "none"]},
        "notes": {"type": "string", "description": "Cues + why it matters for BJJ"},
    },
    "required": [
        "id",
        "name",
        "targetSets",
        "repRangeMin",
        "repRangeMax",
        "restSeconds",
        "loadIncrementKg",
        "progression",
    ],
    "additionalProperties": False,
}

COACH_SCHEMA["properties"]["programChanges"] = {
    "type": "array",
    "description": (
        "Structural changes: swap a stalling/problematic exercise, add or remove one. "
        "Use sparingly — at most 2-3 per review, only when the logs justify it. "
        "Empty array when the structure is fine."
    ),
    "items": {
        "type": "object",
        "properties": {
            "action": {"type": "string", "enum": ["swap", "add", "remove"]},
            "dayId": {"type": "string"},
            "exerciseId": {
                "type": "string",
                "description": (
                    "For swap/remove: the id of the existing exercise. "
                    "For add: repeat the new exercise's id."
                ),
            },
            "newExercise": _NEW_EXERCISE_SCHEMA,
            "reason": {"type": "string"},
        },
        "required": ["action", "dayId", "exerciseId", "reason"],
        "additionalProperties": False,
    },
}
