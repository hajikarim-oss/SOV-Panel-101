-- Drop existing function first (can't change return type)
DROP FUNCTION IF EXISTS exec_sql(text);

-- Recreate with SETOF JSON return type
CREATE FUNCTION exec_sql(sql TEXT)
RETURNS SETOF JSON
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  RETURN QUERY EXECUTE sql;
END;
$$;

-- Grant permissions
GRANT EXECUTE ON FUNCTION exec_sql(TEXT) TO service_role;
GRANT EXECUTE ON FUNCTION exec_sql(TEXT) TO anon;
GRANT EXECUTE ON FUNCTION exec_sql(TEXT) TO authenticated;
