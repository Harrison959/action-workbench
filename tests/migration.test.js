import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { PGlite } from "@electric-sql/pglite";
import { KINDS } from "../src/domain.js";

test("Postgres migration retains data, RLS isolation and CAS, and admits new kinds", async () => {
  const pg = new PGlite();
  try {
    await pg.exec(`create role anon; create role authenticated;
      create schema auth; create table auth.users(id uuid primary key);
      create function auth.uid() returns uuid language sql as $$ select nullif(current_setting('test.uid',true),'')::uuid $$;
      grant usage on schema auth to authenticated;
      insert into auth.users values ('00000000-0000-0000-0000-000000000001'),('00000000-0000-0000-0000-000000000002');`);
    const initial = await readFile(
      new URL(
        "../supabase/migrations/202609150001_action.sql",
        import.meta.url,
      ),
      "utf8",
    );
    const migration = await readFile(
      new URL(
        "../supabase/migrations/202610030001_projects.sql",
        import.meta.url,
      ),
      "utf8",
    );
    await pg.exec(initial);
    await pg.exec(
      `set test.uid='00000000-0000-0000-0000-000000000001'; set role authenticated;`,
    );
    const rpc = async (id, kind, payload = {}, version = 0) =>
      (
        await pg.query(
          `select public.save_action_record($1,$2,$3::jsonb,false,$4) as result`,
          [id, kind, JSON.stringify(payload), version],
        )
      ).rows[0].result;
    await rpc("income", "income", { cents: 55678, legacy: true });
    await assert.rejects(
      rpc("p", "project", { title: "项目" }),
      (e) => e.code === "23514",
    );
    await pg.exec("reset role;");
    const before = (await pg.query("select * from public.action_records")).rows;
    await pg.exec(migration);
    await pg.exec(migration);
    assert.deepEqual(
      (await pg.query("select * from public.action_records")).rows,
      before,
    );
    await pg.exec("set role authenticated;");
    for (const kind of KINDS)
      await rpc("type-" + kind, kind, { fixture: true });
    const project = await rpc("p", "project", { title: "复习" });
    assert.equal(project.record.version, 1);
    const conflict = await rpc("p", "project", { title: "旧设备" }, 0);
    assert.equal(conflict.conflict, true);
    assert.equal(conflict.record.payload.title, "复习");
    const next = await rpc("p", "project", { title: "新版" }, 1);
    assert.equal(next.record.version, 2);
    await assert.rejects(
      pg.exec(
        `insert into public.action_records(user_id,id,kind,payload) values(auth.uid(),'direct','project','{}');`,
      ),
      (e) => e.code === "42501",
    );
    await pg.exec(`set test.uid='00000000-0000-0000-0000-000000000002';`);
    assert.equal(
      (await pg.query("select * from public.action_records")).rows.length,
      0,
    );
    await rpc("p", "project", { title: "账号二" });
    assert.equal(
      (await pg.query("select payload from public.action_records")).rows[0]
        .payload.title,
      "账号二",
    );
    await pg.exec("reset role; set role anon;");
    await assert.rejects(
      pg.query("select * from public.action_records"),
      (e) => e.code === "42501",
    );
    await assert.rejects(rpc("p", "project"), (e) => e.code === "42501");
  } finally {
    await pg.close();
  }
});
