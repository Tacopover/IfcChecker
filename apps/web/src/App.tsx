import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, NavLink, Route, Routes } from "react-router-dom";
import { UploadPage } from "./routes/UploadPage";
import { RuleSetsPage } from "./routes/RuleSetsPage";
import { RunHistoryPage } from "./routes/RunHistoryPage";
import { RunDetailPage } from "./routes/RunDetailPage";

const queryClient = new QueryClient();

export function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <BrowserRouter>
        <nav>
          <NavLink to="/" end>
            Upload
          </NavLink>{" "}
          <NavLink to="/rule-sets">Rule Sets</NavLink>{" "}
          <NavLink to="/runs">Run History</NavLink>
        </nav>
        <Routes>
          <Route path="/" element={<UploadPage />} />
          <Route path="/rule-sets" element={<RuleSetsPage />} />
          <Route path="/runs" element={<RunHistoryPage />} />
          <Route path="/runs/:runId" element={<RunDetailPage />} />
        </Routes>
      </BrowserRouter>
    </QueryClientProvider>
  );
}
