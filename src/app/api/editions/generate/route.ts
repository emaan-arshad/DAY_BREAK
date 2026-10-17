import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { ingestActiveRssSources } from "@/lib/ingest";
import { buildDailyEditionForUser } from "@/lib/edition";

export async function POST() {
  try {
    const supabase = await createClient();
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json(
        { error: "Authentication required to generate an edition." },
        { status: 401 }
      );
    }

    const ingestSummary = await ingestActiveRssSources();
    const buildResult = await buildDailyEditionForUser(user.id, {
      version: 1,
      trigger: "manual",
    });

    return NextResponse.json({
      status: buildResult.status,
      local_date: buildResult.localDate,
      idempotency_key: buildResult.idempotencyKey,
      edition: buildResult.edition,
      snapshot: buildResult.snapshot,
      message: buildResult.message ?? null,
      ingest: {
        sourcesProcessed: ingestSummary.sourcesProcessed,
        totalUpserted: ingestSummary.totalUpserted,
      },
    });
  } catch (err) {
    const message =
      err instanceof Error ? err.message : "Failed to generate today's edition.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
