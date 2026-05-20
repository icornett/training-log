# Patterns Discovered

Use this file to record recurring implementation and debugging patterns discovered over time.

## Pattern Template

### Pattern Name
- Context: <where this pattern appears>
- Problem: <what keeps failing or causing friction>
- Solution: <repeatable fix>
- Example: <short code or behavior example>
- Related Files: <file paths>

---

## Example Pattern

### Service Initialization: Empty Array vs Null
- Context: Service or view-model initialization where collections are rendered or iterated.
- Problem: Initializing lists as null causes conditional clutter and runtime errors when code assumes enumerable behavior.
- Solution: Initialize collection properties as empty arrays by default; treat null as exceptional only.
- Example: Use `items = []` instead of `items = nil` so downstream render logic can iterate safely.
- Related Files: workouts.rb, views/workouts.erb

---

Add new patterns below this line as they are discovered.
