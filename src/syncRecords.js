// Transport-independent sync protocol: used with the same IndexedDB store on Web/Android.
// An old server may reject the additive kinds; never mark those writes as acknowledged.
export function needsProjectMigration(row, error) {
  return (
    ["project", "projectNote"].includes(row.kind) &&
    error?.code === "23514" &&
    /action_records_kind_check/.test([error.message, error.details].join(" "))
  );
}
export async function syncRecords(client, scope, storage) {
  let page = 0;
  const remote = [];
  while (true) {
    const { data, error } = await client
      .from("action_records")
      .select("id,kind,payload,version,deleted")
      .order("id")
      .range(page * 500, page * 500 + 499);
    if (error) throw error;
    remote.push(...data);
    if (data.length < 500) break;
    page++;
  }
  await storage.mergeRemote(remote, scope);
  const pending = (await storage.allRows(scope)).filter(
    (r) => r.dirty && !r.conflict,
  );
  let projectUpgrade = false;
  for (const row of pending) {
    const { data, error } = await client.rpc("save_action_record", {
      p_id: row.id,
      p_kind: row.kind,
      p_payload: row.data,
      p_deleted: row.deleted,
      p_expected: row.version,
    });
    if (error) {
      if (needsProjectMigration(row, error)) {
        projectUpgrade = true;
        continue;
      }
      throw error;
    }
    const result = Array.isArray(data) ? data[0] : data;
    // Invalid responses must not erase dirty state or advance a version.
    if (
      !result?.record ||
      result.record.id !== row.id ||
      !Number.isSafeInteger(Number(result.record.version)) ||
      Number(result.record.version) < 1
    )
      throw new Error("云端返回的记录无效，请稍后重试");
    if (result.conflict) await storage.mergeRemote([result.record], scope);
    else await storage.acknowledge(row, result.record);
  }
  const rows = await storage.allRows(scope);
  return {
    projectUpgrade,
    conflicts: rows.some((r) => r.conflict),
    pending: rows.some((r) => r.dirty),
  };
}
