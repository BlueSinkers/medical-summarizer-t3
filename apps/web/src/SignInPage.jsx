import { useClerk } from "@clerk/clerk-react";
import "./SignInPage.css";

export default function SignInPage({ onGuestMode }) {
  const { redirectToSignIn } = useClerk();

  function handleSignIn() {
    redirectToSignIn({ redirectUrl: window.location.origin });
  }

  return (
    <div className="signin-shell">
      <div className="signin-card">
        <h1 className="signin-title">Medical Report Summarizer</h1>
        <p className="signin-subtitle">
          Sign in to save your sessions, or continue without an account.
        </p>
        <button className="signin-btn" onClick={handleSignIn}>
          Sign in
        </button>
        <div className="signin-divider">or</div>
        <button className="signin-guest-btn" onClick={onGuestMode}>
          Continue as Guest
        </button>
      </div>
    </div>
  );
}
