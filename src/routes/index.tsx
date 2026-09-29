import { createFileRoute } from "@tanstack/react-router";
import { KolaApp } from "@/components/kola-app";

export const Route = createFileRoute("/")({ component: Home });

function Home() {
  return <KolaApp />;
}
