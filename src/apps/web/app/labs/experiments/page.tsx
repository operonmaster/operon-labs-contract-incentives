import { redirect } from "next/navigation";

export default function ExperimentsRedirectPage() {
  redirect("/labs/initiatives");
}
