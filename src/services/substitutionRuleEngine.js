function normalizeSport(value) {
  return String(value || '').trim().toLowerCase();
}

function normalizeName(value) {
  return String(value || '').trim().toLowerCase();
}

const PRESET_BY_SPORT = {
  sepakbola: {
    sport: 'sepakbola',
    mode: 'limited',
    allowReentry: false,
    maxSubstitutionsPerTeam: 5,
    minMinute: 0,
    maxMinute: 120,
    enforcement: 'hard_block',
    enabled: true,
  },
  futsal: {
    sport: 'futsal',
    mode: 'rolling',
    allowReentry: true,
    maxSubstitutionsPerTeam: null,
    minMinute: 0,
    maxMinute: 60,
    enforcement: 'hard_block',
    enabled: true,
  },
  basket: {
    sport: 'basket',
    mode: 'rolling',
    allowReentry: true,
    maxSubstitutionsPerTeam: null,
    minMinute: 0,
    maxMinute: 60,
    enforcement: 'hard_block',
    enabled: true,
  },
  voli: {
    sport: 'voli',
    mode: 'limited',
    allowReentry: false,
    maxSubstitutionsPerTeam: 6,
    minMinute: 0,
    maxMinute: 120,
    enforcement: 'hard_block',
    enabled: true,
  },
  badminton: {
    sport: 'badminton',
    mode: 'disabled',
    allowReentry: false,
    maxSubstitutionsPerTeam: 0,
    minMinute: 0,
    maxMinute: null,
    enforcement: 'hard_block',
    enabled: false,
  },
  tennis: {
    sport: 'tennis',
    mode: 'disabled',
    allowReentry: false,
    maxSubstitutionsPerTeam: 0,
    minMinute: 0,
    maxMinute: null,
    enforcement: 'hard_block',
    enabled: false,
  },
  padel: {
    sport: 'padel',
    mode: 'limited',
    allowReentry: false,
    maxSubstitutionsPerTeam: 2,
    minMinute: 0,
    maxMinute: 120,
    enforcement: 'hard_block',
    enabled: true,
  },
  esports: {
    sport: 'esports',
    mode: 'limited',
    allowReentry: false,
    maxSubstitutionsPerTeam: 2,
    minMinute: 0,
    maxMinute: 120,
    enforcement: 'hard_block',
    enabled: true,
  },
};

const DEFAULT_PRESET = {
  sport: 'generic',
  mode: 'limited',
  allowReentry: false,
  maxSubstitutionsPerTeam: 5,
  minMinute: 0,
  maxMinute: 120,
  enforcement: 'hard_block',
  enabled: true,
};

export function getSubstitutionPresetForSport(sport) {
  const key = normalizeSport(sport);
  return { ...(PRESET_BY_SPORT[key] || DEFAULT_PRESET) };
}

export function mergeSubstitutionRules(baseRules, overrideRules) {
  const base = { ...DEFAULT_PRESET, ...(baseRules || {}) };
  const override = overrideRules && typeof overrideRules === 'object' ? overrideRules : {};

  return {
    ...base,
    ...override,
    allowReentry: override.allowReentry ?? base.allowReentry,
    maxSubstitutionsPerTeam: override.maxSubstitutionsPerTeam ?? base.maxSubstitutionsPerTeam,
    minMinute: override.minMinute ?? base.minMinute,
    maxMinute: override.maxMinute ?? base.maxMinute,
    enforcement: override.enforcement || base.enforcement || 'hard_block',
    enabled: override.enabled ?? base.enabled,
  };
}

export function getTournamentSubstitutionRules(tournament) {
  const preset = getSubstitutionPresetForSport(tournament?.sport);
  const override = tournament?.substitution_rules || tournament?.substitutionRules || null;
  return mergeSubstitutionRules(preset, override);
}

