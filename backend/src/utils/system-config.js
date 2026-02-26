export const getSystemConfigValue = (database, key) => {
  if (!database || !key) return null
  const result = database.exec('SELECT config_value FROM system_config WHERE config_key = ? LIMIT 1', [key])
  if (!result[0]?.values?.length) return null
  return String(result[0].values[0][0] ?? '')
}

export const upsertSystemConfigValue = (database, key, value) => {
  if (!database || !key) return { created: false, updated: false }
  const normalizedValue = String(value ?? '')
  const existing = database.exec('SELECT id FROM system_config WHERE config_key = ? LIMIT 1', [key])
  if (existing[0]?.values?.length) {
    database.run(
      `UPDATE system_config SET config_value = ?, updated_at = DATETIME('now', 'localtime') WHERE config_key = ?`,
      [normalizedValue, key]
    )
    return { created: false, updated: true }
  }

  database.run(
    `INSERT INTO system_config (config_key, config_value, updated_at) VALUES (?, ?, DATETIME('now', 'localtime'))`,
    [key, normalizedValue]
  )
  return { created: true, updated: false }
}

