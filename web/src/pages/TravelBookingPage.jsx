import { useState } from 'react';
import { useLocation } from 'react-router-dom';
import TravelBookingLog from './TravelBookingLog.jsx';
import TravelRequestLog from './TravelRequestLog.jsx';
import { directorRoles } from './travelBookingUtils.js';
export default function TravelBookingPage({ bootstrap, readOnly = false, embedded = false }) {
  const [tab, setTab] = useState('bookings');
  const location = useLocation();
  const role = bootstrap?.role?.key;
  return (
    <div id={embedded ? undefined : "view-travel-booking"}>
      {location.state?.confirmation && (
        <p role="status">{location.state.confirmation}</p>
      )}
      <div className="travel-tabs">
        <button
          onClick={() => setTab('bookings')}
          aria-pressed={tab === 'bookings'}
        >
          Travel & hotel bookings
        </button>
        <button
          onClick={() => setTab('requests')}
          aria-pressed={tab === 'requests'}
        >
          Request log (LA / Cab / Other)
        </button>
      </div>
      {tab === 'bookings' ? (
        <TravelBookingLog readOnly={readOnly || directorRoles.includes(role)} />
      ) : (
        <TravelRequestLog canWrite={!readOnly && role === 'finance'} />
      )}
    </div>
  );
}
