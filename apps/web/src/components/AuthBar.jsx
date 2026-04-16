import { useUser, UserButton } from "@clerk/clerk-react";
import { clerkEnabled } from "../hooks/useAuthFetch";

export default function AuthBar({ onSignOut }) {
  if (!clerkEnabled) return null;

  const { isSignedIn } = useUser();

  if (isSignedIn) {
    return (
      <div className="auth-bar">
        <UserButton />
      </div>
    );
  }

  return (
    <div className="auth-bar">
      <button className="btn-ghost" onClick={onSignOut}>
        Sign in
      </button>
    </div>
  );
}
