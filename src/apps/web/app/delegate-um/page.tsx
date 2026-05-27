import type { Metadata } from "next";
import { DelegateVendorConsole } from "../../components/delegate-um/DelegateVendorConsole";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Delegate UM Vendor Console",
  description: "Delegated pharmacy prior authorization workqueue for completing clinical reviews and determinations."
};

export default function DelegateUmPage() {
  return <DelegateVendorConsole />;
}
