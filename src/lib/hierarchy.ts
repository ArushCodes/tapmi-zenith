import { db as supabase } from "@/lib/backend";
import type { Tables } from "@/integrations/supabase/types";

export type Institution = Tables<"institutions">;
export type School = Tables<"schools">;
export type Programme = Tables<"programmes">;

export const hierarchyQuery = {
  queryKey: ["hierarchy"],
  queryFn: async () => {
    const [inst, schools, programmes] = await Promise.all([
      supabase.from("institutions").select("*").order("name"),
      supabase.from("schools").select("*").order("name"),
      supabase.from("programmes").select("*").order("name"),
    ]);
    if (inst.error) throw inst.error;
    if (schools.error) throw schools.error;
    if (programmes.error) throw programmes.error;
    return {
      institutions: (inst.data ?? []) as Institution[],
      schools: (schools.data ?? []) as School[],
      programmes: (programmes.data ?? []) as Programme[],
    };
  },
};

export function slugify(value: string) {
  return value
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

export type NewBatchInput = {
  institution: { id: string } | { name: string };
  school: { id: string } | { name: string };
  programme: { id: string } | { name: string };
  name: string;
  startYear: number | null;
  endYear: number | null;
};

/** Creates any missing hierarchy levels, then the batch. Admin-only via RLS. */
export async function createBatch(input: NewBatchInput) {
  let institutionId: string;
  if ("id" in input.institution) {
    institutionId = input.institution.id;
  } else {
    const { data, error } = await supabase
      .from("institutions")
      .insert({ name: input.institution.name, slug: slugify(input.institution.name) })
      .select("id")
      .single();
    if (error) throw error;
    institutionId = data.id;
  }

  let schoolId: string;
  if ("id" in input.school) {
    schoolId = input.school.id;
  } else {
    const { data, error } = await supabase
      .from("schools")
      .insert({
        institution_id: institutionId,
        name: input.school.name,
        slug: slugify(`${input.school.name}`),
      })
      .select("id")
      .single();
    if (error) throw error;
    schoolId = data.id;
  }

  let programmeId: string;
  if ("id" in input.programme) {
    programmeId = input.programme.id;
  } else {
    const { data, error } = await supabase
      .from("programmes")
      .insert({
        school_id: schoolId,
        name: input.programme.name,
        slug: slugify(input.programme.name),
      })
      .select("id")
      .single();
    if (error) throw error;
    programmeId = data.id;
  }

  const { data, error } = await supabase
    .from("batches")
    .insert({
      programme_id: programmeId,
      name: input.name,
      slug: slugify(`${input.name}-${input.startYear ?? Date.now()}`),
      start_year: input.startYear,
      end_year: input.endYear,
      is_public: true,
    })
    .select("id")
    .single();
  if (error) throw error;
  return data.id as string;
}
