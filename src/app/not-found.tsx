import type { Metadata } from "next";
import CityNotFound from "@/components/city/CityNotFound";

export const metadata: Metadata = {
  title: "404 · Page Not Found",
  description: "The page you are looking for does not exist.",
};

// Root not-found handles any unmatched URL across the app.
export default function NotFound() {
  return <CityNotFound />;
}
