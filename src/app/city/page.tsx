import type { Metadata } from "next";
import CityViewer from "@/components/city/CityViewer";

export const metadata: Metadata = {
  title: "Low-Poly City",
  description:
    "An interactive low-poly 3D city — orbit, zoom, and switch between light and dark.",
};

// Server Component: renders the client-only WebGL viewer.
export default function CityPage() {
  return <CityViewer />;
}
