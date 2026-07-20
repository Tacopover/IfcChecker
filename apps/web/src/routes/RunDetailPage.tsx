import { useParams } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { fetchRunStatus, reportDownloadUrl } from "../api/client";

export function RunDetailPage() {
  const { runId } = useParams<{ runId: string }>();

  const statusQuery = useQuery({
    queryKey: ["run-status", runId],
    queryFn: () => fetchRunStatus(runId as string),
    enabled: Boolean(runId),
    refetchInterval: (query) => (query.state.data?.status === "completed" ? false : 2000),
  });

  if (!runId) {
    return <p role="alert">No run id provided.</p>;
  }

  if (statusQuery.isLoading) {
    return <p>Loading run status...</p>;
  }

  if (statusQuery.isError) {
    return <p role="alert">{(statusQuery.error as Error).message}</p>;
  }

  const run = statusQuery.data;
  if (!run) {
    return null;
  }

  const isCompleted = run.status === "completed";

  return (
    <section>
      <h1>Run {run.runId}</h1>
      <p>Status: {run.status}</p>

      <table>
        <caption>File progress</caption>
        <thead>
          <tr>
            <th>File</th>
            <th>Engine</th>
            <th>Status</th>
            <th>Parse time (ms)</th>
            <th>Error</th>
          </tr>
        </thead>
        <tbody>
          {run.fileJobs.map((job) => (
            <tr key={job.id}>
              <td>{job.fileName}</td>
              <td>{job.engine}</td>
              <td>{job.status}</td>
              <td>{job.parseMs ?? "—"}</td>
              <td>{job.errorMessage ?? ""}</td>
            </tr>
          ))}
        </tbody>
      </table>

      {isCompleted && (
        <div>
          <h2>Reports</h2>
          <a href={reportDownloadUrl(run.runId, "pdf")}>Download PDF report</a>{" "}
          <a href={reportDownloadUrl(run.runId, "xlsx")}>Download Excel report</a>
        </div>
      )}
    </section>
  );
}
