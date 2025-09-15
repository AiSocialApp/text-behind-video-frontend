"use client";

import React from "react";

const AdsPlaceholder: React.FC<{ position?: "top" | "bottom" }> = ({ position = "bottom" }) => {
  return (
    <div
      className={`w-full ${
        position === "top" ? "mt-2" : "mt-4"
      } border border-dashed border-muted-foreground/40 rounded-md p-3 text-sm text-muted-foreground text-center`}
    >
      Advertisement Placeholder
    </div>
  );
};

export default AdsPlaceholder;


