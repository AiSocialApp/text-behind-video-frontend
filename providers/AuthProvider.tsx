"use client";

import React from "react";
import { AuthProvider as Provider } from "@/hooks/useAuth";

const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  return <Provider>{children}</Provider>;
};

export default AuthProvider;


