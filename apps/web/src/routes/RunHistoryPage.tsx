// ASSUMED endpoint (GET /runs) — see this plan's "Dependency Notes for
// Orchestration" gap flag: sub-plan 04's confirmed contract has no run-list
// route. This page is built against the assumed RunListResponse shape until
// sub-plan 07 resolves the gap with sub-plan 04's owner.
import { useQuery } from "@tanstack/react-query";
import { Link } from "react-router-dom";
import { fetchRunList } from "../api/client";

export function RunHistoryPage() {
  const runsQuery = useQuery({
    queryKey: ["runs"],
    queryFn: fetchRunList,
  });

  if (runsQuery.isLoading) {
    return <p>Loading run history...</p>;
  }

  if (runsQuery.isError) {
    return <p role="alert">{(runsQuery.error as Error).message}</p>;
  }

  const runs = runsQuery.data?.runs ?? [];

  return (
    <section>
      <h1>Run History</h1>
      {runs.length === 0 ? (
        <p>No runs yet.</p>
      ) : (
        <table>
          <thead>
            <tr>
              <th>Run</th>
              <th>Status</th>
              <th>Engine</th>
              <th>Files</th>
              <th>Created</th>
            </tr>
          </thead>
          <tbody>
            {runs.map((run) => (
              <tr key={run.id}>
                <td>
                  <Link to={`/runs/${run.id}`}>{run.id}</Link>
                </td>
                <td>{run.status}</td>
                <td>{run.engine}</td>
                <td>{run.fileCount}</td>
                <td>{new Date(run.createdAt).toLocaleString()}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </section>
  );
}
