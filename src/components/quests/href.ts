/** "/sessions?campaign=…&view=quests&quest=…": opens that quest on the Sessions page. */
export const questHref = (q: { campaignId: string; id: string }) =>
  `/sessions?campaign=${encodeURIComponent(q.campaignId)}&view=quests&quest=${encodeURIComponent(q.id)}`;
