import Link from "next/link";
import { isSupabaseConfigured } from "@/lib/env";
import { Alert } from "@/components/ui";

export const metadata = { title: "Setup required" };

export default function SetupPage() {
  const configured = isSupabaseConfigured();
  return (
    <>
      <h1 className="text-3xl font-semibold">{configured ? "Backend connected" : "Backend not connected"}</h1>
      <div className="mt-4 space-y-4 text-sm text-mute">
        {configured ? (
          <Alert kind="success">Supabase is configured. You can sign in now.</Alert>
        ) : (
          <>
            <Alert kind="warn" title="This deployment has no Supabase project configured">
              Set <code>NEXT_PUBLIC_SUPABASE_URL</code> and <code>NEXT_PUBLIC_SUPABASE_ANON_KEY</code> in the environment, apply the SQL in{" "}
              <code>supabase/migrations</code>, and restart.
            </Alert>
            <p>The marketing pages work without a backend. Authentication and the workspace need Supabase.</p>
          </>
        )}
        <Link href={configured ? "/signin" : "/"} className="link">
          {configured ? "Sign in" : "Back to the website"}
        </Link>
      </div>
    </>
  );
}
