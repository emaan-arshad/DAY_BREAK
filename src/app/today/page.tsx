import { Suspense } from "react";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import {
  computeReaderLocalDate,
  EditionSnapshotSchema,
  type EditionSnapshot,
} from "@/lib/edition/schema";
import { EditionSkeleton } from "@/components/EditionSkeleton";
import { TodayEditionView } from "@/components/TodayEditionView";

async function TodayEditionContent() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  const { data: profile } = await supabase
    .from("profiles")
    .select("timezone, reading_minutes")
    .eq("user_id", user.id)
    .maybeSingle();

  const readerTimezone = profile?.timezone || "UTC";
  const readingMinutesDefault = profile?.reading_minutes || 10;
  const localDate = computeReaderLocalDate(new Date(), readerTimezone);

  const { data: editionRow, error: editionError } = await supabase
    .from("editions")
    .select(
      "id, local_date, version, edition_number, state, content_json, generated_at"
    )
    .eq("user_id", user.id)
    .eq("local_date", localDate)
    .eq("state", "published")
    .order("version", { ascending: false })
    .limit(1)
    .maybeSingle();

  let initialSnapshot: EditionSnapshot | null = null;
  let initialError: string | null = null;

  if (editionError) {
    initialError = `Failed to load today's edition: ${editionError.message}`;
  } else if (editionRow?.content_json) {
    const parsed = EditionSnapshotSchema.safeParse(editionRow.content_json);
    if (parsed.success) {
      initialSnapshot = parsed.data;
    } else {
      initialError = "Stored edition snapshot could not be validated.";
    }
  }

  return (
    <TodayEditionView
      initialSnapshot={initialSnapshot}
      localDate={localDate}
      readerTimezone={readerTimezone}
      readingMinutesDefault={readingMinutesDefault}
      userEmail={user.email ?? null}
      initialError={initialError}
    />
  );
}

export default function TodayPage() {
  return (
    <Suspense fallback={<EditionSkeleton />}>
      <TodayEditionContent />
    </Suspense>
  );
}
