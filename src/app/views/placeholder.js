// Temporary page for sections that are built in later slices (see devpost/checklist.md).

const TITLES = {
  sales: ["Sales & Services", "See which services bring in the most money, how long they take, and plan your prices."],
  costs: ["Costs", "Track and update your monthly costs, and spot any unusual increases."],
  barbers: ["Barbers", "See how each barber is performing, and set their commission."],
  reports: ["Reports", "Import your sales, view detailed reports and track your shop's performance over time."],
  settings: ["Settings", "Manage your shop details, preferences and data."],
};

export function placeholder(view) {
  return {
    title: () => TITLES[view],
    render: () => `<section class="card"><p class="empty-note">This section is being built next. The Dashboard already shows this month's numbers.</p></section>`,
  };
}
