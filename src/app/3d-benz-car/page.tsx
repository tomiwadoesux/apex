import type { Metadata } from "next";
import BenzCarShowcase from "@/components/car/BenzCarShowcase";

export const metadata: Metadata = {
  title: "3D Benz Car - Apex Ride",
  description:
    "Scroll-driven tour of the Apex Ride Mercedes: the camera cranes around the car while each service framing rises into place.",
};

export default function BenzCarPage() {
  return <BenzCarShowcase />;
}
