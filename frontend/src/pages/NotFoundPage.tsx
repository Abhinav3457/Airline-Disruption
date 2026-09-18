import { Link } from 'react-router-dom';

import { Button } from '@/components';

export function NotFoundPage() {
  return (
    <div className="flex flex-col items-center justify-center gap-4 py-24 text-center">
      <div className="text-5xl font-semibold text-ops-muted">404</div>
      <p className="text-sm text-ops-muted">
        That page doesn't exist in the ops console.
      </p>
      <Link to="/">
        <Button variant="secondary">Back to Dashboard</Button>
      </Link>
    </div>
  );
}
