const OPTIONS = ["report", "summary", "both"];

export default function ViewToggle({ view, onViewChange }) {
  return (
    <div className="view-toggle">
      {OPTIONS.map((option) => (
        <button
          key={option}
          className={`view-toggle-btn${view === option ? " view-toggle-btn--active" : ""}`}
          onClick={() => onViewChange(option)}
        >
          {option.charAt(0).toUpperCase() + option.slice(1)}
        </button>
      ))}
    </div>
  );
}
