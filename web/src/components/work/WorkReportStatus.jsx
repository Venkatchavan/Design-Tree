export default function WorkReportStatus({query}) {
  if(query.isLoading) return <p role="status">Loading logged work…</p>;
  if(query.isError) return <p role="alert">{query.error.message} <button type="button" className="approve-btn" onClick={()=>query.refetch()}>Retry work report</button></p>;
  return null;
}
