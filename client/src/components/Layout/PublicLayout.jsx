import React, { useEffect } from "react";
import { Outlet } from "react-router-dom";
import Header from "./Header";
import Footer from "./Footer";
import { Button } from "../UI/Button";

export const PublicLayout = () => {
  useEffect(() => {
    // Add public-route class to html tag when public layout is active
    document.documentElement.classList.add("public-route");
    return () => {
      // Clean up class when leaving public layout
      document.documentElement.classList.remove("public-route");
    };
  }, []);

  return (
    <div className="min-h-screen flex flex-col card-bg text-text-primary">
      <Header />

      {/* Main content wrapper */}
      <main className="flex-grow">
        <Outlet />
      </main>

      <Footer />
    </div>
  );
};
