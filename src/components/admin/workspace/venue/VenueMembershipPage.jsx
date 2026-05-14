import React from 'react';
import MembershipManagementPage from '../venue/MembershipManagementPage.jsx';

export default function VenueMembershipPage({ auth, venue }) {
  return <MembershipManagementPage venueId={venue?.id} />;
}
