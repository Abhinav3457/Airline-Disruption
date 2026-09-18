import { useMemo } from 'react';
import { Clock, MapPin, Plane } from 'lucide-react';

import {
  Badge,
  Card,
  CardBody,
  CardHeader,
  ErrorState,
  Loading,
  bookingStatusTone,
} from '@/components';
import { useApi } from '@/hooks';
import { getBookingsByPnr, getCustomers } from '@/services';
import type { Booking, Customer } from '@/types';
import { formatDate } from '@/utils';

/** A booking leg joined with its holder for the table. */
interface BookingRow {
  booking: Booking;
  customer: Customer;
}

/** Flatten every booking leg for every customer into rows (backend-driven). */
function useBookingRows(): {
  rows: BookingRow[];
  loading: boolean;
  error: Error | null;
  reload: () => void;
} {
  const customers = useApi(() => getCustomers(), 'bookings-customers');

  const rows = useMemo(() => {
    return { rows: [] as BookingRow[], loading: true, error: null as Error | null };
    // eslint-disable-next-line react-hooks/ex-return-type
  }, []); // placeholder replaced below
}

export function BookingsPage() component_placeholder;
