-- Migration 011: Add Foreign Key from vehicles.customer_id to customers.id
-- 
-- Context:
--   vehicles.customer_id currently has no Foreign Key constraint.
--   Orphan check completed: 0 orphaned vehicles, 0 NULL customer_ids.
--   Both columns are UUID type.
--
-- This migration:
--   - Adds a named Foreign Key constraint
--   - Preserves all existing data (verified: all customer_ids match existing customers)
--   - Does NOT modify RLS
--   - Does NOT modify application code
--   - Does NOT add ON DELETE CASCADE (parent controls lifecycle)

ALTER TABLE vehicles
  ADD CONSTRAINT fk_vehicles_customer_id
  FOREIGN KEY (customer_id)
  REFERENCES customers(id)
  ON UPDATE CASCADE
  ON DELETE RESTRICT;
