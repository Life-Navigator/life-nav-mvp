import { redirect } from 'next/navigation';

// Pilot P0-2: the former Roadmap multi-agent chat returned a hardcoded placeholder reply
// ("This is a placeholder response… implemented soon"). It was an orphan route (no nav link).
// Redirect to the real, validated advisor so a user who reaches this URL never sees a fake chat.
export default function RoadmapChatRedirect() {
  redirect('/dashboard/advisor');
}
