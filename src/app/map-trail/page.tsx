import type { Metadata } from "next";
import MapTrail from "./MapTrail";

export const metadata: Metadata = {
  title: "Map Trail",
  description: "A mascot arrow driving a route on a live map.",
};

// Server Component: just renders the client-only animation.
export default function Page() {
  return <MapTrail />;
}
