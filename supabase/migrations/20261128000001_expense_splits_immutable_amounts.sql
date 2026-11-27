-- Additive migration: prevent any role (debtor, creditor, admin, service_role)
-- from mutating immutable identity or amount columns on public.expense_splits.

CREATE OR REPLACE FUNCTION public.prevent_expense_splits_immutable_update()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.expense_id IS DISTINCT FROM OLD.expense_id
     OR NEW.user_id IS DISTINCT FROM OLD.user_id
     OR NEW.amount_owed IS DISTINCT FROM OLD.amount_owed
     OR NEW.amount_owed_paise IS DISTINCT FROM OLD.amount_owed_paise
  THEN
    RAISE EXCEPTION 'Immutable columns (expense_id, user_id, amount_owed, amount_owed_paise) on expense_splits cannot be modified'
      USING ERRCODE = '42501';
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_expense_splits_immutable_columns ON public.expense_splits;
CREATE TRIGGER trg_expense_splits_immutable_columns
  BEFORE UPDATE ON public.expense_splits
  FOR EACH ROW
  EXECUTE FUNCTION public.prevent_expense_splits_immutable_update();
