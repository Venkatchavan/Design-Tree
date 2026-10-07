export default function Panel({ title, children }) {
  return (
    <div className="panel">
      {title && (
        <div className="panel-head">
          <div className="panel-title">{title}</div>
        </div>
      )}
      <div className="panel-body">{children}</div>
    </div>
  );
}
