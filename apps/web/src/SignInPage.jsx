import { SignIn } from "@clerk/clerk-react";
import "./SignInPage.css";

export default function SignInPage({ onGuestMode }) {
  return (
    <div className="signin-shell">
      <div className="signin-card">
        <h1 className="signin-title">Medical Report Summarizer</h1>
        <p className="signin-subtitle">Sign in to your account</p>
        <SignIn routing="virtual" fallbackRedirectUrl="/" />
        <div className="signin-divider">or</div>
        <button className="signin-guest-btn" onClick={onGuestMode}>
          Continue as Guest
        </button>
      </div>
    </div>
  );
}
