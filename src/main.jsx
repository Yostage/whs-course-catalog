import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import CourseCatalog from "./CourseCatalog";

createRoot(document.getElementById("root")).render(
  <StrictMode>
    <CourseCatalog />
  </StrictMode>
);
