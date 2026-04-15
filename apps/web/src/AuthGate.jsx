import { useUser } from "@clerk/clerk-react";
import { useState } from "react";
import App from "./App.jsx";
import SignInPage from "./SignInPage.jsx";

export default function AuthGate() {
  const { isSignedIn, isLoaded } = useUser();
  const [guestMode, setGuestMode] = useState(
    () => sessionStorage.getItem("guestMode") === "true"
  );

  if (!isLoaded) return null;

  if (isSignedIn || guestMode) {
    return <App onSignOut={() => {
      sessionStorage.removeItem("guestMode");
      setGuestMode(false);
    }} />;
  }

  return <SignInPage onGuestMode={() => {
    sessionStorage.setItem("guestMode", "true");
    setGuestMode(true);
  }} />;
}
