import { redirect } from "next/navigation";

/** New maps are created from the New Map modal on the Maps page. */
export default function NewMapPage() {
  redirect("/maps?new=1");
}
