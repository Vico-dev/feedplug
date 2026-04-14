async function assertTableExists(prisma, tableName, migrationLabel) {
  const rows = await prisma.$queryRawUnsafe(`
    SELECT table_name
    FROM information_schema.tables
    WHERE table_schema = 'public'
      AND table_name = $1::text
    LIMIT 1
  `, tableName);
  if (!rows?.length) {
    throw new Error(`Migration ${migrationLabel} non appliquée: table "${tableName}" introuvable.`);
  }
}

async function assertColumnsExist(prisma, tableName, columns, migrationLabel) {
  const normalizedColumns = Array.isArray(columns)
    ? columns.map((column) => String(column || '').trim()).filter(Boolean)
    : [];
  if (!normalizedColumns.length) return;

  const rows = await prisma.$queryRawUnsafe(`
    SELECT column_name
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = $1::text
  `, tableName);
  const available = new Set((rows || []).map((row) => row.column_name));
  const missing = normalizedColumns.filter((column) => !available.has(column));
  if (missing.length > 0) {
    throw new Error(`Migration ${migrationLabel} non appliquée: colonnes manquantes sur "${tableName}" (${missing.join(', ')}).`);
  }
}

module.exports = {
  assertColumnsExist,
  assertTableExists,
};
