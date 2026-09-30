import { addDays, daysBetween, isoDay, money } from "./format";
import { STALE_DAYS, accountRollup, isOpen, overdueOpportunities, staleOpportunities, type Snapshot } from "./analytics";

export interface GeneratedAction {
  title: string;
  description: string;
  reason: string;
  type: "follow_up" | "review_opportunity" | "address_objection" | "post_call" | "stalled_deal" | "lead_outreach" | "other";
  priority: "high" | "medium" | "low";
  due_date: string;
  source_type: "opportunity" | "lead" | "account" | "conversation";
  source_id: string;
  dedupe_key: string;
  assigned_to: string | null;
}

/**
 * Rule-based action generation. Each action names the record it came from and states the exact
 * condition that triggered it. Dedupe keys make regeneration idempotent: an action that was
 * completed or dismissed is never recreated for the same record and rule.
 */
export function generateActions(snap: Snapshot): GeneratedAction[] {
  const out: GeneratedAction[] = [];
  const due = (days: number) => isoDay(addDays(snap.now, days));

  const openSorted = snap.opportunities.filter(isOpen).sort((a, b) => Number(b.amount) - Number(a.amount));
  const highCut = openSorted.length ? Number(openSorted[Math.floor(openSorted.length / 4)]?.amount ?? 0) : 0;

  for (const s of staleOpportunities(snap)) {
    const o = s.opp;
    out.push({
      title: `Review stalled deal: ${o.name}`,
      description: o.next_step ? `Recorded next step: ${o.next_step}` : "No next step is recorded on this opportunity.",
      reason: `No activity or stage change for ${s.idleDays} days (threshold ${STALE_DAYS}). Stage: ${o.stage.replace("_", " ")}, value ${money(Number(o.amount))}.`,
      type: "stalled_deal",
      priority: Number(o.amount) >= highCut && Number(o.amount) > 0 ? "high" : "medium",
      due_date: due(2),
      source_type: "opportunity",
      source_id: o.id,
      dedupe_key: `stalled:${o.id}`,
      assigned_to: o.owner_id,
    });
  }

  for (const s of overdueOpportunities(snap)) {
    const o = s.opp;
    out.push({
      title: `Update or re-engage: ${o.name} is past its close date`,
      description: "Confirm whether the deal is still live, then move the close date or close it out.",
      reason: `Expected close date ${o.expected_close_date} passed ${s.overdueDays} days ago; still in ${o.stage.replace("_", " ")} at ${money(Number(o.amount))}.`,
      type: "review_opportunity",
      priority: s.overdueDays > 14 ? "high" : "medium",
      due_date: due(1),
      source_type: "opportunity",
      source_id: o.id,
      dedupe_key: `overdue:${o.id}`,
      assigned_to: o.owner_id,
    });
  }

  for (const o of openSorted) {
    if ((o.stage === "proposal" || o.stage === "negotiation") && !o.next_step?.trim()) {
      out.push({
        title: `Define the next step for ${o.name}`,
        description: "Record the agreed next step and date on the opportunity.",
        reason: `Deal is in ${o.stage} (${money(Number(o.amount))}) with no next step recorded.`,
        type: "review_opportunity",
        priority: "medium",
        due_date: due(3),
        source_type: "opportunity",
        source_id: o.id,
        dedupe_key: `nonextstep:${o.id}`,
        assigned_to: o.owner_id,
      });
    }
  }

  for (const l of snap.leads) {
    const age = daysBetween(snap.now, new Date(l.created_at));
    const lastTouch = l.last_contacted_at ? daysBetween(snap.now, new Date(l.last_contacted_at)) : null;
    if (l.status === "new" && lastTouch === null && age >= 3) {
      out.push({
        title: `Make first contact with ${l.full_name}${l.company ? ` (${l.company})` : ""}`,
        description: l.source ? `Lead source: ${l.source}.` : "No lead source recorded.",
        reason: `Lead was created ${age} days ago and has never been contacted.`,
        type: "lead_outreach",
        priority: Number(l.estimated_value ?? 0) >= 10_000 ? "high" : "medium",
        due_date: due(1),
        source_type: "lead",
        source_id: l.id,
        dedupe_key: `firstcontact:${l.id}`,
        assigned_to: l.owner_id,
      });
    } else if (l.status === "qualified" && (lastTouch === null || lastTouch >= 14)) {
      out.push({
        title: `Follow up with qualified lead ${l.full_name}`,
        description: "Qualified lead with no recent contact — move to an opportunity or re-engage.",
        reason: lastTouch === null ? "Qualified but never contacted." : `Qualified; last contacted ${lastTouch} days ago.`,
        type: "follow_up",
        priority: "high",
        due_date: due(2),
        source_type: "lead",
        source_id: l.id,
        dedupe_key: `qualified-quiet:${l.id}`,
        assigned_to: l.owner_id,
      });
    }
  }

  const analysisByConv = new Map(snap.analyses.map((a) => [a.conversation_id, a]));
  for (const c of snap.conversations) {
    const a = analysisByConv.get(c.id);
    if (!a) continue;
    if (a.next_action && daysBetween(snap.now, new Date(c.occurred_at)) <= 30) {
      out.push({
        title: `Follow up after call: ${c.title}`,
        description: a.next_action + (a.commitments?.length ? `\nCommitments made: ${a.commitments.join("; ")}` : ""),
        reason: "Recommended next action from the analysis of this conversation.",
        type: "post_call",
        priority: a.sentiment === "negative" ? "high" : "medium",
        due_date: due(1),
        source_type: "conversation",
        source_id: c.id,
        dedupe_key: `postcall:${c.id}`,
        assigned_to: null,
      });
    }
    if (a.objections?.length && daysBetween(snap.now, new Date(c.occurred_at)) <= 30) {
      out.push({
        title: `Address ${a.objections.length > 1 ? "objections" : "objection"} raised in: ${c.title}`,
        description: a.objections.map((x) => `• ${x}`).join("\n"),
        reason: `${a.objections.length} objection${a.objections.length > 1 ? "s were" : " was"} identified in this conversation.`,
        type: "address_objection",
        priority: "medium",
        due_date: due(3),
        source_type: "conversation",
        source_id: c.id,
        dedupe_key: `objection:${c.id}`,
        assigned_to: null,
      });
    }
  }

  for (const r of accountRollup(snap)) {
    if (
      (r.account.status === "customer" || r.account.status === "at_risk") &&
      (!r.lastActivity || daysBetween(snap.now, new Date(r.lastActivity)) > 30)
    ) {
      out.push({
        title: `Check in with ${r.account.name}`,
        description: "Existing customer with no logged contact in over 30 days.",
        reason: r.lastActivity
          ? `Last logged activity was ${daysBetween(snap.now, new Date(r.lastActivity))} days ago; account status is ${r.account.status.replace("_", " ")}.`
          : `No activity has ever been logged; account status is ${r.account.status.replace("_", " ")}.`,
        type: "follow_up",
        priority: r.account.status === "at_risk" ? "high" : "low",
        due_date: due(5),
        source_type: "account",
        source_id: r.account.id,
        dedupe_key: `quiet-account:${r.account.id}`,
        assigned_to: r.account.owner_id,
      });
    }
  }

  return out;
}
