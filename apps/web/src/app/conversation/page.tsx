import { redirect } from 'next/navigation';

// Pilot P0-2: the former /conversation surface ran a client-side SCRIPTED discovery engine
// (no LLM, random question templates, client-computed "confidence" scores) and competed with the
// real advisor — persona-activated users couldn't even pass its prerequisite wall. Redirect to the
// canonical, backend-validated advisor so users only ever experience one real discovery chat.
export default function ConversationRedirect() {
  redirect('/dashboard/advisor');
}
