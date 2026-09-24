import { redirect } from "next/navigation";

/** The Politics tab became Articles; old `/politics?type=&id=` links keep working. */
export default async function PoliticsPage({ searchParams }: PageProps<"/politics">) {
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(await searchParams)) {
    if (typeof value === "string") params.set(key, value);
  }
  const qs = params.toString();
  redirect(qs ? `/articles?${qs}` : "/articles");
}
