/*
# [Function Security Update]
This migration updates the `handle_new_user` function to improve security by setting a fixed `search_path`.

## Query Description:
This operation alters the existing `handle_new_user` function. By explicitly setting `search_path = public`, it mitigates a security risk where the function could potentially be manipulated by objects in other schemas. This change does not affect existing data and is considered a safe and recommended best practice.

## Metadata:
- Schema-Category: "Safe"
- Impact-Level: "Low"
- Requires-Backup: false
- Reversible: true

## Structure Details:
- Modifies function: `public.handle_new_user()`

## Security Implications:
- RLS Status: Unchanged
- Policy Changes: No
- Auth Requirements: None
- Fixes Advisory: "Function Search Path Mutable"

## Performance Impact:
- Indexes: None
- Triggers: None
- Estimated Impact: Negligible. This is a security and stability improvement.
*/

ALTER FUNCTION public.handle_new_user()
SET search_path = public;