export function buildSubstitutionState({ players = [], lineups = [], events = [] }) {
  const stateByName = {};

  (players || []).forEach((player) => {
    const key = normalizeName(player?.player_name || player?.jersey_name || player?.name || `player-${player?.id}`);
    if (!key) return;
    stateByName[key] = {
      onField: false,
      hasPlayed: false,
    };
  });

  (lineups || []).forEach((entry) => {
    if (!entry?.starting_eleven) return;
    const player = (players || []).find((item) => String(item.id) === String(entry.player_id));
    const key = normalizeName(player?.player_name || player?.jersey_name || player?.name || `player-${entry.player_id}`);
    if (!key) return;
    if (!stateByName[key]) stateByName[key] = { onField: false, hasPlayed: false };
    stateByName[key].onField = true;
    stateByName[key].hasPlayed = true;
  });

  const teamSubInCount = {};
  (events || []).forEach((event) => {
    const team = String(event?.team || '').trim() || 'unknown';
    const key = normalizeName(event?.player_name || `event-player-${event?.player_id || event?.id}`);
    if (!key) return;
    if (!stateByName[key]) stateByName[key] = { onField: false, hasPlayed: false };

    if (event?.event_type === 'sub_in') {
      stateByName[key].onField = true;
      stateByName[key].hasPlayed = true;
      teamSubInCount[team] = (teamSubInCount[team] || 0) + 1;
    }

    if (event?.event_type === 'sub_out') {
      stateByName[key].onField = false;
      stateByName[key].hasPlayed = true;
    }
  });

  return { stateByName, teamSubInCount };
}

export function validateSubstitutionEvent({
  rules,
  state,
  eventType,
  selectedPlayer,
  team,
  minute,
}) {
  if (!['sub_in', 'sub_out'].includes(eventType)) {
    return { allow: true };
  }

  const mergedRules = mergeSubstitutionRules(DEFAULT_PRESET, rules);
  if (!mergedRules.enabled || mergedRules.maxSubstitutionsPerTeam === 0 || mergedRules.mode === 'disabled') {
    return {
      allow: false,
      code: 'no_substitutions_allowed',
      message: 'Substitusi tidak diizinkan untuk cabor/aturan turnamen ini.',
    };
  }

  const playerNameKey = normalizeName(
    selectedPlayer?.player_name || selectedPlayer?.jersey_name || selectedPlayer?.name || `player-${selectedPlayer?.id}`
  );

  const playerState = state?.stateByName?.[playerNameKey] || { onField: false, hasPlayed: false };

  if (Number.isFinite(minute)) {
    if (Number.isFinite(mergedRules.minMinute) && minute < mergedRules.minMinute) {
      return {
        allow: false,
        code: 'substitution_before_allowed_window',
        message: `Substitusi belum diizinkan sebelum menit ${mergedRules.minMinute}.`,
      };
    }

    if (Number.isFinite(mergedRules.maxMinute) && minute > mergedRules.maxMinute) {
      return {
        allow: false,
        code: 'substitution_after_allowed_window',
        message: `Substitusi tidak diizinkan setelah menit ${mergedRules.maxMinute}.`,
      };
    }
  }

  if (eventType === 'sub_out' && !playerState.onField) {
    return {
      allow: false,
      code: 'player_not_on_field',
      message: 'Pemain tidak sedang berada di lapangan, jadi tidak bisa di-sub-out.',
    };
  }

  if (eventType === 'sub_in') {
    if (playerState.onField) {
      return {
        allow: false,
        code: 'player_already_on_field',
        message: 'Pemain sudah berada di lapangan.',
      };
    }

    if (!mergedRules.allowReentry && playerState.hasPlayed) {
      return {
        allow: false,
        code: 'player_reentry_not_allowed',
        message: 'Aturan turnamen tidak mengizinkan pemain masuk kembali setelah keluar.',
      };
    }

    const teamKey = String(team || '').trim() || 'unknown';
    const teamSubInCount = state?.teamSubInCount?.[teamKey] || 0;
    if (Number.isFinite(mergedRules.maxSubstitutionsPerTeam) && teamSubInCount >= mergedRules.maxSubstitutionsPerTeam) {
      return {
        allow: false,
        code: 'team_substitution_quota_reached',
        message: 'Kuota substitusi tim sudah habis sesuai aturan turnamen.',
      };
    }
  }

  return { allow: true };
}
