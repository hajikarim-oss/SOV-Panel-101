-- Updated exec_sql that handles both SELECT and DML statements
-- Run this in Supabase SQL Editor

DROP FUNCTION IF EXISTS exec_sql(text);

CREATE FUNCTION exec_sql(sql TEXT)
RETURNS SETOF JSON
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  result RECORD;
BEGIN
  -- Check if the query starts with SELECT (or WITH for CTEs)
  IF upper(trim(sql)) LIKE 'SELECT%' OR upper(trim(sql)) LIKE 'WITH%' THEN
    FOR result IN EXECUTE sql LOOP
      RETURN NEXT row_to_json(result);
    END LOOP;
  ELSE
    -- DML statements: execute and return empty
    EXECUTE sql;
    RETURN;
  END IF;
END;
$$;

GRANT EXECUTE ON FUNCTION exec_sql(TEXT) TO service_role;
GRANT EXECUTE ON FUNCTION exec_sql(TEXT) TO anon;
GRANT EXECUTE ON FUNCTION exec_sql(TEXT) TO authenticated;
