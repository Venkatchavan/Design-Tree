export default function Panel({ title, sub, children }) {
  return (
    <div className="panel">
      {title && (
        <div className="panel-head">
          <div className="panel-title">{title}</div>
          {sub && <div className="page-sub" style={{ marginTop: 2 }}>{sub}</div>}
        </div>
      )}
      <div className="panel-body">{children}</div>
    </div>
  );
}
