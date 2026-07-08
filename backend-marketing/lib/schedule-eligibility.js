// Décide si un feed planifié doit être exécuté à ce passage du scheduler.
// Deux cadences possibles :
// - scheduleTime "HH:MM" : fenêtre d'exécution d'une heure autour de l'horaire,
//   puis garde lastRunAt pour ne pas ré-exécuter le même jour.
// - pas de scheduleTime : le feed est éligible à chaque passage, la garde
//   lastRunAt (>= 23h) impose seule la cadence quotidienne. Un feed jamais
//   exécuté (lastRunAt null) part immédiatement.
const MIN_HOURS_BETWEEN_RUNS = 23;

function isFeedDueForScheduledRun({ scheduleTime, lastRunAt, now }) {
  const current = now instanceof Date ? now : new Date(now);

  if (scheduleTime) {
    const [scheduledHour, scheduledMinute] = String(scheduleTime).split(':').map(Number);
    if (!Number.isFinite(scheduledHour) || !Number.isFinite(scheduledMinute)) {
      return { due: false, reason: 'scheduleTime invalide' };
    }
    const currentHour = current.getHours();
    const currentMinute = current.getMinutes();
    const inWindow =
      (currentHour === scheduledHour && currentMinute >= scheduledMinute) ||
      (currentHour === scheduledHour + 1 && currentMinute < scheduledMinute);
    if (!inWindow) {
      return { due: false, reason: 'hors fenêtre horaire' };
    }
  }

  if (lastRunAt) {
    const last = lastRunAt instanceof Date ? lastRunAt : new Date(lastRunAt);
    const hoursSinceLastRun = (current - last) / (1000 * 60 * 60);
    if (hoursSinceLastRun < MIN_HOURS_BETWEEN_RUNS) {
      return { due: false, reason: 'déjà exécuté récemment' };
    }
  }

  return { due: true };
}

module.exports = { isFeedDueForScheduledRun, MIN_HOURS_BETWEEN_RUNS };
