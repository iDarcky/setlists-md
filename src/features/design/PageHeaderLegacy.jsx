export default function PageHeader({ title, children }) {
  return (
    <div className="pt-6 pb-4 bg-[var(--ds-background-200)] border-b border-[var(--ds-gray-200)]">
      <div className="a4-container flex items-center justify-between">
        <h1 className="text-heading-24 text-[var(--ds-gray-1000)] m-0">
          {title}
        </h1>
        {children && (
          <div className="flex gap-2 items-center">
            {children}
          </div>
        )}
      </div>
    </div>
  );
}
