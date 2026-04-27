# Database Migrations

This folder contains SQL migrations for the Dashlify Supabase database.

## How to apply

1. Open [Supabase Dashboard](https://supabase.com/dashboard) → your project
2. Go to **SQL Editor**
3. Open the migration file (oldest first by date prefix)
4. Copy + paste contents
5. Click **Run**
6. Run the verification query at the bottom of each migration to confirm

## Migrations

| File | Date | Purpose |
|------|------|---------|
| `2026_04_27_add_dataset_id_to_widget.sql` | 2026-04-27 | Adds FK datasetId to Widget table (replaces fragile datasetName lookup) |

## Conventions

- Date prefix `YYYY_MM_DD_` for chronological ordering
- Always include rollback instructions in the file header
- Use `IF EXISTS` / `IF NOT EXISTS` to make migrations idempotent
- Add verification queries at the bottom (commented out)
