export function Loading() {
  return <div className="fixed inset-0 z-100 flex items-center justify-center bg-overlay/40 backdrop-blur-sm">
          {/* Apple style spinner */}
          <svg className="animate-spin h-12 w-12 text-primary" viewBox="0 0 50 50">
            <circle
              className="opacity-20"
              cx="25"
              cy="25"
              r="20"
              stroke="currentColor"
              strokeWidth="5"
              fill="none"
            />
            <path
              className="opacity-80"
              fill="none"
              stroke="currentColor"
              strokeWidth="5"
              strokeLinecap="round"
              d="M25 5
          a 20 20 0 0 1 0 40
          a 20 20 0 0 1 0 -40"
              strokeDasharray="90"
              strokeDashoffset="60"
            />
          </svg>
        </div>;
}
