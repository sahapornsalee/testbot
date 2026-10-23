import { render } from "@testing-library/react";
import { App } from "../app/App";

export function renderApp(hash = "#/") {
  window.location.hash = hash;
  return render(<App />);
}
